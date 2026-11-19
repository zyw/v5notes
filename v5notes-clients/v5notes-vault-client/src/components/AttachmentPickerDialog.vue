<script setup lang="ts">
/**
 * 插入图片 — vault attachment manager opened by the editor toolbar's image
 * button. Shows every image stored under `attachments/` so users pick one and
 * insert it with an explicit action, drop what they do not need, and import
 * from the OS only on demand. Keeping this one surface prevents stray copies
 * piling up unseen (the folder itself stays out of the note tree).
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'
import { extensionOf } from '../sync/attachments'
import type { VaultAttachment } from '../vault/attachments'

const IMAGE_MIMES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
}

function mimeFromExtension(ext: string): string {
  return IMAGE_MIMES[ext] ?? 'application/octet-stream'
}

const props = defineProps<{
  isOpen: boolean
  busy?: boolean
  /** Initial list; the host re-scans through `refresh`. */
  attachments: VaultAttachment[]
  /** Paths referenced by the open note (vault-relative, decoded). */
  referenced?: Set<string>
}>()

const emit = defineEmits<{
  cancel: []
  /** Insert the selected attachment at the caret and close. */
  insert: [attachment: VaultAttachment]
  /** Delete (moved to the local trash) after inline confirmation. */
  remove: [attachment: VaultAttachment]
  /** Import picked OS images into the vault, then refresh. */
  importFiles: [files: File[]]
  /** Ask the host for a displayable URL of an attachment. */
  loadUrl: [attachment: VaultAttachment]
  /** Re-scan the attachment folder. */
  refresh: []
}>()

type Phase = 'idle' | 'importing' | 'error'

const phase = ref<Phase>('idle')
const errorText = ref<string | null>(null)
const previewUrls = ref<Map<string, string>>(new Map())
const selectedRel = ref<string | null>(null)
/** Row awaiting delete confirmation (name + progress state live here). */
const pendingDelete = ref<VaultAttachment | null>(null)
const deleting = ref(false)

const selectedItem = computed(
  () => props.attachments.find(item => item.rel === selectedRel.value) ?? null,
)

async function loadPreviews(items: VaultAttachment[]) {
  for (const item of items) {
    if (!previewUrls.value.has(item.rel)) emit('loadUrl', item)
  }
}

watch(
  () => props.isOpen,
  open => {
    if (!open) return
    // Fresh session: no stale selection or errors from the previous opening.
    selectedRel.value = props.attachments[0]?.rel ?? null
    pendingDelete.value = null
    errorText.value = null
    phase.value = 'idle'
  },
)

watch(
  () => props.attachments,
  items => {
    // Drop previews for files that no longer exist; keep the current choice.
    const alive = new Set(items.map(item => item.rel))
    if (previewUrls.value.size && [...previewUrls.value.keys()].some(key => !alive.has(key))) {
      const next = new Map(previewUrls.value)
      for (const key of Array.from(next.keys())) if (!alive.has(key)) next.delete(key)
      previewUrls.value = next
    }
    if (selectedRel.value && !alive.has(selectedRel.value)) {
      selectedRel.value = items[0]?.rel ?? null
    }
    if (props.isOpen) void loadPreviews(items)
  },
  { immediate: true },
)

function selectItem(item: VaultAttachment) {
  selectedRel.value = item.rel
}

function setPreview(rel: string, url: string) {
  if (!props.isOpen || !rel) return
  const next = new Map(previewUrls.value)
  next.set(rel, url)
  previewUrls.value = next
}

function fail(message: string) {
  errorText.value = message
  phase.value = 'error'
}

async function onImport() {
  if (phase.value === 'importing') return
  errorText.value = null
  let paths: string | string[] | null
  try {
    paths = await openDialog({
      multiple: true,
      title: '导入图片到当前库',
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'] }],
    })
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
    return
  }
  const selected = paths == null ? [] : Array.isArray(paths) ? paths : [paths]
  if (!selected.length) return
  phase.value = 'importing'
  try {
    const files: File[] = []
    for (const path of selected) {
      const bytes = await readFile(path)
      const name = path.replace(/\\/g, '/').split('/').pop() || 'image'
      const ext = extensionOf(name)
      files.push(new File([bytes], ext ? name : `${name}.png`, { type: mimeFromExtension(ext) }))
    }
    emit('importFiles', files)
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
    phase.value = 'idle'
  }
}

function importDone(ok: boolean, message?: string) {
  if (!ok) {
    if (message) errorText.value = message
  } else {
    errorText.value = null
  }
  // Either way the flow ends: rows refreshed below show what made it in.
  phase.value = 'idle'
}

