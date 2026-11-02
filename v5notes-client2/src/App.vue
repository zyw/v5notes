<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Editor } from '@v5md/view'
import { createApi, type Note, type TreeNode, type UserProfile, type UserProfileUpdate } from './api'
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
const currentUser = ref<UserProfile | null>(null)
const profileDialogOpen = ref(false)
const profileBusy = ref(false)
const avatarBusy = ref(false)
const profileError = ref('')
const profileAvatarUrl = ref('')
const profileForm = reactive<UserProfileUpdate>({ userId: '', userName: '', nickName: '', avatar: '', sex: '0' })
const sessionExpired = ref(false)
const busy = ref(false)
const error = ref('')
const query = ref('')
const searching = ref(false)
const directoryVisible = ref(true)
const focusMode = ref(false)
const editorMode = ref<'preview' | 'edit'>('preview')
const outlineVisible = ref(true)
const sidebarSearchVisible = ref(false)
const workspaceMenuOpen = ref(false)
const activeActionMenu = ref<'note' | 'view' | null>(null)
const sidebarWidth = ref(Number(localStorage.getItem('v5notes-sidebar-width')) || 286)
const resizingSidebar = ref(false)
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

async function refreshProfile(): Promise<void> {
  currentUser.value = await api.userInfo()
}

function openProfile(): void {
  if (!currentUser.value) return
  Object.assign(profileForm, {
    userId: currentUser.value.userId,
    deptId: currentUser.value.deptId,
    userType: currentUser.value.userType,
    userName: currentUser.value.userName,
    nickName: currentUser.value.nickName || '',
    phonenumber: currentUser.value.phonenumber || '',
    email: currentUser.value.email || '',
    sex: currentUser.value.sex || '0',
    remark: currentUser.value.remark || '',
    avatar: currentUser.value.avatarId || '',
  })
  profileAvatarUrl.value = currentUser.value.avatarUrl || ''
  profileError.value = ''
  profileDialogOpen.value = true
}

async function uploadProfileAvatar(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  profileError.value = ''
  if (!file.type.startsWith('image/')) {
    profileError.value = '请选择图片文件'
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    profileError.value = '头像不能超过 2 MB'
    return
  }
  avatarBusy.value = true
  try {
    const uploaded = await api.uploadProfileImage(file)
    profileForm.avatar = uploaded.id
    profileAvatarUrl.value = uploaded.url
  } catch (cause) {
    profileError.value = cause instanceof Error ? cause.message : '头像上传失败，请重试'
  } finally {
    avatarBusy.value = false
  }
}

function removeProfileAvatar(): void {
  profileForm.avatar = ''
  profileAvatarUrl.value = ''
}

async function saveProfile(): Promise<void> {
  if (profileBusy.value) return
  profileError.value = ''
  profileForm.nickName = profileForm.nickName.trim()
  profileForm.phonenumber = profileForm.phonenumber?.trim() || ''
  profileForm.email = profileForm.email?.trim() || ''
  if (!profileForm.nickName) {
    profileError.value = '昵称不能为空'
    return
  }
  if (profileForm.nickName.length > 30) {
    profileError.value = '昵称不能超过 30 个字符'
    return
  }
  if (profileForm.phonenumber && !/^1[3-9]\d{9}$/.test(profileForm.phonenumber)) {
    profileError.value = '请输入有效的手机号码'
    return
  }
  if (profileForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email)) {
    profileError.value = '请输入有效的邮箱地址'
    return
  }
  profileBusy.value = true
  try {
    await api.updateUserProfile({ ...profileForm })
    await refreshProfile()
    profileDialogOpen.value = false
  } catch (cause) {
    profileError.value = cause instanceof Error ? cause.message : '保存个人信息失败，请重试'
  } finally {
    profileBusy.value = false
  }
}

