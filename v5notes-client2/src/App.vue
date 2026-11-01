<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { createApi, type Note, type TreeNode } from './api'
import { Draft } from './draft'
import { resolveDirty, type DirtyChoice } from './navigation'
import { setDirtyCheck, watchClose } from './window'
import DirectoryItem from './DirectoryItem.vue'

const clientId = import.meta.env.VITE_CLIENT_ID || 'd9df3c0228c05e5c61db46348bcadf6e'
const server = ref(localStorage.getItem('v5notes-server') || '')
const username = ref('')
const password = ref('')
const token = ref('')
const sessionExpired = ref(false)
const busy = ref(false)
const error = ref('')
const query = ref('')
const searching = ref(false)
const directoryVisible = ref(true)
const listVisible = ref(true)
const focusMode = ref(false)
const selectedDir = ref('0')
const selectedId = ref('')
const page = ref(1)
const total = ref(0)
const directories = ref<TreeNode[]>([])
const notes = ref<Note[]>([])
const draft = reactive(new Draft())
const promptVisible = ref(false)
let answer: ((choice: DirtyChoice) => void) | undefined
let loadSequence = 0
let unwatchClose: (() => void) | undefined
let unlistenTrayExit: (() => void) | undefined
let listAutoCollapsed = false

const api = createApi(
  () => ({ server: server.value, clientId, token: token.value }),
  () => { sessionExpired.value = true },
)
const content = computed({
  get: () => draft.note?.content ?? '',
  set: (value: string) => draft.edit(value),
})

function report(cause: unknown): void {
  error.value = cause instanceof Error ? cause.message : '请求失败'
}

function syncListForWindow(): void {
  if (!token.value) return
  if (window.innerWidth <= 980 && listVisible.value) {
    listVisible.value = false
    listAutoCollapsed = true
  } else if (window.innerWidth > 980 && listAutoCollapsed) {
    listVisible.value = true
    listAutoCollapsed = false
  }
}

function toggleList(): void {
  listVisible.value = !listVisible.value
  listAutoCollapsed = false
}

async function login(): Promise<void> {
  error.value = ''
  busy.value = true
  try {
    const parsed = new URL(server.value)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('请输入 HTTP 或 HTTPS 服务器地址')
    await api.ping()
    const result = await api.login(username.value, password.value)
    token.value = result.access_token
    syncListForWindow()
    password.value = ''
    sessionExpired.value = false
    localStorage.setItem('v5notes-server', server.value)
    await Promise.all([refreshDirectories(), refreshNotes()])
  } catch (cause) { report(cause) } finally { busy.value = false }
}

async function refreshDirectories(): Promise<void> {
  directories.value = await api.tree()
}

