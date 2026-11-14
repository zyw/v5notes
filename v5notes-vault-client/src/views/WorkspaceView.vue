<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import NameDialog from '../components/NameDialog.vue'
import VaultTree from '../components/VaultTree.vue'
import { normalizeVaultPath, VaultPathError } from '../path/identity'
import { APPEARANCE_REL } from '../vault/skeleton'
import { vaultSearch, type SearchHit } from '../vault/search'
import { emptyTrash, listTrash, moveToTrash, restoreFromTrash, type TrashEntry } from '../vault/trash'
import type { OpenedVault, VaultTreeNode } from '../vault/types'
import { vaultFs } from '../vault/vaultFs'
import { watchVaultRoot } from '../vault/watcher'
import {
  applyAppearance,
  loadAppearancePrefs,
  type AppearancePrefs,
} from '../appearance/themes'
import { join } from '@tauri-apps/api/path'
import { writeTextFile } from '@tauri-apps/plugin-fs'

const props = defineProps<{
  vault: OpenedVault
}>()

const emit = defineEmits<{
  close: []
  error: [message: string]
  dirtyChange: [dirty: boolean]
}>()

const tree = ref<VaultTreeNode[]>([])
const selectedPath = ref<string | null>(null)
const content = ref('')
const savedContent = ref('')
const editorMode = ref<'preview' | 'edit'>('preview')
const busy = ref(false)
const status = ref('')
const sidebarOpen = ref(true)
const externalNotice = ref<string | null>(null)

const searchQuery = ref('')
const searchHits = ref<SearchHit[]>([])
const searchBusy = ref(false)
const showTrash = ref(false)
const trashEntries = ref<TrashEntry[]>([])

const nameDialog = ref<{
  mode: 'note' | 'dir' | 'rename'
  parentPath: string | null
  target: VaultTreeNode | null
  error: string | null
} | null>(null)
const confirmDialog = ref<{
  mode: 'delete' | 'empty-trash' | 'close-dirty' | 'external-reload'
  node?: VaultTreeNode | null
  message: string
  title: string
} | null>(null)

const dirty = computed(() => selectedPath.value != null && content.value !== savedContent.value)
const noteTitle = computed(() => {
  if (!selectedPath.value) return ''
  const name = selectedPath.value.split('/').pop() ?? selectedPath.value
  return name.replace(/\.md$/i, '')
})

let unwatch: (() => void) | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null
let pendingClose = false

watch(dirty, value => emit('dirtyChange', value), { immediate: true })

async function refreshTree() {
  tree.value = await vaultFs.listTree(props.vault.rootPath)
}

async function refreshTrash() {
  trashEntries.value = await listTrash(props.vault.rootPath)
}

async function openNote(node: VaultTreeNode) {
  if (node.kind !== 'note') return
  if (dirty.value) {
    const ok = await saveCurrent()
    if (!ok) return
  }
  busy.value = true
  status.value = ''
  externalNotice.value = null
  try {
    const text = await vaultFs.readText(props.vault.rootPath, node.path)
    selectedPath.value = node.path
    content.value = text
    savedContent.value = text
    editorMode.value = 'preview'
  } catch (error) {
    emit('error', error instanceof Error ? error.message : String(error))
  } finally {
    busy.value = false
  }
}

async function saveCurrent(): Promise<boolean> {
  if (!selectedPath.value || !dirty.value) return true
  busy.value = true
  status.value = ''
  try {
    await vaultFs.writeText(props.vault.rootPath, selectedPath.value, content.value)
    savedContent.value = content.value
    status.value = '已保存'
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    status.value = message
    emit('error', message)
    return false
  } finally {
    busy.value = false
  }
}

async function enterEdit() {
  editorMode.value = 'edit'
}

async function leaveEdit() {
  if (dirty.value) {
    const ok = await saveCurrent()
    if (!ok) return
  }
  editorMode.value = 'preview'
}

function parentOf(path: string | null): string | null {
  if (!path) return null
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : null
}