function confirmDelete(item: VaultAttachment) {
  pendingDelete.value = item
  errorText.value = null
}

function runDelete() {
  const item = pendingDelete.value
  if (!item || deleting.value) return
  deleting.value = true
  emit('remove', item)
}

function deleteDone(ok: boolean, message?: string) {
  deleting.value = false
  if (!ok) {
    if (message) errorText.value = message
    return
  }
  pendingDelete.value = null
}

function onInsertClick() {
  if (!selectedItem.value) return
  emit('insert', selectedItem.value)
}

defineExpose({ setPreview, fail, deleteDone, importDone })

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ms: number | null): string {
  if (!ms) return ''
  return new Date(ms).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function onKeydown(event: KeyboardEvent) {
  if (!props.isOpen) return
  if (event.key === 'Escape') {
    // Safe to cancel unless a mutation is mid-flight.
    if (phase.value === 'importing' || deleting.value) return
    event.preventDefault()
    if (pendingDelete.value) {
      pendingDelete.value = null
      return
    }
    emit('cancel')
    return
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'i' && selectedItem.value) {
    event.preventDefault()
    onInsertClick()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <!-- Teleported: workspace panels carry transforms that would trap fixed modals. -->
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="modal-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attachment-picker-title"
    >
      <button
        type="button"
        class="modal-backdrop"
        aria-label="关闭"
        @click="emit('cancel')"
      />
      <div class="modal-card ap-card">
        <div class="ap-head">
          <h2 id="attachment-picker-title">
            附件图片<span class="ap-count">{{ attachments.length }}</span>
          </h2>
          <button type="button" class="ap-refresh" aria-label="重新扫描附件目录" @click="emit('refresh')">
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path
                d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 1.8v3h-3"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            刷新
          </button>
        </div>
        <p class="modal-lede">
          点选一张图片，再按「插入」写入笔记。删除的图片进入本地回收站，可在侧栏回收站还原。
        </p>

        <p v-if="errorText" class="field-error" role="alert">{{ errorText }}</p>

        <ul
          v-if="attachments.length"
          class="ap-grid"
          role="listbox"
          aria-label="附件图片列表"
          aria-orientation="horizontal"
        >
          <li
            v-for="item in attachments"
            :key="item.rel"
            class="ap-item"
            :class="{ selected: item.rel === selectedRel }"
            role="option"
            :aria-selected="item.rel === selectedRel"
            tabindex="0"
            @click="selectItem(item)"
            @keydown.enter.prevent="selectItem(item)"
            @keydown.space.prevent="selectItem(item)"
          >
            <div class="ap-thumb">
              <img
                v-if="previewUrls.get(item.rel)"
                :src="previewUrls.get(item.rel)"
                :alt="item.name"
                loading="lazy"
              />
              <span v-else class="ap-thumb-empty" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6" />
                  <circle cx="9" cy="10" r="1.6" fill="currentColor" />
                  <path d="M4.5 17.5 10 12l3.5 3.5L16 13l3.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
                </svg>
              </span>
              <span v-if="item.rel === selectedRel" class="ap-check" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="12" height="12">
                  <path
                    d="M3 8.4 6.3 11.5l6.7-7"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
            </div>
            <div class="ap-meta">
              <strong :title="item.rel">{{ item.name }}</strong>
              <span>{{ formatSize(item.sizeBytes) }}<template v-if="formatDate(item.modifiedAt)"> · {{ formatDate(item.modifiedAt) }}</template></span>
              <em v-if="referenced?.has(item.rel)" class="ap-used">当前笔记使用</em>
            </div>
            <button
              type="button"
              class="ap-delete"
              :aria-label="`删除 ${item.name}`"
              :disabled="busy || deleting"
              @click.stop="confirmDelete(item)"
            >
              删除
            </button>

            <div
              v-if="pendingDelete?.rel === item.rel"
              class="ap-confirm"
              role="alertdialog"
              aria-label="确认删除图片"
            >
              <p>
                删除「{{ item.name }}」？移入回收站后笔记中的引用将显示为缺失。
                <template v-if="referenced?.has(item.rel)">当前笔记正在使用这张图片。</template>
              </p>
              <div>
                <button type="button" class="ghost compact" :disabled="deleting" @click="pendingDelete = null">
                  取消
                </button>
                <button
                  v-if="referenced?.has(item.rel)"
                  type="button"
                  class="danger compact"
                  :disabled="deleting"
                  @click="runDelete"
                >
                  {{ deleting ? '删除中…' : '仍然删除' }}
                </button>
                <button v-else type="button" class="danger compact" :disabled="deleting" @click="runDelete">
                  {{ deleting ? '删除中…' : '移入回收站' }}
                </button>
              </div>
            </div>
          </li>
        </ul>

        <div v-else-if="phase === 'importing'" class="ap-empty" aria-live="polite">正在导入…</div>
        <div v-else class="ap-empty">
          <p>还没有附件图片，先导入几张吧。</p>
        </div>

        <div class="modal-actions ap-actions">
          <button type="button" class="ghost ap-btn" :disabled="phase === 'importing'" @click="emit('cancel')">
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4l-8 8"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
              />
            </svg>
            关闭
          </button>
          <button type="button" class="ghost ap-btn" :disabled="busy || phase === 'importing'" @click="onImport">
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path
                d="M8 10.5V2.5m0 0L5 5.6m3-3.1 3 3.1M2.5 11v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V11"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            {{ phase === 'importing' ? '导入中…' : '导入图片' }}
          </button>
          <button
            type="button"
            class="primary ap-btn"
            :disabled="!selectedItem || busy || phase === 'importing'"
            @click="onInsertClick"
          >
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path
                d="M8 2.5v11m-5.5-5.5h11"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
            </svg>
            插入
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Design follows the vault-registry card: quiet rows, one accent action,
   thumbnails carrying all the visual weight. */
.ap-card {
  width: min(640px, 100%);
  max-height: min(80vh, 680px);
  display: flex;
  flex-direction: column;
}

.ap-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ap-count {
  font-style: normal;
  font-family: var(--font-ui);
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--muted);
  background: var(--surface);
  border-radius: 999px;
  padding: 2px 9px;
  margin-left: 8px;
  vertical-align: 2px;
}

.ap-refresh {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  font-family: var(--font-ui);
  font-size: 0.76rem;
  border-radius: 8px;
  padding: 5px 10px;
  cursor: pointer;
}

.ap-refresh:hover:not(:disabled) {
  color: var(--ink);
  border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
}

.ap-grid {
  list-style: none;
  margin: 2px -4px 0;
  padding: 2px 4px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 10px;
  overflow: auto;
  min-height: 0;
}

.ap-item {
  position: relative;
  display: grid;
  gap: 6px;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
  background: color-mix(in srgb, var(--panel) 60%, #fff);
  cursor: pointer;
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
}

html[data-color-mode='dark'] .ap-item {
  background: color-mix(in srgb, var(--panel) 80%, #000 6%);
}

.ap-item:hover {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
}

.ap-item:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 1px;
}

.ap-item.selected {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent);
}

.ap-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  overflow: hidden;
}

.ap-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.ap-thumb-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: color-mix(in srgb, var(--muted) 70%, transparent);
}