async function refreshNotes(): Promise<void> {
  const result = searching.value && query.value.trim()
    ? { rows: await api.search(query.value.trim()), total: 0 }
    : selectedDir.value === '1' ? await api.recent() : await api.list(selectedDir.value, page.value)
  notes.value = result.rows
  total.value = result.total
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

async function openNote(id: string, skipGuard = false): Promise<void> {
  if (id === selectedId.value || (!skipGuard && !(await mayLeave()))) return
  const current = ++loadSequence
  error.value = ''
  try {
    const note = await api.read(id)
    if (current !== loadSequence) return
    draft.load(note)
    selectedId.value = note.id
  } catch (cause) { if (current === loadSequence) report(cause) }
}

async function selectDirectory(id: string): Promise<void> {
  if (selectedDir.value === id || !(await mayLeave())) return
  ++loadSequence
  selectedDir.value = id
  selectedId.value = ''
  draft.clear()
  searching.value = false
  page.value = 1
  try { await refreshNotes() } catch (cause) { report(cause) }
}

async function save(): Promise<void> {
  try {
    await draft.save(api.update)
    if (!draft.dirty) await refreshNotes()
  } catch (cause) { report(cause) }
}

async function runSearch(): Promise<void> {
  searching.value = Boolean(query.value.trim())
  page.value = 1
  try { await refreshNotes() } catch (cause) { report(cause) }
}

async function newNote(): Promise<void> {
  if (!(await mayLeave())) return
  const name = window.prompt('笔记名称')
  if (!name?.trim()) return
  try {
    const id = await api.create({ name: name.trim(), dirId: selectedDir.value === '1' ? '0' : selectedDir.value, content: '' })
    await refreshNotes()
    await openNote(id, true)
  } catch (cause) { report(cause) }
}

async function deleteNote(): Promise<void> {
  if (!draft.note || !window.confirm(`删除笔记“${draft.note.name}”？此操作不可撤销。`)) return
  if (!(await mayLeave())) return
  try {
    await api.remove(draft.note.id)
    selectedId.value = ''
    draft.clear()
    await refreshNotes()
  } catch (cause) { report(cause) }
}

async function renameNote(): Promise<void> {
  if (!draft.note) return
  const name = window.prompt('笔记名称', draft.note.name)
  if (!name?.trim() || name.trim() === draft.note.name) return
  try {
    await draft.save(api.update)
    if (draft.dirty) return
    await api.update({ ...draft.note, name: name.trim() })
    draft.note = { ...draft.note, name: name.trim() }
    await refreshNotes()
  } catch (cause) { report(cause) }
}

async function addDirectory(pid = '0'): Promise<void> {
  const name = window.prompt('目录名称')
  if (!name?.trim()) return
  try {
    await api.addDirectory(name.trim(), pid)
    await refreshDirectories()
  } catch (cause) { report(cause) }
}

async function editDirectory(dir: TreeNode): Promise<void> {
  const name = window.prompt('重命名目录', dir.label)
  if (!name?.trim() || name.trim() === dir.label) return
  try {
    await api.renameDirectory(dir.id, name.trim(), dir.pid)
    await refreshDirectories()
  } catch (cause) { report(cause) }
}

async function deleteDirectory(dir: TreeNode): Promise<void> {
  if (!window.confirm(`删除“${dir.label}”及其所有子目录和笔记？此操作不可撤销。`)) return
  if (!(await mayLeave())) return
  try {
    await api.removeDirectory(dir.id)
    if (selectedDir.value === dir.id) {
      selectedDir.value = '0'
      selectedId.value = ''
      draft.clear()
    }
    await Promise.all([refreshDirectories(), refreshNotes()])
  } catch (cause) { report(cause) }
}

async function logout(): Promise<void> {
  if (!(await mayLeave())) return
  token.value = ''
  selectedId.value = ''
  draft.clear()
  notes.value = []
}

function keydown(event: KeyboardEvent): void {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void save()
  }
}