function openCreateNote(parent: VaultTreeNode | null) {
  nameDialog.value = {
    mode: 'note',
    parentPath: parent?.path ?? null,
    target: null,
    error: null,
  }
}

function openCreateDir(parent: VaultTreeNode | null) {
  nameDialog.value = {
    mode: 'dir',
    parentPath: parent?.path ?? null,
    target: null,
    error: null,
  }
}

function openRename(node: VaultTreeNode) {
  nameDialog.value = {
    mode: 'rename',
    parentPath: parentOf(node.path),
    target: node,
    error: null,
  }
}

function openDelete(node: VaultTreeNode) {
  const isDir = node.kind === 'dir'
  confirmDialog.value = {
    mode: 'delete',
    node,
    title: isDir ? '删除目录' : '删除笔记',
    message: isDir
      ? `将「${node.name}」及其子目录与笔记移入本地回收站（.v5notes/trash，永不同步）。可稍后还原。`
      : `将「${node.name.replace(/\.md$/i, '')}」移入本地回收站（永不同步）。可稍后还原。`,
  }
}

async function submitName(raw: string) {
  if (!nameDialog.value) return
  const dialog = nameDialog.value
  busy.value = true
  dialog.error = null
  try {
    if (dialog.mode === 'note') {
      if (dirty.value) {
        const ok = await saveCurrent()
        if (!ok) return
      }
      const leaf = raw.trim().replace(/\.md$/i, '')
      const fileName = `${leaf}.md`
      const rel = dialog.parentPath ? `${dialog.parentPath}/${fileName}` : fileName
      const { displayPath } = normalizeVaultPath(rel)
      if (await vaultFs.exists(props.vault.rootPath, displayPath)) {
        throw new VaultPathError('同名笔记已存在')
      }
      await vaultFs.writeText(props.vault.rootPath, displayPath, `# ${leaf}\n\n`)
      nameDialog.value = null
      await refreshTree()
      await openNote({
        path: displayPath,
        identityKey: displayPath.toLowerCase(),
        name: fileName,
        kind: 'note',
      })
      editorMode.value = 'edit'
      return
    }

    if (dialog.mode === 'dir') {
      const rel = dialog.parentPath ? `${dialog.parentPath}/${raw.trim()}` : raw.trim()
      const { displayPath } = normalizeVaultPath(rel)
      if (await vaultFs.exists(props.vault.rootPath, displayPath)) {
        throw new VaultPathError('同名目录已存在')
      }
      await vaultFs.mkdir(props.vault.rootPath, displayPath)
      nameDialog.value = null
      await refreshTree()
      return
    }

    if (dialog.mode === 'rename' && dialog.target) {
      if (dirty.value && selectedPath.value === dialog.target.path) {
        const ok = await saveCurrent()
        if (!ok) return
      }
      const target = dialog.target
      const newLeaf =
        target.kind === 'note' ? `${raw.trim().replace(/\.md$/i, '')}.md` : raw.trim()
      const toRel = dialog.parentPath ? `${dialog.parentPath}/${newLeaf}` : newLeaf
      const { displayPath } = normalizeVaultPath(toRel)
      if (displayPath === target.path) {
        nameDialog.value = null
        return
      }
      if (await vaultFs.exists(props.vault.rootPath, displayPath)) {
        throw new VaultPathError('目标名称已存在')
      }
      await vaultFs.rename(props.vault.rootPath, target.path, displayPath)
      if (selectedPath.value === target.path) {
        selectedPath.value = displayPath
      }
      nameDialog.value = null
      await refreshTree()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (nameDialog.value) nameDialog.value.error = message
    else emit('error', message)
  } finally {
    busy.value = false
  }
}

async function confirmAction() {
  if (!confirmDialog.value) return
  const dialog = confirmDialog.value
  busy.value = true
  try {
    if (dialog.mode === 'delete' && dialog.node) {
      if (dirty.value && selectedPath.value === dialog.node.path) {
        // Discard or save? Destructive delete of current — clear dirty after trash.
      }
      await moveToTrash(props.vault.rootPath, dialog.node.path)
      if (
        selectedPath.value === dialog.node.path ||
        (dialog.node.kind === 'dir' && selectedPath.value?.startsWith(`${dialog.node.path}/`))
      ) {
        selectedPath.value = null
        content.value = ''
        savedContent.value = ''
      }
      confirmDialog.value = null
      await refreshTree()
      if (showTrash.value) await refreshTrash()
      status.value = '已移入回收站'
      return
    }
    if (dialog.mode === 'empty-trash') {
      await emptyTrash(props.vault.rootPath)
      confirmDialog.value = null
      await refreshTrash()
      return
    }
    if (dialog.mode === 'external-reload' && selectedPath.value) {
      const text = await vaultFs.readText(props.vault.rootPath, selectedPath.value)
      content.value = text
      savedContent.value = text
      externalNotice.value = null
      confirmDialog.value = null
      return
    }
    if (dialog.mode === 'close-dirty') {
      const ok = await saveCurrent()
      if (!ok) return
      confirmDialog.value = null
      if (pendingClose) {
        pendingClose = false
        emit('close')
      }
    }
  } catch (error) {
    emit('error', error instanceof Error ? error.message : String(error))
  } finally {
    busy.value = false
  }
}

function requestClose() {
  if (!dirty.value) {
    emit('close')
    return
  }
  pendingClose = true
  confirmDialog.value = {
    mode: 'close-dirty',
    title: '未保存的更改',
    message: '切换库前需要先保存当前笔记。保存失败将留在编辑状态。',
  }
}

async function createNoteRoot() {
  openCreateNote(null)
}

async function runSearch(query: string) {
  searchBusy.value = true
  try {
    searchHits.value = query.trim() ? await vaultSearch.search(props.vault.rootPath, query) : []
  } catch (error) {
    emit('error', error instanceof Error ? error.message : String(error))
  } finally {
    searchBusy.value = false
  }
}

watch(searchQuery, value => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    void runSearch(value)
  }, 220)
})