.ap-check {
  position: absolute;
  top: 6px;
  left: 6px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  color: #fff;
  background: var(--accent);
  box-shadow: 0 2px 6px rgba(36, 53, 44, 0.25);
}

.ap-meta {
  display: grid;
  gap: 1px;
  font-family: var(--font-ui);
  min-width: 0;
}

.ap-meta strong {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ap-meta span {
  font-size: 0.7rem;
  color: var(--muted);
}

.ap-used {
  justify-self: start;
  font-style: normal;
  font-size: 0.66rem;
  font-weight: 600;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-radius: 999px;
  padding: 1px 8px;
}

.ap-delete {
  position: absolute;
  top: 6px;
  right: 6px;
  border: none;
  border-radius: 6px;
  padding: 3px 8px;
  font-family: var(--font-ui);
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--danger);
  background: color-mix(in srgb, var(--panel) 82%, transparent);
  opacity: 0;
  transition: opacity 0.12s ease;
  cursor: pointer;
}

.ap-item:hover .ap-delete,
.ap-item:focus-within .ap-delete {
  opacity: 1;
}

.ap-delete:disabled {
  cursor: default;
  opacity: 0.4;
}

.ap-confirm {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  align-content: center;
  gap: 8px;
  padding: 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel) 94%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--line));
}

.ap-confirm p {
  margin: 0;
  font-family: var(--font-ui);
  font-size: 0.76rem;
  line-height: 1.5;
  color: var(--ink);
}

.ap-confirm div {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.ap-empty {
  display: grid;
  justify-items: start;
  gap: 10px;
  padding: 18px 2px 6px;
  font-family: var(--font-ui);
  font-size: 0.85rem;
  color: var(--muted);
}

.ap-empty p {
  margin: 0;
}

.ap-actions {
  align-items: center;
}

.ap-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 12px;
  font-size: 0.8rem;
}
</style>
