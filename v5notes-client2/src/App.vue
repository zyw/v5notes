<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Editor } from '@v5md/view'
import { createApi, type Note, type TreeNode } from './api'
import { Draft } from './draft'
import { resolveDirty, type DirtyChoice } from './navigation'
import { setDirtyCheck, watchClose } from './window'
import TreeItem from './TreeItem.vue'
import TreeIcon from './TreeIcon.vue'
import brandIcon from './assets/brand-icon.png'

type DialogState =
  | { kind: 'name'; entity: 'note' | 'directory'; action: 'create' | 'rename'; title: string; parentId?: string; directory?: TreeNode }
  | { kind: 'confirm'; title: string; message: string; confirmLabel: string; action: () => Promise<void> }

const clientId = import.meta.env.VITE_CLIENT_ID || 'd9df3c0228c05e5c61db46348bcadf6e'
const server = ref(localStorage.getItem('v5notes-server') || '')
const username = ref(localStorage.getItem('v5notes-username') || '')
const password = ref('')
const token = ref(localStorage.getItem('v5notes-token') || '')
const sessionExpired = ref(false)
const busy = ref(false)
const error = ref('')
const query = ref('')
const searching = ref(false)
const directoryVisible = ref(true)
const focusMode = ref(false)
const editorMode = ref<'preview' | 'edit'>('preview')
const selectedDir = ref(localStorage.getItem('v5notes-last-dir') || '0')
const selectedId = ref('')
const total = ref(0)
const directories = ref<TreeNode[]>([])
const notes = ref<Note[]>([])
const draft = reactive(new Draft())
const editorInstance = shallowRef<Editor | null>(null)
const editorHost = ref<HTMLElement | null>(null)
const promptVisible = ref(false)
const dialog = ref<DialogState | null>(null)
const dialogValue = ref('')
const dialogError = ref('')
const dialogBusy = ref(false)
let answer: ((choice: DirtyChoice) => void) | undefined
let loadSequence = 0
let unwatchClose: (() => void) | undefined
let unlistenTrayExit: (() => void) | undefined

const api = createApi(
  () => ({ server: server.value, clientId, token: token.value }),
  () => {
    sessionExpired.value = true
    localStorage.removeItem('v5notes-token')
  },
)
const content = computed({
  get: () => draft.note?.content ?? '',
  set: (value: string) => draft.edit(value),
})

function report(cause: unknown): void {
  error.value = cause instanceof Error ? cause.message : '请求失败'
}

function openNameDialog(entity: 'note' | 'directory', action: 'create' | 'rename', initialValue = '', parentId = '0', directory?: TreeNode): void {
  dialogValue.value = initialValue
  dialogError.value = ''
  dialog.value = {
    kind: 'name', entity, action,
    title: `${action === 'create' ? '新建' : '重命名'}${entity === 'note' ? '笔记' : '目录'}`,
    parentId, directory,
  }
}

function closeDialog(): void {
  if (dialogBusy.value) return
  dialog.value = null
  dialogError.value = ''
}

function requestDelete(title: string, message: string, confirmLabel: string, action: () => Promise<void>): void {
  dialogError.value = ''
  dialog.value = { kind: 'confirm', title, message, confirmLabel, action }
}

async function submitNameDialog(): Promise<void> {
  const current = dialog.value
  if (!current || current.kind !== 'name' || dialogBusy.value) return
  const name = dialogValue.value.trim()
  if (!name) {
    dialogError.value = '请输入名称'
    return
  }
  if (name.length > 100) {
    dialogError.value = '名称不能超过 100 个字符'
    return
  }

  dialogBusy.value = true
  dialogError.value = ''
  try {
    if (current.entity === 'note') {
      if (current.action === 'create') {
        const dirId = current.parentId || '0'
        const id = await api.create({ name, dirId, content: '' })
        dialog.value = null
        try { await refreshDirectories() } catch (cause) { report(cause) }
        await openNote(id, true, 'edit')
      } else if (draft.note) {
        if (draft.dirty) await draft.save(api.update)
        if (draft.dirty) throw new Error('笔记内容保存失败，请重试后再重命名')
        if (name === draft.note.name) {
          dialog.value = null
          return
        }
        const renamed = { ...draft.note, name }
        await api.update(renamed)
        draft.note = renamed
        dialog.value = null
        try { await refreshDirectories() } catch (cause) { report(cause) }
      }
    } else if (current.action === 'create') {
      await api.addDirectory(name, current.parentId || '0')
      dialog.value = null
      try { await refreshDirectories() } catch (cause) { report(cause) }
    } else if (current.directory) {
      if (name === current.directory.label) {
        dialog.value = null
        return
      }
      await api.renameDirectory(current.directory.id, name, current.directory.pid)
      dialog.value = null
      try { await refreshDirectories() } catch (cause) { report(cause) }
    }
  } catch (cause) {
    if (dialog.value?.kind === 'name') dialogError.value = cause instanceof Error ? cause.message : '操作失败，请重试'
    else report(cause)
  } finally {
    dialogBusy.value = false
  }
}