onMounted(async () => {
  setDirtyCheck(() => draft.dirty)
  window.addEventListener('keydown', keydown)
  window.addEventListener('resize', syncListForWindow)
  unwatchClose = await watchClose(mayLeave)
  if ('__TAURI_INTERNALS__' in window) {
    unlistenTrayExit = await listen('app-exit-requested', async () => {
      if (await mayLeave()) await invoke('exit_app')
    })
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', keydown)
  window.removeEventListener('resize', syncListForWindow)
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

  <div v-else class="workspace" :class="{ 'directory-hidden': !directoryVisible || focusMode, 'list-hidden': !listVisible || focusMode, 'focus-mode': focusMode }">
    <aside v-show="directoryVisible && !focusMode" class="sidebar">
      <div class="brand"><span class="brand-mark">v5</span> notes <button title="退出登录" @click="logout">退出</button></div>
      <button :class="{ active: selectedDir === '0' }" @click="selectDirectory('0')">全部笔记</button>
      <button :class="{ active: selectedDir === '1' }" @click="selectDirectory('1')">最近更新</button>
      <div class="section-title">目录 <button title="新建根目录" @click="addDirectory()">＋</button></div>
      <DirectoryItem
        v-for="dir in directories" :key="dir.id" :node="dir" :selected-id="selectedDir"
        @select="selectDirectory" @add="addDirectory" @rename="editDirectory" @remove="deleteDirectory"
      />
    </aside>

    <section v-show="listVisible && !focusMode" class="list-pane">
      <header><span class="eyebrow">LIBRARY</span><button class="new" @click="newNote">＋ 新笔记</button></header>
      <form class="search" @submit.prevent="runSearch">
        <input v-model="query" placeholder="搜索笔记…" aria-label="搜索笔记" />
        <button title="搜索">⌕</button>
      </form>
      <div class="list-heading">{{ searching ? '搜索结果' : selectedDir === '1' ? '最近更新' : '笔记' }} <small>{{ total || notes.length }}</small></div>
      <div class="note-list">
        <button v-for="note in notes" :key="note.id" class="note-row" :class="{ active: selectedId === note.id }" @click="openNote(note.id)">
          <span class="note-icon">≡</span><span><strong>{{ note.name }}</strong><small>{{ note.updateTime || 'Markdown 笔记' }}</small></span>
        </button>
        <p v-if="!notes.length" class="empty-list">这里还没有笔记。</p>
      </div>
      <footer v-if="total > 30"><button :disabled="page <= 1" @click="page--; refreshNotes()">上一页</button><span>{{ page }}</span><button :disabled="page * 30 >= total" @click="page++; refreshNotes()">下一页</button></footer>
    </section>

    <main class="editor-pane">
      <div v-if="sessionExpired" class="session-alert">登录已过期；草稿仍在当前窗口。请重新登录后保存。<button @click="token = ''">重新登录</button></div>
      <div v-if="error" class="error-bar" role="alert">{{ error }} <button @click="error = ''">×</button></div>
      <template v-if="draft.note">
        <header class="editor-header">
          <div class="editor-toolbar-left">
            <button class="toolbar-icon" :aria-pressed="directoryVisible && !focusMode" aria-label="切换目录栏" title="切换目录栏" @click="directoryVisible = !directoryVisible">☷</button>
            <button class="toolbar-icon" :aria-pressed="listVisible && !focusMode" aria-label="切换笔记列表" title="切换笔记列表" @click="toggleList">☰</button>
            <span class="breadcrumb">{{ focusMode ? '专注写作' : '笔记' }} <span aria-hidden="true">/</span> <strong>{{ draft.note.name }}</strong></span>
          </div>
          <div class="actions">
            <span class="save-state" :class="{ unsaved: draft.dirty }"><i />{{ draft.dirty ? '未保存' : '已保存' }}</span>
            <button class="quiet-action" @click="renameNote">重命名</button>
            <button class="quiet-action" @click="deleteNote">删除</button>
            <button class="focus-toggle" :aria-pressed="focusMode" @click="focusMode = !focusMode">{{ focusMode ? '退出专注' : '专注写作' }}</button>
            <button class="primary save-button" :disabled="!draft.dirty" @click="save">保存 <kbd>⌘S / Ctrl+S</kbd></button>
          </div>
        </header>
        <div class="editor-scroll"><div class="editor-paper"><h1 class="note-title">{{ draft.note.name }}</h1><V5Editor :key="selectedId" v-model="content" placeholder="开始编写…" :on-upload-image="api.upload" /></div></div>
      </template>
      <div v-else class="empty-editor">
        <span class="empty-mark">✳</span><p class="eyebrow">V5 NOTES</p><h2>让思绪有处安放</h2><p>打开一篇笔记继续写作，或从一个新的空白页开始。</p>
        <div class="empty-actions"><button class="primary" @click="listVisible = true">浏览笔记</button><button class="secondary-action" @click="newNote">新建笔记</button></div>
      </div>
    </main>
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