async function onExternalChange() {
  try {
    await refreshTree()
    if (!selectedPath.value) return
    const stillExists = await vaultFs.exists(props.vault.rootPath, selectedPath.value)
    if (!stillExists) {
      externalNotice.value = '当前笔记已被外部删除或移走'
      return
    }
    const disk = await vaultFs.readText(props.vault.rootPath, selectedPath.value)
    if (disk === content.value) {
      savedContent.value = disk
      return
    }
    if (!dirty.value) {
      content.value = disk
      savedContent.value = disk
      status.value = '已从磁盘重新加载'
      return
    }
    externalNotice.value = '磁盘上的笔记与未保存内容不一致'
  } catch (error) {
    emit('error', error instanceof Error ? error.message : String(error))
  }
}

async function persistAppearanceIntent(prefs: AppearancePrefs) {
  try {
    const abs = await join(props.vault.rootPath, ...APPEARANCE_REL.split('/'))
    await writeTextFile(
      abs,
      `${JSON.stringify({ schemaVersion: 1, theme: prefs.theme, colorMode: prefs.colorMode }, null, 2)}\n`,
    )
  } catch {
    /* appearance intent is best-effort in workspace */
  }
}

function onKeydown(event: KeyboardEvent) {
  const meta = event.metaKey || event.ctrlKey
  if (meta && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void saveCurrent()
  }
  if (meta && event.key.toLowerCase() === 'n') {
    event.preventDefault()
    openCreateNote(null)
  }
}

watch(
  () => props.vault.rootPath,
  async () => {
    selectedPath.value = null
    content.value = ''
    savedContent.value = ''
    searchQuery.value = ''
    searchHits.value = []
    showTrash.value = false
    await refreshTree()
    await setupWatcher()
  },
)