function resizeSidebarStart(event: PointerEvent): void {
  if (window.innerWidth <= 700) return
  resizingSidebar.value = true
  const move = (moveEvent: PointerEvent) => {
    if (!resizingSidebar.value) return
    sidebarWidth.value = Math.max(220, Math.min(480, moveEvent.clientX))
  }
  const stop = () => {
    resizingSidebar.value = false
    localStorage.setItem('v5notes-sidebar-width', String(sidebarWidth.value))
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', stop)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop, { once: true })
  event.preventDefault()
}

function toggleSidebar(): void {
  if (focusMode.value) {
    focusMode.value = false
    directoryVisible.value = true
    return
  }
  directoryVisible.value = !directoryVisible.value
}

function syncActionMenu(name: 'note' | 'view', event: Event): void {
  const opened = (event.currentTarget as HTMLDetailsElement).open
  activeActionMenu.value = opened ? name : activeActionMenu.value === name ? null : activeActionMenu.value
  document.querySelectorAll<HTMLDetailsElement>('.action-menu').forEach((menu) => {
    if (menu !== event.currentTarget) menu.open = false
  })
}

function closePopovers(event: PointerEvent | KeyboardEvent | FocusEvent): void {
  if (event instanceof KeyboardEvent && event.key !== 'Escape') return
  const target = event.target as Element | null
  const all = Array.from(document.querySelectorAll<HTMLDetailsElement>('.workspace-menu, .action-menu, .tree-menu'))
  const focusedPopover = event instanceof KeyboardEvent ? null : target?.closest('details.workspace-menu, details.action-menu, details.tree-menu')
  for (const menu of all) {
    if (menu !== focusedPopover) menu.open = false
  }
  const actionMenu = focusedPopover?.getAttribute('data-action-menu')
  activeActionMenu.value = actionMenu === 'note' || actionMenu === 'view' ? actionMenu : null
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
  instance.setOutlineVisible(outlineVisible.value)
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
    await Promise.all([refreshDirectories(), refreshNotes(), refreshProfile()])
    const lastNoteId = localStorage.getItem('v5notes-last-note')
    if (lastNoteId) await openNote(lastNoteId, true)
  } catch (cause) { report(cause) } finally { busy.value = false }
}

