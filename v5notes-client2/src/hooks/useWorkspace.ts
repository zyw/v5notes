
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Editor } from '@v5md/view'
import { createApi, type Note, type NoteRevision, type NoteTrashItem, type TreeNode } from '../service/api'
import { ConflictError } from '../service/request'
import { Draft } from '../models/draft'
import { resolveDirty, type DirtyChoice } from './useDirtyNavigation'
import { setDirtyCheck, watchClose } from '../utils/window'
import { useProfile } from './useProfile'

export function useWorkspace() {
type DialogState =
  | { kind: 'name'; entity: 'note' | 'directory'; action: 'create' | 'rename'; title: string; parentId?: string; directory?: TreeNode }
  | { kind: 'confirm'; title: string; message: string; confirmLabel: string; danger: boolean; action: () => Promise<void> }

const clientId = import.meta.env.VITE_CLIENT_ID || 'd9df3c0228c05e5c61db46348bcadf6e'
const server = ref(localStorage.getItem('v5notes-server') || '')
const username = ref(localStorage.getItem('v5notes-username') || '')
const password = ref('')
const token = ref(localStorage.getItem('v5notes-token') || '')
const refreshToken = ref(localStorage.getItem('v5notes-refresh-token') || '')
const sessionExpired = ref(false)
const busy = ref(false)
const error = ref('')
const query = ref('')
const searching = ref(false)
const defaultDirectoryVisible = ref(localStorage.getItem('v5notes-default-directory-visible') !== 'false')
const directoryVisible = ref(defaultDirectoryVisible.value)
const defaultTreeExpanded = ref(localStorage.getItem('v5notes-default-tree-expanded') !== 'false')
const focusMode = ref(false)
const editorMode = ref<'preview' | 'edit'>('preview')
const sourceMode = ref(false)
const defaultOutlineVisible = ref(localStorage.getItem('v5notes-default-outline-visible') !== 'false')
const outlineVisible = ref(defaultOutlineVisible.value)
const sidebarSearchVisible = ref(false)
const workspaceMenuOpen = ref(false)
const settingsDialogOpen = ref(false)
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
const promptVisible = ref(false)
const historyOpen = ref(false)
const restoreTarget = ref<NoteRevision | null>(null)
const trashOpen = ref(false)
const trashRows = ref<NoteTrashItem[]>([])
const trashTotal = ref(0)
const trashPage = ref(1)
const notice = ref('')
const conflict = ref<null | { message: string; contentHash?: string; updateTime?: string; action: 'save' | 'restore'; revisionId?: string }>(null)
const dialog = ref<DialogState | null>(null)
const dialogValue = ref('')
const dialogError = ref('')
const dialogBusy = ref(false)
let answer: ((choice: DirtyChoice) => void) | undefined
let loadSequence = 0
let unwatchClose: (() => void) | undefined
let unlistenTrayExit: (() => void) | undefined

const api = createApi(
  () => ({ server: server.value, clientId, token: token.value, refreshToken: refreshToken.value }),
  () => {
    sessionExpired.value = true
    refreshToken.value = ''
    localStorage.removeItem('v5notes-token')
    localStorage.removeItem('v5notes-refresh-token')
  },
  fetch,
  (accessToken: string, newRefreshToken: string) => {
    token.value = accessToken
    refreshToken.value = newRefreshToken
    localStorage.setItem('v5notes-token', accessToken)
    localStorage.setItem('v5notes-refresh-token', newRefreshToken)
  },
)
const {
  currentUser, profileDialogOpen, profileBusy, avatarBusy, profileError,
  profileAvatarUrl, profileForm, refreshProfile, openProfile,
  uploadProfileAvatar, removeProfileAvatar, saveProfile,
} = useProfile(api)
const content = computed({
  get: () => draft.note?.content ?? '',
  set: (value: string) => draft.edit(value),
})

function report(cause: unknown): void {
  error.value = cause instanceof Error ? cause.message : '请求失败'
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

function openSettings(): void {
  settingsDialogOpen.value = true
}

function setDefaultOutlineVisible(visible: boolean): void {
  defaultOutlineVisible.value = visible
  outlineVisible.value = visible
  localStorage.setItem('v5notes-default-outline-visible', String(visible))
}

function setDefaultDirectoryVisible(visible: boolean): void {
  defaultDirectoryVisible.value = visible
  directoryVisible.value = visible
  localStorage.setItem('v5notes-default-directory-visible', String(visible))
}

function setDefaultTreeExpanded(expanded: boolean): void {
  defaultTreeExpanded.value = expanded
  localStorage.setItem('v5notes-default-tree-expanded', String(expanded))
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
  const all = Array.from(document.querySelectorAll<HTMLDetailsElement>('.workspace-menu, .action-menu, .tree-menu, .profile-menu'))
  const focusedPopover = event instanceof KeyboardEvent ? null : target?.closest('details.workspace-menu, details.action-menu, details.tree-menu, details.profile-menu')
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

function requestDelete(title: string, message: string, confirmLabel: string, action: () => Promise<void>, danger = true): void {
  dialogError.value = ''
  dialog.value = { kind: 'confirm', title, message, confirmLabel, danger, action }
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
        if (draft.dirty) {
          const saved = await persistDraft()
          if (!saved) {
            if (conflict.value) dialog.value = null
            else throw new Error('笔记内容保存失败，请重试后再重命名')
            return
          }
        }
        if (name === draft.note.name) {
          dialog.value = null
          return
        }
        const renamed = { ...draft.note, name }
        const saved = await api.update(renamed)
        draft.note = { ...renamed, contentHash: saved.contentHash || renamed.contentHash }
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
    if (showConflict(cause, 'save')) dialog.value = null
    else if (dialog.value?.kind === 'name') dialogError.value = cause instanceof Error ? cause.message : '操作失败，请重试'
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
  if (!editing) sourceMode.value = false
  const source = editing && sourceMode.value
  instance.setSourceMode(source)
  instance.setToolbarVisible(editing && !source)
  // The workspace has its own outline sidebar. Keep the editor's built-in
  // outline disabled independently of that sidebar's visibility.
  instance.setOutlineVisible(false)
  instance.setEditable(editing)
}

function toggleSourceMode(): void {
  if (editorMode.value !== 'edit') return
  sourceMode.value = !sourceMode.value
  applyEditorMode()
  editorInstance.value?.focus()
}

function editorReady(instance: Editor): void {
  editorInstance.value = instance
  applyEditorMode(instance)
}

watch(editorMode, () => applyEditorMode(), { flush: 'post' })

function chooseDirectory(id: string): void {
  trashOpen.value = false
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
    refreshToken.value = result.refresh_token || ''
    password.value = ''
    sessionExpired.value = false
    localStorage.setItem('v5notes-server', server.value)
    localStorage.setItem('v5notes-username', username.value)
    localStorage.setItem('v5notes-token', result.access_token)
    if (result.refresh_token) localStorage.setItem('v5notes-refresh-token', result.refresh_token)
    else localStorage.removeItem('v5notes-refresh-token')
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
  try {
    const allowed = await resolveDirty(draft, choose, note => api.update(note))
    if (!allowed && !promptVisible.value && !conflict.value) error.value = '未保存：请重试保存或继续编辑'
    return allowed
  } catch (cause) {
    if (showConflict(cause, 'save')) return false
    error.value = '未保存：请重试保存或继续编辑'
    return false
  }
}

async function openNote(id: string, skipGuard = false, initialMode: 'preview' | 'edit' = 'preview'): Promise<void> {
  if (id === selectedId.value) {
    trashOpen.value = false
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
    trashOpen.value = false
    editorInstance.value = null
    draft.load(note)
    sourceMode.value = false
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

function showConflict(cause: unknown, action: 'save' | 'restore', revisionId?: string): boolean {
  if (!(cause instanceof ConflictError)) return false
  conflict.value = { message: cause.message, contentHash: cause.contentHash, updateTime: cause.updateTime, action, revisionId }
  return true
}

async function persistDraft(force = false): Promise<boolean> {
  try {
    await draft.save(note => api.update(note, force))
    return !draft.dirty
  } catch (cause) {
    if (!force && showConflict(cause, 'save')) return false
    report(cause)
    return false
  }
}

async function save(): Promise<void> {
  if (await persistDraft()) {
    try { await refreshDirectories() } catch (cause) { report(cause) }
  }
}

async function finishEditing(): Promise<void> {
  if (draft.dirty) {
    if (!(await persistDraft())) return
    try { await refreshDirectories() } catch (cause) { report(cause) }
  }
  editorMode.value = 'preview'
}

async function openHistory(): Promise<void> {
  if (draft.dirty && !(await persistDraft())) return
  historyOpen.value = true
}

async function reloadSelectedNote(): Promise<void> {
  const id = selectedId.value
  if (!id) return
  const mode = editorMode.value
  const note = await api.read(id)
  draft.load(note)
  editorMode.value = mode
}

async function reloadAfterConflict(): Promise<void> {
  if (draft.dirty) {
    const choice = await choose()
    if (choice === 'cancel') return
    if (choice === 'save' && !(await persistDraft())) return
  }
  conflict.value = null
  historyOpen.value = false
  restoreTarget.value = null
  try { await reloadSelectedNote() } catch (cause) { report(cause) }
}

async function overwriteConflict(): Promise<void> {
  const current = conflict.value
  if (!current || !draft.note) return
  try {
    if (current.action === 'restore' && current.revisionId) {
      const restored = await api.restoreRevision(draft.note.id, current.revisionId, draft.note.contentHash ?? '', true)
      draft.load({ ...draft.note, content: restored.content, contentHash: restored.contentHash, updateTime: restored.updateTime })
      historyOpen.value = false
      restoreTarget.value = null
    } else if (!(await persistDraft(true))) {
      return
    }
    conflict.value = null
  } catch (cause) {
    if (showConflict(cause, current.action, current.revisionId)) return
    report(cause)
  }
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
  requestDelete('删除笔记', `「${note.name}」将移到回收站，30 天内可以恢复。`, '移到回收站', async () => {
    if (!(await mayLeave())) return
    await api.remove(note.id)
    localStorage.removeItem('v5notes-last-note')
    selectedId.value = ''
    editorInstance.value = null
    draft.clear()
    try { await refreshDirectories(); await refreshNotes() } catch (cause) { report(cause) }
  }, false)
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
  requestDelete('删除目录', `「${dir.label}」及其子目录和笔记会移到回收站，30 天内可以恢复。此前单独删除的内容仍留在各自的记录里。`, '移到回收站', async () => {
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
  }, false)
}

function nodeVisible(id: string, type: number, nodes: TreeNode[] = directories.value): boolean {
  for (const node of nodes) {
    if (node.type === type && node.id === id) return true
    if (node.children && nodeVisible(id, type, node.children)) return true
  }
  return false
}

function clearMissingSelection(): void {
  if (selectedDir.value !== '0' && !nodeVisible(selectedDir.value, 1)) {
    selectedDir.value = '0'
    localStorage.setItem('v5notes-last-dir', '0')
  }
  if (draft.note && !nodeVisible(draft.note.id, 2)) {
    selectedId.value = ''
    editorInstance.value = null
    draft.clear()
    localStorage.removeItem('v5notes-last-note')
  }
}

async function loadTrash(): Promise<void> {
  const page = await api.trash(trashPage.value)
  trashRows.value = page?.rows ?? []
  trashTotal.value = page?.total ?? 0
  if (!trashRows.value.length && trashPage.value > 1) {
    trashPage.value -= 1
    const previous = await api.trash(trashPage.value)
    trashRows.value = previous?.rows ?? []
    trashTotal.value = previous?.total ?? 0
  }
}

async function openTrash(): Promise<void> {
  if (!(await mayLeave())) return
  historyOpen.value = false
  restoreTarget.value = null
  notice.value = ''
  trashPage.value = 1
  trashOpen.value = true
  try { await loadTrash() } catch (cause) { report(cause) }
}

async function changeTrashPage(page: number): Promise<void> {
  trashPage.value = page
  try { await loadTrash() } catch (cause) { report(cause) }
}

function restoreTrashItem(item: NoteTrashItem): void {
  requestDelete('恢复', `恢复「${item.name}」以及这次一起删除的内容。`, '恢复', async () => {
    const restored = await api.restoreTrash(item.id)
    notice.value = restored.relocated ? '原目录已不在，已恢复到根目录' : ''
    trashOpen.value = false
    try {
      await refreshDirectories()
      if (restored.objectType === '1') await openNote(restored.objectId, true)
      else {
        selectedId.value = ''
        editorInstance.value = null
        draft.clear()
        localStorage.removeItem('v5notes-last-note')
        selectedDir.value = restored.objectId
        localStorage.setItem('v5notes-last-dir', restored.objectId)
      }
    } catch (cause) { report(cause) }
  }, false)
}

function purgeTrashItem(item: NoteTrashItem): void {
  requestDelete('彻底删除', `彻底删除「${item.name}」后，正文版本会一并清除，且无法再恢复。`, '彻底删除', async () => {
    await api.purgeTrash(item.id)
    try {
      await refreshDirectories()
      clearMissingSelection()
      await loadTrash()
    } catch (cause) { report(cause) }
  })
}

function emptyTrash(): void {
  requestDelete('清空回收站', '将永久删除回收站中的全部笔记、目录和正文版本。', '清空回收站', async () => {
    const result = await api.emptyTrash()
    try {
      await refreshDirectories()
      clearMissingSelection()
      trashPage.value = 1
      await loadTrash()
    } catch (cause) { report(cause) }
    if (result?.failed) error.value = `${result.failed} 条清除失败`
  })
}

async function logout(): Promise<void> {
  if (!(await mayLeave())) return
  requestDelete('退出登录', '确定退出当前账号吗？退出后需要重新登录。', '退出登录', async () => {
  token.value = ''
  refreshToken.value = ''
  currentUser.value = null
  localStorage.removeItem('v5notes-token')
  localStorage.removeItem('v5notes-refresh-token')
  localStorage.removeItem('v5notes-last-note')
  localStorage.removeItem('v5notes-last-dir')
  selectedId.value = ''
  editorInstance.value = null
  selectedDir.value = '0'
  draft.clear()
  notes.value = []
  trashOpen.value = false
  trashRows.value = []
  notice.value = ''
  directoryVisible.value = defaultDirectoryVisible.value
  focusMode.value = false
  })
}

function reauthenticate(): void {
  localStorage.removeItem('v5notes-token')
  localStorage.removeItem('v5notes-refresh-token')
  token.value = ''
  refreshToken.value = ''
  sessionExpired.value = false
}

function keydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (settingsDialogOpen.value) settingsDialogOpen.value = false
    else if (conflict.value) conflict.value = null
    else if (restoreTarget.value) restoreTarget.value = null
    else if (historyOpen.value) historyOpen.value = false
    else if (dialog.value && !dialogBusy.value) closeDialog()
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


return { clientId, server, username, password, token, refreshToken, sessionExpired, busy, error, query, searching, directoryVisible, defaultDirectoryVisible, defaultTreeExpanded, focusMode, editorMode, sourceMode, toggleSourceMode, outlineVisible, defaultOutlineVisible, sidebarSearchVisible, workspaceMenuOpen, settingsDialogOpen, activeActionMenu, sidebarWidth, resizingSidebar, selectedDir, selectedId, total, directories, notes, draft, editorInstance, promptVisible, dialog, dialogValue, dialogError, dialogBusy, answer, loadSequence, unwatchClose, unlistenTrayExit, api, content, report, resizeSidebarStart, toggleSidebar, openSettings, setDefaultDirectoryVisible, setDefaultTreeExpanded, setDefaultOutlineVisible, syncActionMenu, closePopovers, openNameDialog, closeDialog, requestDelete, submitNameDialog, confirmDialog, collectDirectoryIds, applyEditorMode, editorReady, chooseDirectory, login, restoreSession, refreshDirectories, refreshNotes, choose, respond, mayLeave, openNote, save, finishEditing, openHistory, historyOpen, restoreTarget, conflict, reloadAfterConflict, overwriteConflict, runSearch, newNote, addNoteInDirectory, copyNoteContent, openTreeNoteActions, deleteNote, renameNote, addDirectory, editDirectory, deleteDirectory, logout, reauthenticate, keydown, trashOpen, trashRows, trashTotal, trashPage, notice, openTrash, changeTrashPage, restoreTrashItem, purgeTrashItem, emptyTrash, currentUser, profileDialogOpen, profileBusy, avatarBusy, profileError, profileAvatarUrl, profileForm, refreshProfile, openProfile, uploadProfileAvatar, removeProfileAvatar, saveProfile }
}
