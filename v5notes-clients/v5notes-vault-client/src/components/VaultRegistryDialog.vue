<script setup lang="ts">
/**
 * 所有库 — durable registry panel (design-demos/vault-registry-scan.html).
 * Lists every vault this app created/opened/scanned, with the recorded path,
 * disk-availability probe, and a directory scan that recovers forgotten vaults.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import {
  hydrateVaultRegistry,
  listVaultRegistry,
  setVaultHidden,
  unregisterVault,
} from '../vault/recent'
import { scanForVaults, type ScannedVault } from '../vault/scanner'
import { vaultWorkspace, type VaultProbeResult } from '../vault/workspace'
import type { VaultRegistryEntry } from '../vault/types'

// NOTE: the prop is `isOpen`, never `open`: this module imports Tauri's dialog
// `open` at top level, and script-setup bindings enter the template scope —
// `$setup.open` would shadow the boolean prop and keep the modal mounted.
const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  cancel: []
  /** Open a registered vault root; failures stay in the panel via `openError`. */
  openVault: [rootPath: string]
}>()

type ProbeState = 'unknown' | 'checking' | 'ok' | 'missing'

interface Row extends VaultRegistryEntry {
  probe: ProbeState
}

const rows = ref<Row[]>([])
const probing = ref(false)
const openError = ref<string | null>(null)
const busyPath = ref<string | null>(null)

// Scan phase lives inside the same dialog: idle -> scanning -> results.
const scanPhase = ref<'idle' | 'scanning' | 'results'>('idle')
const scanned = ref<(ScannedVault & { selected: boolean })[]>([])
const scanError = ref<string | null>(null)
const scanCancel = { cancelled: false }

let lastScanDir: string | null = null

const sourceLabel = (entry: VaultRegistryEntry): string => {
  if (entry.source === 'created') return '本应用创建'
  if (entry.source === 'scanned') return '扫描添加'
  return '打开过'
}

const visibleCount = computed(() => rows.value.length)

function refreshRows() {
  rows.value = listVaultRegistry().map(entry => ({ ...entry, probe: 'unknown' as ProbeState }))
}

async function probeAll() {
  if (probing.value || !rows.value.length) return
  probing.value = true
  rows.value = rows.value.map(row => ({ ...row, probe: 'checking' }))
  const results = await Promise.all(
    rows.value.map(row => vaultWorkspace.probeVaultRoot(row.rootPath)),
  )
  rows.value = rows.value.map((row, index) => {
    const result: VaultProbeResult = results[index]!
    return {
      ...row,
      probe: result.ok ? 'ok' : 'missing',
      name: result.ok && result.name ? result.name : row.name,
    }
  })
  // Sync corrected names back to the registry so renames on disk are remembered.
  for (const row of rows.value) {
    const stored = listVaultRegistry().find(item => item.rootPath === row.rootPath)
    if (stored && stored.name !== row.name) vaultWorkspace.renameRegisteredVault(row.rootPath, row.name)
  }
  probing.value = false
}

async function toggleHidden(row: Row) {
  const hidden = !(row.hidden ?? false)
  setVaultHidden(row.rootPath, hidden)
  refreshRows()
  await probeAll()
}

async function forgetRow(row: Row) {
  unregisterVault(row.rootPath)
  refreshRows()
}

async function runScan(dir: string) {
  scanPhase.value = 'scanning'
  scanned.value = []
  scanError.value = null
  lastScanDir = dir
  try {
    const found = await scanForVaults(dir, { signal: scanCancel })
    if (scanCancel.cancelled) return
    const known = new Set(listVaultRegistry().map(item => item.rootPath))
    scanned.value = found.map(vault => ({
      ...vault,
      selected: !known.has(vault.rootPath),
    }))
    scanPhase.value = 'results'
    if (!found.length) {
      scanError.value = `未在 ${dir} 中找到含 .v5notes/vault.json 的文件夹（扫描深度 ≤3）。`
      scanPhase.value = 'idle'
    }
  } catch (err) {
    scanPhase.value = 'idle'
    scanError.value = err instanceof Error ? err.message : String(err)
  }
}

async function startScan() {
  scanError.value = null
  const dir = await open({
    directory: true,
    multiple: false,
    recursive: true,
    title: '选择要扫描的目录（在其中查找库）',
    defaultPath: lastScanDir ?? undefined,
  })
  if (!dir || Array.isArray(dir)) return
  await runScan(dir)
}

function cancelScan() {
  scanCancel.cancelled = true
  scanPhase.value = 'idle'
  scanError.value = null
}

function backFromResults() {
  scanPhase.value = 'idle'
  scanError.value = null
}

/** Re-run the previous scan without re-picking a folder. */
function rescanSameDir() {
  if (lastScanDir) void runScan(lastScanDir)
}

async function addSelected() {
  const chosen = scanned.value.filter(item => item.selected)
  for (const vault of chosen) {
    try {
      await vaultWorkspace.registerScannedVault(vault)
    } catch (err) {
      scanError.value = err instanceof Error ? err.message : String(err)
      return
    }
  }
  scanPhase.value = 'idle'
  scanError.value = null
  refreshRows()
  await probeAll()
}

async function onOpenClick(row: Row) {
  busyPath.value = row.rootPath
  openError.value = null
  emit('openVault', row.rootPath)
}