async function restoreSession(): Promise<void> {
  if (!token.value) return
  try {
    await Promise.all([refreshDirectories(), refreshNotes(), refreshProfile()])
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

async function addNoteInDirectory(id: string): Promise<void> {
  if (!(await mayLeave())) return
  openNameDialog('note', 'create', '', id)
}

async function copyNoteContent(): Promise<void> {
  try {
    await navigator.clipboard.writeText(draft.note?.content || '')
  } catch {
    error.value = '无法访问剪贴板，请检查浏览器权限'
  }
}

async function openTreeNoteActions(id: string, action: 'rename' | 'delete' = 'rename'): Promise<void> {
  await openNote(id)
  if (selectedId.value !== id) return
  if (action === 'rename') renameNote()
  if (action === 'delete') deleteNote()
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
  requestDelete('退出登录', '确定退出当前账号吗？退出后需要重新登录。', '退出登录', async () => {
  token.value = ''
  currentUser.value = null
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
  })
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
  document.addEventListener('pointerdown', closePopovers)
  document.addEventListener('focusin', closePopovers)
  document.addEventListener('keydown', closePopovers)
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
  document.removeEventListener('pointerdown', closePopovers)
  document.removeEventListener('focusin', closePopovers)
  document.removeEventListener('keydown', closePopovers)
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

  <div v-else class="workspace" :class="{ 'directory-hidden': focusMode, 'sidebar-collapsed': !directoryVisible && !focusMode, 'focus-mode': focusMode, 'is-resizing': resizingSidebar }" :style="{ '--sidebar-width': `${sidebarWidth}px` }">
    <aside class="sidebar">
      <div v-if="directoryVisible && !focusMode" class="sidebar-full">
      <div class="brand">
        <img class="brand-mark" :src="brandIcon" alt="" />
        <span>V5Notes</span>
      </div>
      <div class="tree-heading">
        <span v-if="!sidebarSearchVisible">笔记</span>
        <Transition name="inline-search">
        <form v-if="sidebarSearchVisible" class="search search-inline" @submit.prevent="runSearch">
          <span class="search-symbol" aria-hidden="true"><svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg></span>
          <input v-model="query" autofocus placeholder="搜索笔记名称" aria-label="搜索笔记" @input="runSearch" />
          <button type="button" title="关闭搜索" aria-label="关闭搜索" @click="query = ''; searching = false; notes = []; sidebarSearchVisible = false">×</button>
        </form>
        </Transition>
        <div class="workspace-controls">
          <button v-if="!sidebarSearchVisible" type="button" title="搜索" aria-label="搜索" @click="sidebarSearchVisible = true"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.4 4.4"/></svg></button>
          <details class="workspace-menu" :open="workspaceMenuOpen" @toggle="workspaceMenuOpen = ($event.target as HTMLDetailsElement).open">
            <summary title="笔记操作" aria-label="笔记操作"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/></svg></summary>
            <div class="popover-menu">
              <button type="button" @click="addDirectory(); workspaceMenuOpen = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 6h5.8L10 8h7.5v8H2.5zM13.5 3v5M11 5.5h5"/></svg>新建目录</button>
              <button type="button" @click="newNote(); workspaceMenuOpen = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2.5h6l4 4V17H5zM11 2.8v4h3.7M8 10h4M8 13h4M16.5 12v5M14 14.5h5"/></svg>新建笔记</button>
            </div>
          </details>
          <button type="button" title="新建目录" aria-label="新建目录" @click="addDirectory()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5h6l2 2H20a1 1 0 0 1 1 1v7.8a1.7 1.7 0 0 1-1.7 1.7H4.7A1.7 1.7 0 0 1 3 18.3V8a.5.5 0 0 1 .5-.5Z"/><path d="M16.5 3.5v6M13.5 6.5h6"/></svg></button>
        </div>
      </div>
      <div v-if="searching" class="tree-heading search-heading"><span>搜索结果</span><button @click="searching = false; query = ''">清除</button></div>
      <div v-if="searching" class="tree-scroll search-results">
        <button v-for="note in notes" :key="note.id" class="search-result" :class="{ active: selectedId === note.id }" :title="note.name" @click="openNote(note.id)">
          <TreeIcon kind="note" /><span>{{ note.name }}</span>
        </button>
        <p v-if="!notes.length" class="empty-list">没有找到匹配的笔记。</p>
      </div>
      <div v-else class="tree-scroll">
        <TreeItem
          v-for="node in directories" :key="node.id" :node="node" :selected-id="selectedId"
          @select="openNote" @directory="chooseDirectory" @add="addDirectory" @rename="editDirectory" @remove="deleteDirectory"
          @add-note="addNoteInDirectory" @note-open="(id) => openNote(id)"
          @note-rename="(id) => openTreeNoteActions(id, 'rename')" @note-delete="(id) => openTreeNoteActions(id, 'delete')"
        />
        <p v-if="!directories.length" class="empty-list">还没有目录或笔记。</p>
      </div>
      <footer class="sidebar-footer">
        <button class="profile-trigger" type="button" :disabled="!currentUser" @click="openProfile" title="个人信息">
          <span class="profile-avatar"><img v-if="currentUser?.avatarUrl" :src="currentUser.avatarUrl" alt="" /><span v-else>{{ currentUser?.nickName?.slice(0, 1) || username.slice(0, 1) || 'U' }}</span></span>
          <span class="profile-trigger-name">{{ currentUser?.nickName || username }}</span>
        </button>
        <button class="logout-action" type="button" @click="logout">退出登录</button>
      </footer>
      <div class="sidebar-resize" role="separator" aria-label="调整侧栏宽度" aria-orientation="vertical" @pointerdown="resizeSidebarStart" />
      </div>
      <div v-else-if="!focusMode" class="sidebar-rail">
        <button class="rail-brand" type="button" aria-label="展开笔记栏" title="展开笔记栏" @click="directoryVisible = true"><img class="brand-mark" :src="brandIcon" alt="V5Notes" /></button>
        <button class="rail-notes" type="button" aria-label="展开笔记栏" @click="directoryVisible = true"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14"/><circle cx="5" cy="5" r=".7"/><circle cx="5" cy="10" r=".7"/><circle cx="5" cy="15" r=".7"/></svg><span>笔记</span></button>
        <div class="rail-spacer" />
        <button class="rail-profile" type="button" :disabled="!currentUser" aria-label="个人信息" title="个人信息" @click="openProfile"><span class="profile-avatar"><img v-if="currentUser?.avatarUrl" :src="currentUser.avatarUrl" alt="" /><span v-else>{{ currentUser?.nickName?.slice(0, 1) || username.slice(0, 1) || 'U' }}</span></span></button>
      </div>
    </aside>

    <main class="editor-pane">
      <div v-if="sessionExpired" class="session-alert">登录已过期；草稿仍在当前窗口。请重新登录后保存。<button @click="reauthenticate">重新登录</button></div>
      <div v-if="error" class="error-bar" role="alert">{{ error }} <button @click="error = ''">×</button></div>
      <template v-if="draft.note">
        <header class="editor-header">
          <div class="editor-toolbar-left">
            <button class="toolbar-icon sidebar-toggle" :aria-pressed="directoryVisible && !focusMode" :aria-label="directoryVisible ? '收起侧栏' : '展开侧栏'" :title="directoryVisible ? '收起侧栏' : '展开侧栏'" @click="toggleSidebar">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M9 4v16"/><path v-if="directoryVisible" d="m15 9-3 3 3 3"/><path v-else d="m12 9 3 3-3 3"/></svg>
            </button>
            <span class="breadcrumb"><span>{{ focusMode ? '专注写作' : '笔记' }}</span><span aria-hidden="true">/</span><strong>{{ draft.note.name }}</strong></span>
          </div>
          <div class="actions">
            <template v-if="editorMode === 'preview'">
              <span class="mode-label">预览</span>
              <span v-if="draft.dirty" class="save-state unsaved"><i />未保存</span>
              <button class="quiet-action" :aria-pressed="outlineVisible" @click="outlineVisible = !outlineVisible; editorInstance?.setOutlineVisible(outlineVisible)">{{ outlineVisible ? '隐藏大纲' : '显示大纲' }}</button>
              <button class="primary edit-button" @click="editorMode = 'edit'">编辑</button>
            </template>
            <template v-else>
              <span class="mode-label">编辑</span>
              <span class="save-state" :class="{ unsaved: draft.dirty }"><i />{{ draft.dirty ? '未保存' : '已保存' }}</span>
              <details class="action-menu" data-action-menu="note" :open="activeActionMenu === 'note'" @toggle="syncActionMenu('note', $event)"><summary>笔记操作</summary><div class="popover-menu" @click="activeActionMenu = null"><button @click="renameNote"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.8 3.2 4 4M3 17l3.8-.8L16 7a1.4 1.4 0 0 0-2-2L4.8 14.2z"/></svg>重命名</button><button @click="copyNoteContent"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="6" width="10" height="11" rx="1.5"/><path d="M13 6V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"/></svg>复制内容</button><button class="danger-menu-item" @click="deleteNote"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 5.5h13M8 5.5V3.5h4v2M5.5 5.5l.8 11h7.4l.8-11M8.5 8.5v5M11.5 8.5v5"/></svg>删除笔记</button></div></details>
              <details class="action-menu" data-action-menu="view" :open="activeActionMenu === 'view'" @toggle="syncActionMenu('view', $event)"><summary>视图</summary><div class="popover-menu" @click="activeActionMenu = null"><button @click="outlineVisible = !outlineVisible; editorInstance?.setOutlineVisible(outlineVisible)"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h2M8 5h9M3 10h2M8 10h9M3 15h2M8 15h9"/></svg>{{ outlineVisible ? '隐藏大纲' : '显示大纲' }}</button><button @click="focusMode = !focusMode"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4"/></svg>{{ focusMode ? '退出专注' : '专注写作' }}</button><button @click="finishEditing"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 10s2.7-5 7.5-5 7.5 5 7.5 5-2.7 5-7.5 5-7.5-5-7.5-5Z"/><circle cx="10" cy="10" r="2"/></svg>预览模式</button></div></details>
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

  <div v-if="profileDialogOpen" class="modal-backdrop profile-backdrop" role="presentation" @click.self="profileDialogOpen = false">
    <section class="modal crud-modal profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title" @keydown.esc.stop="profileDialogOpen = false">
      <form @submit.prevent="saveProfile">
        <span class="eyebrow">ACCOUNT</span>
        <h2 id="profile-title">个人信息</h2>
        <div class="profile-avatar-editor">
          <span class="profile-avatar profile-avatar-large"><img v-if="profileAvatarUrl" :src="profileAvatarUrl" alt="个人头像预览" /><span v-else>{{ profileForm.nickName.slice(0, 1) || 'U' }}</span></span>
          <div class="avatar-actions">
            <label class="secondary-action avatar-select" :class="{ disabled: avatarBusy }">{{ avatarBusy ? '正在上传…' : '更换头像' }}<input type="file" accept="image/*" :disabled="avatarBusy" @change="uploadProfileAvatar" /></label>
            <button v-if="profileAvatarUrl || profileForm.avatar" class="quiet-action" type="button" @click="removeProfileAvatar">移除</button>
            <span class="avatar-hint">支持 JPG、PNG、GIF，最大 2 MB</span>
          </div>
        </div>
        <div class="profile-fields">
          <label class="profile-field"><span>用户名</span><input :value="profileForm.userName" disabled /></label>
          <label class="profile-field"><span>昵称</span><input v-model="profileForm.nickName" maxlength="30" required /></label>
          <label class="profile-field"><span>手机号码</span><input v-model="profileForm.phonenumber" maxlength="11" inputmode="tel" /></label>
          <label class="profile-field"><span>邮箱</span><input v-model="profileForm.email" maxlength="50" type="email" /></label>
          <fieldset class="profile-field profile-sex"><legend>性别</legend><label><input v-model="profileForm.sex" type="radio" value="0" />男</label><label><input v-model="profileForm.sex" type="radio" value="1" />女</label><label><input v-model="profileForm.sex" type="radio" value="2" />保密</label></fieldset>
          <label class="profile-field"><span>签名</span><textarea v-model="profileForm.remark" rows="2" maxlength="200" placeholder="添加一句个人签名" /></label>
        </div>
        <p v-if="profileError" class="dialog-error" role="alert">{{ profileError }}</p>
        <div class="modal-actions"><button type="button" :disabled="profileBusy" @click="profileDialogOpen = false">取消</button><button class="primary" type="submit" :disabled="profileBusy || avatarBusy">{{ profileBusy ? '正在保存…' : '保存' }}</button></div>
      </form>
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