async function confirmDialog(): Promise<void> {
  const current = dialog.value
  if (!current || current.kind !== 'confirm') return
  dialog.value = null
  try { await current.action() } catch (cause) {
    dialog.value = current
    dialogError.value = cause instanceof Error ? cause.message : '操作失败，请重试'
  }
}

function collectDirectoryIds(node: TreeNode): Set<string> {
  const ids = new Set([node.id])
  for (const child of node.children || []) {
    for (const id of collectDirectoryIds(child)) ids.add(id)
  }
  return ids
}

function applyEditorMode(instance = editorInstance.value): void {
  if (!instance) return
  const editing = editorMode.value === 'edit'
  instance.setToolbarVisible(editing)
  instance.setOutlineVisible(editing)
  const element = editorHost.value?.querySelector<HTMLElement>('.v5md-host')
  if (!element) return
  element.contentEditable = editing ? 'true' : 'false'
  element.classList.toggle('is-preview', !editing)
}

function editorReady(instance: Editor): void {
  editorInstance.value = instance
  applyEditorMode(instance)
}

watch(editorMode, () => applyEditorMode(), { flush: 'post' })

function chooseDirectory(id: string): void {
  selectedDir.value = id
  localStorage.setItem('v5notes-last-dir', id)
}

async function login(): Promise<void> {
  error.value = ''
  busy.value = true
  try {
    const parsed = new URL(server.value)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('请输入 HTTP 或 HTTPS 服务器地址')
    const sameAccount = localStorage.getItem('v5notes-server')?.replace(/\/+$/, '') === server.value.replace(/\/+$/, '')
      && localStorage.getItem('v5notes-username') === username.value
    if (!sameAccount && draft.note) {
      requestDelete('切换账号', '当前仍保留上一账号的笔记草稿。继续切换会清除这份草稿，避免内容进入其他账号。', '清除草稿并切换', async () => {
        selectedId.value = ''
        draft.clear()
        localStorage.removeItem('v5notes-last-note')
        localStorage.removeItem('v5notes-last-dir')
        selectedDir.value = '0'
        await login()
      })
      return
    }
    await api.ping()
    const result = await api.login(username.value, password.value)
    if (!sameAccount) {
      localStorage.removeItem('v5notes-last-note')
      localStorage.removeItem('v5notes-last-dir')
      selectedDir.value = '0'
    }
    token.value = result.access_token
    password.value = ''
    sessionExpired.value = false
    localStorage.setItem('v5notes-server', server.value)
    localStorage.setItem('v5notes-username', username.value)
    localStorage.setItem('v5notes-token', result.access_token)
    await Promise.all([refreshDirectories(), refreshNotes()])
    const lastNoteId = localStorage.getItem('v5notes-last-note')
    if (lastNoteId) await openNote(lastNoteId, true)
  } catch (cause) { report(cause) } finally { busy.value = false }
}

async function restoreSession(): Promise<void> {
  if (!token.value) return
  try {
    await Promise.all([refreshDirectories(), refreshNotes()])
    const lastNoteId = localStorage.getItem('v5notes-last-note')
    if (lastNoteId) await openNote(lastNoteId, true)
  } catch (cause) { report(cause) }
}

async function refreshDirectories(): Promise<void> {
  directories.value = await api.tree()
}

async function refreshNotes(): Promise<void> {
  if (!searching.value || !query.value.trim()) {
    notes.value = []
    total.value = 0
    return
  }
  notes.value = await api.search(query.value.trim())
  total.value = notes.value.length
}