watch(
  () => props.isOpen,
  isOpen => {
    if (!isOpen) {
      scanCancel.cancelled = true
      scanPhase.value = 'idle'
      return
    }
    scanCancel.cancelled = false
    openError.value = null
    void hydrateVaultRegistry().then(() => {
      // Re-check: the dialog may have been closed while hydration was in flight.
      if (props.isOpen) {
        refreshRows()
        void probeAll()
      }
    })
  },
  { immediate: true },
)

function onKeydown(event: KeyboardEvent) {
  if (!props.isOpen) return
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('cancel')
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <!-- Teleport to body: the welcome page's radial-gradient background creates a
       containing block that traps position:fixed modals inside its stacking order. -->
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="modal-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-registry-title"
    >
      <button type="button" class="modal-backdrop" aria-label="关闭" @click="emit('cancel')" />
      <div class="modal-card vault-registry-card">
        <!-- ============ 主视图：登记簿列表 ============ -->
        <template v-if="scanPhase !== 'scanning' && scanPhase !== 'results'">
          <h2 id="vault-registry-title">所有库<span class="vr-count">{{ visibleCount }}</span></h2>
          <p class="modal-lede">
            应用创建或打开过的库都记录在这里；从首页「最近」隐藏不影响本记录。路径失效的库会标出。
          </p>

          <p v-if="openError" class="field-error" role="alert">{{ openError }}</p>

          <ul v-if="rows.length" class="vr-list" aria-label="库记录列表">
            <li
              v-for="row in rows"
              :key="row.rootPath"
              class="vr-item"
              :class="{ missing: row.probe === 'missing' }"
            >
              <div class="vr-copy">
                <strong>
                  {{ row.name }}
                  <em class="vr-source">{{ sourceLabel(row) }}</em>
                  <em v-if="row.hidden" class="vr-hidden-tag">已隐藏</em>
                  <em v-if="row.probe === 'missing'" class="vr-missing-tag">路径不存在</em>
                </strong>
                <span class="vr-path" :title="row.rootPath">{{ row.rootPath }}</span>
              </div>
              <div class="vr-actions">
                <button
                  v-if="row.probe !== 'missing'"
                  type="button"
                  class="primary vr-btn"
                  :disabled="busyPath !== null"
                  @click="onOpenClick(row)"
                >
                  {{ busyPath === row.rootPath ? '打开中…' : '打开' }}
                </button>
                <button
                  v-if="row.hidden && row.probe !== 'missing'"
                  type="button"
                  class="ghost vr-btn"
                  @click="toggleHidden(row)"
                >显示到最近</button>
                <button type="button" class="ghost vr-btn danger-text" @click="forgetRow(row)">清除记录</button>
              </div>
            </li>
          </ul>
          <p v-else class="vr-empty">还没有任何库记录。创建或打开一个库后，它会永久出现在这里。</p>

          <div class="vr-footer-tools">
            <button type="button" class="vr-scan" :disabled="probing" @click="startScan">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="4.4" stroke="currentColor" stroke-width="1.5" />
                <path d="m10.4 10.4 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
              扫描某个目录，找回丢失的库…
            </button>
            <button type="button" class="vr-probe" :disabled="probing || !rows.length" @click="probeAll">
              {{ probing ? '检查中…' : '重新检查路径' }}
            </button>
          </div>

          <div class="modal-actions">
            <button type="button" class="ghost" @click="emit('cancel')">关闭</button>
          </div>
        </template>

        <!-- ============ 扫描进行 ============ -->
        <template v-else-if="scanPhase === 'scanning'">
          <h2>正在扫描目录…</h2>
          <p class="modal-lede">递归查找含 <code>.v5notes/vault.json</code> 的文件夹（深度 ≤3，自动跳过 node_modules、隐藏目录等）。</p>
          <div class="vr-progress" role="progressbar" aria-label="扫描进度"><i /></div>
          <div class="modal-actions">
            <button type="button" class="ghost" @click="cancelScan">取消</button>
          </div>
        </template>

        <!-- ============ 扫描结果 ============ -->
        <template v-else>
          <h2 id="vault-registry-title">扫描结果<span class="vr-count">{{ scanned.length }}</span></h2>
          <p v-if="scanError" class="field-error" role="alert">{{ scanError }}</p>
          <p v-else class="modal-lede">勾选要登记的库。「已在列表中」的默认不勾选。</p>

          <ul v-if="scanned.length" class="vr-list">
            <li v-for="(vault, index) in scanned" :key="vault.rootPath" class="vr-check">
              <input
                :id="`vr-scan-${index}`"
                v-model="vault.selected"
                type="checkbox"
              />
              <label :for="`vr-scan-${index}`">
                <strong>{{ vault.name }}</strong>
                <span>{{ vault.rootPath }}</span>
              </label>
            </li>
          </ul>

          <div class="modal-actions">
            <button type="button" class="ghost" @click="backFromResults">返回</button>
            <button type="button" class="ghost" @click="rescanSameDir">重新扫描该目录</button>
            <button
              type="button"
              class="primary"
              :disabled="!scanned.some(item => item.selected)"
              @click="addSelected"
            >
              添加所选（{{ scanned.filter(item => item.selected).length }}）
            </button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.vr-list {
  list-style: none;
  margin: 0 -6px;
  padding: 2px 6px;
  display: grid;
  gap: 8px;
  overflow: auto;
  min-height: 0;
}

/* Intentionally minimal; shared modal chrome comes from style.css (.vr-* rules). */
.vr-empty {
  margin: 0;
  font-family: var(--font-ui);
  font-size: 0.8rem;
  color: var(--muted);
}
</style>