async function setupWatcher() {
  if (unwatch) {
    unwatch()
    unwatch = null
  }
  try {
    unwatch = await watchVaultRoot(props.vault.rootPath, () => {
      void onExternalChange()
    })
  } catch (error) {
    // Watcher optional in constrained environments.
    console.warn('vault watch unavailable', error)
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  try {
    await refreshTree()
    await setupWatcher()
    const prefs = loadAppearancePrefs()
    applyAppearance(prefs)
    void persistAppearanceIntent(prefs)
  } catch (error) {
    emit('error', error instanceof Error ? error.message : String(error))
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (unwatch) unwatch()
  if (searchTimer) clearTimeout(searchTimer)
  emit('dirtyChange', false)
})

async function toggleTrashPanel() {
  showTrash.value = !showTrash.value
  if (showTrash.value) await refreshTrash()
}

async function restoreEntry(entry: TrashEntry) {
  busy.value = true
  try {
    await restoreFromTrash(props.vault.rootPath, entry)
    await refreshTrash()
    await refreshTree()
    status.value = `已还原 ${entry.originalPath}`
  } catch (error) {
    emit('error', error instanceof Error ? error.message : String(error))
  } finally {
    busy.value = false
  }
}

function requestEmptyTrash() {
  confirmDialog.value = {
    mode: 'empty-trash',
    title: '清空回收站',
    message: '将永久删除本地回收站中的全部项目。回收站永不同步，此操作不可撤销。',
  }
}

function reloadExternal() {
  confirmDialog.value = {
    mode: 'external-reload',
    title: '加载磁盘版本',
    message: '将丢弃未保存的编辑，并用磁盘上的内容替换编辑器。',
  }
}

defineExpose({
  isDirty: () => dirty.value,
  save: saveCurrent,
  requestClose,
})
</script>

<template>
  <div class="workspace" :class="{ 'sidebar-collapsed': !sidebarOpen }">
    <aside v-show="sidebarOpen" class="sidebar" aria-label="库目录">
      <div class="sidebar-head">
        <div class="vault-title" :title="vault.rootPath">
          <strong>{{ vault.name }}</strong>
          <span>{{ vault.rootPath }}</span>
        </div>
        <div class="sidebar-actions">
          <button type="button" class="ghost compact" @click="createNoteRoot">新建笔记</button>
          <button type="button" class="ghost compact" @click="openCreateDir(null)">新建目录</button>
          <button type="button" class="ghost compact" @click="toggleTrashPanel">
            {{ showTrash ? '隐藏回收站' : '回收站' }}
          </button>
          <button type="button" class="ghost compact" @click="requestClose">切换库</button>
        </div>
        <label class="search-field">
          <span class="sr-only">搜索</span>
          <input
            v-model="searchQuery"
            type="search"
            placeholder="搜索标题与正文…"
            autocomplete="off"
          />
        </label>
      </div>

      <div v-if="searchQuery.trim()" class="search-results">
        <p v-if="searchBusy" class="empty-tree">搜索中…</p>
        <p v-else-if="!searchHits.length" class="empty-tree">无命中</p>
        <ul v-else class="hit-list">
          <li v-for="hit in searchHits" :key="hit.identityKey">
            <button
              type="button"
              class="hit-item"
              @click="openNote({ path: hit.path, identityKey: hit.identityKey, name: hit.title + '.md', kind: 'note' })"
            >
              <strong>{{ hit.title }}</strong>
              <span>{{ hit.snippet || hit.path }}</span>
            </button>
          </li>
        </ul>
      </div>

      <div v-else-if="showTrash" class="tree-scroll trash-panel">
        <div class="trash-head">
          <strong>本地回收站</strong>
          <button type="button" class="ghost compact danger-text" :disabled="!trashEntries.length" @click="requestEmptyTrash">
            清空
          </button>
        </div>
        <p class="empty-tree">回收站仅本机，永不同步（§6.4）。</p>
        <ul v-if="trashEntries.length" class="hit-list">
          <li v-for="entry in trashEntries" :key="entry.trashRel">
            <div class="trash-row">
              <div>
                <strong>{{ entry.originalPath }}</strong>
                <span>{{ entry.deletedAt }}</span>
              </div>
              <button type="button" class="ghost compact" :disabled="busy" @click="restoreEntry(entry)">还原</button>
            </div>
          </li>
        </ul>
        <p v-else class="empty-tree">回收站为空</p>
      </div>

      <div v-else class="tree-scroll">
        <VaultTree
          :nodes="tree"
          :selected-path="selectedPath"
          @open="openNote"
          @add-note="openCreateNote"
          @add-dir="openCreateDir"
          @rename="openRename"
          @remove="openDelete"
        />
        <p v-if="!tree.length" class="empty-tree">库内暂无笔记。可点「新建笔记」，或在文件夹中放入 <code>.md</code>。</p>
      </div>
    </aside>

    <section class="editor-pane" :class="{ editing: editorMode === 'edit' }">
      <header class="editor-toolbar">
        <button
          type="button"
          class="ghost compact"
          :aria-label="sidebarOpen ? '隐藏侧栏' : '显示侧栏'"
          @click="sidebarOpen = !sidebarOpen"
        >
          {{ sidebarOpen ? '隐藏侧栏' : '显示侧栏' }}
        </button>
        <div class="note-meta">
          <strong v-if="selectedPath">{{ noteTitle }}</strong>
          <span v-else>未打开笔记</span>
          <em v-if="dirty">未保存</em>
          <em v-else-if="status">{{ status }}</em>
        </div>
        <div class="toolbar-actions" v-if="selectedPath">
          <span class="mode-pill">{{ editorMode === 'preview' ? '预览' : '编辑' }}</span>
          <button v-if="editorMode === 'preview'" type="button" class="primary compact" @click="enterEdit">编辑</button>
          <template v-else>
            <button type="button" class="ghost compact" :disabled="busy || !dirty" @click="saveCurrent">保存</button>
            <button type="button" class="primary compact" :disabled="busy" @click="leaveEdit">完成</button>
          </template>
        </div>
      </header>

      <p v-if="externalNotice" class="external-banner" role="status">
        {{ externalNotice }}
        <button v-if="dirty" type="button" class="ghost compact" @click="reloadExternal">加载磁盘版本</button>
      </p>

      <div v-if="selectedPath" class="editor-body">
        <V5Editor
          v-model="content"
          locale="zh-CN"
          placeholder="开始写作…"
          :editable="editorMode === 'edit'"
        />
      </div>
      <div v-else class="editor-empty">
        <p>从左侧打开一篇笔记。打开后为预览；点「编辑」修改，切换回预览前会先保存。快捷键：⌘/Ctrl+S 保存，⌘/Ctrl+N 新建。</p>
      </div>
    </section>

    <NameDialog
      :open="!!nameDialog"
      :title="
        nameDialog?.mode === 'note'
          ? '新建笔记'
          : nameDialog?.mode === 'dir'
            ? '新建目录'
            : '重命名'
      "
      :label="nameDialog?.mode === 'dir' ? '目录名' : '名称'"
      :initial-value="
        nameDialog?.mode === 'rename' && nameDialog.target
          ? nameDialog.target.name.replace(/\.md$/i, '')
          : nameDialog?.mode === 'note'
            ? '未命名'
            : '新建文件夹'
      "
      :busy="busy"
      :error="nameDialog?.error"
      :submit-label="nameDialog?.mode === 'rename' ? '重命名' : '创建'"
      @cancel="nameDialog = null"
      @submit="submitName"
    />

    <ConfirmDialog
      :open="!!confirmDialog"
      :title="confirmDialog?.title || ''"
      :message="confirmDialog?.message || ''"
      :danger="confirmDialog?.mode === 'delete' || confirmDialog?.mode === 'empty-trash'"
      :confirm-label="
        confirmDialog?.mode === 'close-dirty'
          ? '保存并切换'
          : confirmDialog?.mode === 'external-reload'
            ? '加载磁盘版本'
            : '确认'
      "
      :busy="busy"
      @cancel="confirmDialog = null; pendingClose = false"
      @confirm="confirmAction"
    />
  </div>
</template>