function choose(): Promise<DirtyChoice> {
  promptVisible.value = true
  return new Promise(resolve => { answer = resolve })
}

function respond(choice: DirtyChoice): void {
  promptVisible.value = false
  answer?.(choice)
  answer = undefined
}

async function mayLeave(): Promise<boolean> {
  const allowed = await resolveDirty(draft, choose, api.update)
  if (!allowed && !promptVisible.value) error.value = '未保存：请重试保存或继续编辑'
  return allowed
}

async function openNote(id: string, skipGuard = false, initialMode: 'preview' | 'edit' = 'preview'): Promise<void> {
  if (id === selectedId.value) {
    if (initialMode === 'edit') editorMode.value = 'edit'
    else await finishEditing()
    if (window.innerWidth <= 700) directoryVisible.value = false
    return
  }
  if (!skipGuard && !(await mayLeave())) return
  const current = ++loadSequence
  error.value = ''
  try {
    const note = await api.read(id)
    if (current !== loadSequence) return
    editorInstance.value = null
    draft.load(note)
    selectedId.value = note.id
    selectedDir.value = note.dirId
    localStorage.setItem('v5notes-last-dir', note.dirId)
    localStorage.setItem('v5notes-last-note', note.id)
    editorMode.value = initialMode
    if (window.innerWidth <= 700) directoryVisible.value = false
  } catch (cause) {
    if (current === loadSequence) {
      if (localStorage.getItem('v5notes-last-note') === id) localStorage.removeItem('v5notes-last-note')
      report(cause)
    }
  }
}

async function save(): Promise<void> {
  try {
    await draft.save(api.update)
    if (!draft.dirty) await refreshDirectories()
  } catch (cause) { report(cause) }
}

async function finishEditing(): Promise<void> {
  if (draft.dirty) {
    try {
      await draft.save(api.update)
      if (draft.dirty) return
      try { await refreshDirectories() } catch (cause) { report(cause) }
    } catch (cause) {
      report(cause)
      return
    }
  }
  editorMode.value = 'preview'
}

async function runSearch(): Promise<void> {
  searching.value = Boolean(query.value.trim())
  try { await refreshNotes() } catch (cause) { report(cause) }
}

async function newNote(): Promise<void> {
  if (!(await mayLeave())) return
  openNameDialog('note', 'create', '', selectedDir.value === '1' ? '0' : selectedDir.value)
}

function deleteNote(): void {
  const note = draft.note
  if (!note) return
  requestDelete('删除笔记', `确定删除“${note.name}”？删除后无法恢复。`, '删除笔记', async () => {
    if (!(await mayLeave())) return
    await api.remove(note.id)
    localStorage.removeItem('v5notes-last-note')
    selectedId.value = ''
    editorInstance.value = null
    draft.clear()
    try { await refreshDirectories(); await refreshNotes() } catch (cause) { report(cause) }
  })
}

function renameNote(): void {
  if (!draft.note) return
  openNameDialog('note', 'rename', draft.note.name)
}

function addDirectory(pid = '0'): void {
  openNameDialog('directory', 'create', '', pid)
}

function editDirectory(dir: TreeNode): void {
  openNameDialog('directory', 'rename', dir.label, dir.pid, dir)
}

function deleteDirectory(dir: TreeNode): void {
  requestDelete('删除目录', `删除“${dir.label}”会同时删除其所有子目录和笔记，此操作无法撤销。`, '删除目录', async () => {
    if (!(await mayLeave())) return
    await api.removeDirectory(dir.id)
    const removedIds = collectDirectoryIds(dir)
    if (removedIds.has(selectedDir.value)) {
      selectedDir.value = '0'
      localStorage.setItem('v5notes-last-dir', '0')
    }
    if (draft.note && removedIds.has(draft.note.dirId)) {
      selectedId.value = ''
      editorInstance.value = null
      draft.clear()
      localStorage.removeItem('v5notes-last-note')
    }
    try { await Promise.all([refreshDirectories(), refreshNotes()]) } catch (cause) { report(cause) }
  })
}

async function logout(): Promise<void> {
  if (!(await mayLeave())) return
  token.value = ''
  localStorage.removeItem('v5notes-token')
  localStorage.removeItem('v5notes-last-note')
  localStorage.removeItem('v5notes-last-dir')
  selectedId.value = ''
  editorInstance.value = null
  selectedDir.value = '0'
  draft.clear()
  notes.value = []
  directoryVisible.value = true
  focusMode.value = false
}

