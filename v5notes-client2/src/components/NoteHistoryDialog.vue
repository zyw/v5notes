<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useWorkspaceContext } from '../hooks/workspaceContext'
import { diffLines } from '../models/lineDiff'
import type { NoteRevision, NoteRevisionDetail } from '../service/api'
import { ConflictError } from '../service/request'

const { api, draft, historyOpen, restoreTarget, conflict, reloadAfterConflict, overwriteConflict } = useWorkspaceContext()
const rows = ref<NoteRevision[]>([])
const total = ref(0)
const page = ref(1)
const selected = ref<NoteRevisionDetail | null>(null)
const loading = ref(false)
const error = ref('')
const compare = ref(false)
const restoreError = ref('')
const restoreBusy = ref(false)
const diff = computed(() => selected.value ? diffLines(selected.value.content, draft.note?.content ?? '') : [])

watch(historyOpen, open => {
  if (!open) {
    rows.value = []
    selected.value = null
    compare.value = false
    error.value = ''
    page.value = 1
    return
  }
  void load(true)
})

watch(restoreTarget, target => {
  if (!target) restoreError.value = ''
})

async function load(reset: boolean): Promise<void> {
  const noteId = draft.note?.id
  if (!noteId) return
  loading.value = true
  error.value = ''
  try {
    const result = await api.revisions(noteId, reset ? 1 : page.value)
    const incoming = result.rows ?? []
    rows.value = reset ? incoming : [...rows.value, ...incoming]
    total.value = result.total ?? rows.value.length
    if (reset) {
      page.value = 1
      selected.value = null
      if (incoming[0]) await select(incoming[0])
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '历史加载失败'
  } finally {
    loading.value = false
  }
}

async function select(row: NoteRevision): Promise<void> {
  const noteId = draft.note?.id
  if (!noteId) return
  try {
    const detail = await api.revision(noteId, row.id)
    selected.value = { ...detail, head: row.head }
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '版本读取失败'
  }
}

async function loadMore(): Promise<void> {
  page.value += 1
  await load(false)
}

function askRestore(): void {
  if (!selected.value || selected.value.head) return
  restoreError.value = ''
  restoreTarget.value = selected.value
}

async function confirmRestore(): Promise<void> {
  const target = restoreTarget.value
  const note = draft.note
  if (!target || !note || restoreBusy.value) return
  restoreBusy.value = true
  restoreError.value = ''
  try {
    const restored = await api.restoreRevision(note.id, target.id, note.contentHash ?? '')
    draft.load({ ...note, content: restored.content, contentHash: restored.contentHash, updateTime: restored.updateTime })
    restoreTarget.value = null
    historyOpen.value = false
  } catch (cause) {
    if (cause instanceof ConflictError) {
      conflict.value = {
        message: cause.message,
        contentHash: cause.contentHash,
        updateTime: cause.updateTime,
        action: 'restore',
        revisionId: target.id,
      }
      return
    }
    restoreError.value = cause instanceof Error ? cause.message : '恢复失败'
  } finally {
    restoreBusy.value = false
  }
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size >= 10 * 1024 ? 0 : 1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <div v-if="historyOpen" class="modal-backdrop" role="presentation" @click.self="historyOpen = false">
    <section class="modal history-dialog" role="dialog" aria-modal="true" aria-labelledby="history-title">
      <header class="history-header">
        <div>
          <span class="eyebrow">HISTORY</span>
          <h2 id="history-title">历史版本</h2>
        </div>
        <button class="settings-close" type="button" aria-label="关闭历史" @click="historyOpen = false">×</button>
      </header>
      <p v-if="error" class="dialog-error" role="alert">{{ error }}</p>
      <div v-if="!loading && rows.length === 0 && !error" class="history-empty">这篇笔记还没有历史版本。</div>
      <div v-else class="history-body">
        <div class="history-list" role="listbox" aria-label="版本列表">
          <button v-for="row in rows" :key="row.id" type="button" role="option" :aria-selected="selected?.id === row.id" :class="{ selected: selected?.id === row.id }" @click="select(row)">
            <span class="history-time">{{ row.createTime || '未知时间' }}</span>
            <span v-if="row.head" class="history-current">当前</span>
            <span class="history-excerpt">{{ row.excerpt || '空正文' }}</span>
            <span class="history-size">{{ formatSize(row.size || 0) }}</span>
          </button>
          <button v-if="rows.length < total" class="history-more" type="button" :disabled="loading" @click="loadMore">{{ loading ? '正在加载…' : '更早的版本' }}</button>
        </div>
        <div class="history-preview">
          <div class="history-preview-bar">
            <button type="button" :aria-pressed="compare" :disabled="!selected" @click="compare = !compare">{{ compare ? '查看全文' : '与当前对比' }}</button>
            <button class="primary" type="button" :disabled="!selected || selected.head" @click="askRestore">恢复此版本</button>
          </div>
          <div v-if="selected && compare" class="history-diff" aria-label="与当前正文的差异">
            <p v-for="(line, index) in diff" :key="index" :class="`diff-${line.kind}`"><span>{{ line.kind === 'add' ? '+' : line.kind === 'remove' ? '−' : ' ' }}</span>{{ line.text || ' ' }}</p>
          </div>
          <pre v-else-if="selected">{{ selected.content }}</pre>
          <p v-else class="history-empty">选择一个版本查看正文。</p>
        </div>
      </div>
    </section>
  </div>

  <div v-if="restoreTarget" class="modal-backdrop restore-backdrop" role="presentation">
    <section class="modal crud-modal" role="dialog" aria-modal="true" aria-labelledby="restore-title">
      <span class="eyebrow">恢复版本</span>
      <h2 id="restore-title">恢复到 {{ restoreTarget.createTime || '所选版本' }}</h2>
      <p>当前正文会先保留成一条历史，恢复之后还能再回到这一版。</p>
      <p v-if="restoreError" class="dialog-error" role="alert">{{ restoreError }}</p>
      <div class="modal-actions">
        <button type="button" :disabled="restoreBusy" @click="restoreTarget = null">取消</button>
        <button class="primary" type="button" :disabled="restoreBusy" @click="confirmRestore">{{ restoreBusy ? '正在恢复…' : '恢复' }}</button>
      </div>
    </section>
  </div>

  <div v-if="conflict" class="modal-backdrop conflict-backdrop" role="presentation">
    <section class="modal crud-modal" role="dialog" aria-modal="true" aria-labelledby="conflict-title">
      <span class="eyebrow">版本冲突</span>
      <h2 id="conflict-title">笔记已在其他地方更新</h2>
      <p>{{ conflict.message }}</p>
      <p v-if="conflict.updateTime">库中最近保存时间：{{ conflict.updateTime }}</p>
      <div class="modal-actions">
        <button type="button" @click="conflict = null">取消</button>
        <button type="button" @click="reloadAfterConflict">重新加载</button>
        <button class="primary" type="button" @click="overwriteConflict">仍要覆盖保存</button>
      </div>
    </section>
  </div>
</template>