function reauthenticate(): void {
  localStorage.removeItem('v5notes-token')
  token.value = ''
  sessionExpired.value = false
}

function keydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (dialog.value && !dialogBusy.value) closeDialog()
    else if (promptVisible.value) respond('cancel')
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void save()
  }
}

onMounted(async () => {
  setDirtyCheck(() => draft.dirty)
  window.addEventListener('keydown', keydown)
  unwatchClose = await watchClose(mayLeave)
  if ('__TAURI_INTERNALS__' in window) {
    unlistenTrayExit = await listen('app-exit-requested', async () => {
      if (await mayLeave()) await invoke('exit_app')
    })
  }
  await restoreSession()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', keydown)
  unwatchClose?.()
  unlistenTrayExit?.()
  if (answer) respond('cancel')
})
</script>

<template>
  <div v-if="!token" class="login-screen">
    <div class="login-copy">
      <span class="eyebrow">V5 / NOTES</span>
      <h1>把想法<br />留在这里。</h1>
      <p>连接你的笔记空间，继续写作。</p>
    </div>
    <form class="login-card" @submit.prevent="login">
      <span class="eyebrow">连接工作区</span>
      <label>服务器地址<input v-model.trim="server" type="url" placeholder="https://notes.example.com" required /></label>
      <label>用户名<input v-model.trim="username" autocomplete="username" required /></label>
      <label>密码<input v-model="password" type="password" autocomplete="current-password" required /></label>
      <button class="primary" :disabled="busy">{{ busy ? '正在连接…' : '进入笔记' }}</button>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
    </form>
  </div>

  <div v-else class="workspace" :class="{ 'directory-hidden': !directoryVisible || focusMode, 'focus-mode': focusMode }">
    <aside v-show="directoryVisible && !focusMode" class="sidebar">
      <div class="brand">
        <img class="brand-mark" :src="brandIcon" alt="" />
        <span>v5 notes</span>
      </div>
      <form class="search" @submit.prevent="runSearch">
        <input v-model="query" placeholder="搜索笔记…" aria-label="搜索笔记" />
        <button title="搜索笔记" aria-label="搜索笔记">⌕</button>
      </form>
      <div class="tree-heading">
        <span>{{ searching ? '搜索结果' : '笔记' }}</span>
        <div>
          <button type="button" title="新建根目录" aria-label="新建根目录" @click="addDirectory()">＋目录</button>
          <button type="button" title="新建笔记" aria-label="新建笔记" @click="newNote">＋笔记</button>
        </div>
      </div>
      <div v-if="searching" class="tree-scroll search-results">
        <button v-for="note in notes" :key="note.id" class="search-result" :class="{ active: selectedId === note.id }" @click="openNote(note.id)">
          <TreeIcon kind="note" /><span>{{ note.name }}</span>
        </button>
        <p v-if="!notes.length" class="empty-list">没有找到匹配的笔记。</p>
      </div>
      <div v-else class="tree-scroll">
        <TreeItem
          v-for="node in directories" :key="node.id" :node="node" :selected-id="selectedId"
          @select="openNote" @directory="chooseDirectory" @add="addDirectory" @rename="editDirectory" @remove="deleteDirectory"
        />
        <p v-if="!directories.length" class="empty-list">还没有目录或笔记。</p>
      </div>
      <footer class="sidebar-footer"><button type="button" @click="logout">退出登录</button><span>Markdown 笔记</span></footer>
    </aside>

    <main class="editor-pane">
      <div v-if="sessionExpired" class="session-alert">登录已过期；草稿仍在当前窗口。请重新登录后保存。<button @click="reauthenticate">重新登录</button></div>
      <div v-if="error" class="error-bar" role="alert">{{ error }} <button @click="error = ''">×</button></div>
      <template v-if="draft.note">
        <header class="editor-header">
          <div class="editor-toolbar-left">
            <button class="toolbar-icon" :aria-pressed="directoryVisible && !focusMode" aria-label="切换目录栏" title="切换目录栏" @click="directoryVisible = !directoryVisible">☷</button>
            <span class="breadcrumb"><span>{{ focusMode ? '专注写作' : '笔记' }}</span><span aria-hidden="true">/</span><strong>{{ draft.note.name }}</strong></span>
          </div>
          <div class="actions">
            <template v-if="editorMode === 'preview'">
              <span class="mode-label">预览</span>
              <span v-if="draft.dirty" class="save-state unsaved"><i />未保存</span>
              <button class="primary edit-button" @click="editorMode = 'edit'">编辑</button>
            </template>
            <template v-else>
              <span class="mode-label">编辑</span>
              <span class="save-state" :class="{ unsaved: draft.dirty }"><i />{{ draft.dirty ? '未保存' : '已保存' }}</span>
              <button class="quiet-action" @click="renameNote">重命名</button>
              <button class="quiet-action" @click="deleteNote">删除</button>
              <button class="focus-toggle" :aria-pressed="focusMode" @click="focusMode = !focusMode">{{ focusMode ? '退出专注' : '专注写作' }}</button>
              <button class="quiet-action" @click="finishEditing">预览</button>
              <button class="primary save-button" :disabled="!draft.dirty" @click="save">保存 <kbd>⌘S / Ctrl+S</kbd></button>
            </template>
          </div>
        </header>
        <div class="editor-scroll" :class="{ 'preview-scroll': editorMode === 'preview', 'edit-scroll': editorMode === 'edit' }">
          <div class="editor-paper">
            <div ref="editorHost" class="editor-mount">
              <V5Editor :key="selectedId" v-model="content" placeholder="开始编写…" :on-upload-image="api.upload" :on-ready="editorReady" />
            </div>
          </div>
        </div>
      </template>
      <div v-else class="empty-editor">
        <span class="empty-mark">✳</span><p class="eyebrow">V5 NOTES</p><h2>选择一篇笔记开始阅读</h2><p>从左侧目录树打开笔记。笔记默认以预览模式显示，需要修改时再进入编辑。</p>
        <div class="empty-actions"><button class="primary" @click="newNote">新建笔记</button><button class="secondary-action" @click="directoryVisible = true">显示目录</button></div>
      </div>
    </main>
  </div>

  <div v-if="dialog" class="modal-backdrop" role="presentation" @click.self="closeDialog">
    <section class="modal crud-modal" role="dialog" aria-modal="true" :aria-label="dialog.title">
      <form v-if="dialog.kind === 'name'" @submit.prevent="submitNameDialog">
        <span class="eyebrow">{{ dialog.entity === 'note' ? 'NOTE' : 'FOLDER' }}</span>
        <h2>{{ dialog.title }}</h2>
        <label class="dialog-field">
          <span>{{ dialog.entity === 'note' ? '笔记名称' : '目录名称' }}</span>
          <input v-model="dialogValue" autofocus maxlength="100" :placeholder="dialog.entity === 'note' ? '输入笔记名称' : '输入目录名称'" />
        </label>
        <p v-if="dialogError" class="dialog-error" role="alert">{{ dialogError }}</p>
        <div class="modal-actions">
          <button type="button" :disabled="dialogBusy" @click="closeDialog">取消</button>
          <button class="primary" type="submit" :disabled="dialogBusy">{{ dialogBusy ? '正在保存…' : '保存' }}</button>
        </div>
      </form>
      <template v-else>
        <span class="eyebrow danger-eyebrow">请确认操作</span>
        <h2>{{ dialog.title }}</h2>
        <p>{{ dialog.message }}</p>
        <p v-if="dialogError" class="dialog-error" role="alert">{{ dialogError }}</p>
        <div class="modal-actions">
          <button type="button" @click="closeDialog">取消</button>
          <button class="danger-button" type="button" @click="confirmDialog">{{ dialog.confirmLabel }}</button>
        </div>
      </template>
    </section>
  </div>

  <div v-if="promptVisible" class="modal-backdrop" role="presentation">
    <div class="modal" role="dialog" aria-modal="true" aria-label="未保存的笔记">
      <span class="eyebrow">未保存的修改</span>
      <h2>要保留这次编辑吗？</h2>
      <p>保存成功后继续；保存失败时会留在当前笔记。</p>
      <div class="modal-actions"><button @click="respond('cancel')">继续编辑</button><button @click="respond('discard')">放弃修改</button><button class="primary" @click="respond('save')">保存并继续</button></div>
    </div>
  </div>
</template>
