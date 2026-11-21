<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { listMatches, type FindOptions, type OutlineEntry } from '@v5md/core'
import type { EditorSession } from '@v5notes/vault-plugin-api'
import brandIcon from '../assets/brand-icon.png'
import AttachmentPickerDialog from '../components/AttachmentPickerDialog.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import EditorModeDock from '../components/EditorModeDock.vue'
import EditorPalette from '../components/EditorPalette.vue'
import {
  DEFAULT_FONT_SIZE,
  buildEditorCommands,
  modeChipLabel,
  buildPluginCommands,
  clampFontSize,
  modeSwitchLabel,
  type CommandActions,
  type CommandContext,
  type EditorCommand,
  type EditorMode,
  type ExportFormat,
} from '../models/editorCommands'
import { useEditorTheme } from '../editor/useEditorTheme'
import {
  EXPORT_HTML_THEME,
  buildMarkdownDocument,
  buildRenderedDocument,
  exportFileName,
  renderNotePdf,
  renderNotePng,
  rewriteImageSources,
  snapshotRenderedHtml,
} from '../vault/exportFile'
import { saveExportFile, type FileFilter } from '../vault/fileSave'
import NameDialog from '../components/NameDialog.vue'
import MoveDialog, { type MoveTargetOption } from '../components/MoveDialog.vue'
import TreeIcon from '../components/TreeIcon.vue'
import { closeTreeMenu } from '../components/treeMenu'
import VaultTree from '../components/VaultTree.vue'
import { normalizeVaultPath, VaultPathError } from '../path/identity'
import {
  MARKDOWN_KIND,
  displayNameOfIn,
  docKindById,
  docKindOfPath,
  docKindOfPathIn,
  initialContentFor,
  type DocKindSpec,
} from '../vault/docKinds'
import { APPEARANCE_REL } from '../vault/skeleton'
import {
  attachmentUrlText,
  deleteVaultAttachment,
  importImageFileToVault,
  listVaultAttachments,
  saveImageToVault,
  vaultAssetUrl,
  type VaultAttachment,
} from '../vault/attachments'
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
import { applyVaultColorForPath, resolveVaultColor, type VaultColorSwatch } from '../appearance/vaultColors'
import {
  docKindsRevision,
  getActiveEditorProvider,
  listDocKinds,
  listHostRibbons,
  setExtensionNoticeHandler,
  setExtensionWorkspaceHandlers,
  attachExtensionRuntimeVault,
  getPluginHost,
  listHostCommands,
  startExtensionRuntime,
} from '../extension/runtime'
import type { HostRibbon } from '../plugin-host'
import { join } from '@tauri-apps/api/path'
import { writeTextFile } from '@tauri-apps/plugin-fs'

const props = defineProps<{
  vault: OpenedVault
}>()

const emit = defineEmits<{
  close: []
  error: [message: string]
  dirtyChange: [dirty: boolean]
  settings: []
}>()

const tree = ref<VaultTreeNode[]>([])
const selectedPath = ref<string | null>(null)
const content = ref('')
const savedContent = ref('')
/** Preview is read-only; edit either renders the note or shows its Markdown source. */
const editorMode = ref<EditorMode>('preview')
const sourceMode = ref(false)
const busy = ref(false)
const status = ref('')
const sidebarOpen = ref(true)
const SIDEBAR_WIDTH_KEY = 'v5notes.vault.sidebar-width.v1'
const sidebarWidth = ref(readSidebarWidth())
const resizingSidebar = ref(false)
const externalNotice = ref<string | null>(null)
/* ---------- 附件选择对话框（编辑器工具栏「图片」入口） ---------- */
const attachmentPickerRef = ref<InstanceType<typeof AttachmentPickerDialog> | null>(null)
const attachmentOpen = ref(false)
const attachmentBusy = ref(false)
const attachmentList = ref<VaultAttachment[]>([])
/** Attachments the open note references — stale rows warn that a delete broke them. */
const referencedAttachments = computed(() => {
  const refs = new Set<string>()
  const pattern = /!\[[^\]]*\]\(([^)\s]+)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(content.value)) !== null) {
    const raw = match[1]
    if (!raw) continue
    try {
      const rel = decodeURIComponent(raw)
      if (rel.startsWith('attachments/') || rel.startsWith('附件/')) refs.add(rel)
    } catch {
      /* leave malformed links untracked */
    }
  }
  return refs
})

function clampSidebarWidth(width: number): number {
  return Math.max(220, Math.min(480, Math.round(width)))
}

function readSidebarWidth(): number {
  const raw = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY))
  if (!Number.isFinite(raw)) return 286
  return clampSidebarWidth(raw)
}

function persistSidebarWidth(): void {
  localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth.value))
}

function resizeSidebarStart(event: PointerEvent): void {
  if (window.innerWidth <= 800) return
  resizingSidebar.value = true
  const move = (moveEvent: PointerEvent) => {
    if (!resizingSidebar.value) return
    sidebarWidth.value = clampSidebarWidth(moveEvent.clientX)
  }
  const stop = () => {
    resizingSidebar.value = false
    persistSidebarWidth()
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', stop)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop, { once: true })
  event.preventDefault()
}

function keyboardResizeSidebar(event: KeyboardEvent): void {
  if (window.innerWidth <= 800) return
  const step = event.shiftKey ? 24 : 12
  if (event.key === 'ArrowLeft') {
    sidebarWidth.value = clampSidebarWidth(sidebarWidth.value - step)
    persistSidebarWidth()
    event.preventDefault()
  } else if (event.key === 'ArrowRight') {
    sidebarWidth.value = clampSidebarWidth(sidebarWidth.value + step)
    persistSidebarWidth()
    event.preventDefault()
  }
}

const searchQuery = ref('')
const searchHits = ref<SearchHit[]>([])
const searchBusy = ref(false)
const searchOpen = ref(false)
const searchInput = ref<HTMLInputElement | null>(null)
const showTrash = ref(false)
const trashEntries = ref<TrashEntry[]>([])
const pluginRibbons = ref<HostRibbon[]>([])

type NoteGroup = 'tree' | 'list'
type NoteSort = 'name' | 'updated'
const NOTE_VIEW_KEY = 'v5notes.vault.note-view.v1'
const NOTE_RECENCY_KEY = 'v5notes.vault.note-recency.v1'

function readViewPrefs(): { group: NoteGroup; sort: NoteSort } {
  try {
    const raw = localStorage.getItem(NOTE_VIEW_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { group?: string; sort?: string }
      return {
        group: parsed.group === 'list' ? 'list' : 'tree',
        sort: parsed.sort === 'updated' ? 'updated' : 'name',
      }
    }
  } catch {
    /* ignore */
  }
  return { group: 'tree', sort: 'name' }
}

function readRecency(): Record<string, number> {
  try {
    const raw = localStorage.getItem(NOTE_RECENCY_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, number> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

const initialView = readViewPrefs()
const noteGroup = ref<NoteGroup>(initialView.group)
const noteSort = ref<NoteSort>(initialView.sort)
const noteRecency = ref<Record<string, number>>(readRecency())
const sidebarMenuOpen = ref(false)

watch([noteGroup, noteSort], () => {
  try {
    localStorage.setItem(
      NOTE_VIEW_KEY,
      JSON.stringify({ group: noteGroup.value, sort: noteSort.value }),
    )
  } catch {
    /* ignore */
  }
})

const recencyPrefix = computed(() => `${props.vault.rootPath}::`)

function recencyOf(path: string): number {
  return noteRecency.value[`${recencyPrefix.value}${path}`] ?? 0
}

function touchNoteRecency(path: string) {
  const key = `${recencyPrefix.value}${path}`
  noteRecency.value = { ...noteRecency.value, [key]: Date.now() }
  try {
    localStorage.setItem(NOTE_RECENCY_KEY, JSON.stringify(noteRecency.value))
  } catch {
    /* ignore */
  }
}

function nameCompare(a: VaultTreeNode, b: VaultTreeNode): number {
  return a.name.localeCompare(b.name, 'zh')
}

function sortTree(nodes: VaultTreeNode[]): VaultTreeNode[] {
  const dirs = nodes.filter(node => node.kind === 'dir').sort(nameCompare)
  const entries = nodes.filter(node => node.kind !== 'dir')
  entries.sort((a, b) => {
    if (noteSort.value === 'updated') {
      const diff = recencyOf(b.path) - recencyOf(a.path)
      if (diff !== 0) return diff
    }
    return nameCompare(a, b)
  })
  return [
    ...dirs.map(dir => ({
      ...dir,
      children: dir.children ? sortTree(dir.children) : undefined,
    })),
    ...entries,
  ]
}

const orderedTree = computed(() => sortTree(tree.value))
const flatNotes = computed(() => {
  const out: VaultTreeNode[] = []
  const walk = (nodes: VaultTreeNode[]) => {
    for (const node of nodes) {
      if (node.kind === 'dir') walk(node.children ?? [])
      else if (node.kind === 'note') out.push(node)
    }
  }
  walk(tree.value)
  out.sort((a, b) => {
    if (noteSort.value === 'updated') {
      const diff = recencyOf(b.path) - recencyOf(a.path)
      if (diff !== 0) return diff
    }
    return nameCompare(a, b)
  })
  return out
})

function toggleSidebarMenu() {
  sidebarMenuOpen.value = !sidebarMenuOpen.value
  if (sidebarMenuOpen.value) closeTreeMenu()
}

function chooseGroup(group: NoteGroup) {
  noteGroup.value = group
}

function chooseSort(sort: NoteSort) {
  noteSort.value = sort
}

function createFromSidebar(mode: 'note' | 'dir') {
  sidebarMenuOpen.value = false
  if (mode === 'note') createNoteRoot()
  else openCreateDir(null)
}

function onTreeAddNote(payload: { parent: VaultTreeNode | null; docKind?: string }) {
  openCreateNote(payload.parent, payload.docKind ?? creatableKinds.value[0]?.id ?? MARKDOWN_KIND)
}

function createFromSidebarKind(docKind: string) {
  sidebarMenuOpen.value = false
  createMenuOpen.value = false
  openCreateNote(null, docKind)
}

const editorMountEl = ref<HTMLElement | null>(null)
const editorSession = shallowRef<EditorSession | null>(null)
let mountedEditorId: string | null = null
let applyingFromEditor = false
const outlineOpen = ref(true)
const outlineTab = ref<'outline' | 'find'>('outline')
const outlineEntries = ref<OutlineEntry[]>([])
const findQuery = ref('')
const findHits = ref<FindHitView[]>([])
const findStatus = ref('')
const findCurrent = ref(-1)
const findInput = ref<HTMLInputElement | null>(null)
const replaceExpanded = ref(false)
const replacement = ref('')
const caseSensitive = ref(false)
const wholeWord = ref(false)
const useRegexp = ref(false)
const findOptions = computed<FindOptions>(() => ({
  caseSensitive: caseSensitive.value,
  wholeWord: wholeWord.value,
  regexp: useRegexp.value,
}))
const canReplace = computed(
  () => editorMode.value !== 'preview' && findHits.value.length > 0 && !busy.value,
)
const paletteOpen = ref(false)
const exporting = ref(false)
const FONT_SIZE_KEY = 'v5notes.vault.editor-font-size.v1'
const fontSize = ref(readFontSize())
const { preference: editorThemePreference, theme: editorTheme, setPreference: setEditorThemePreference, syncAppScheme } = useEditorTheme()
const pluginCommands = ref<Awaited<ReturnType<typeof listHostCommands>>>([])

function readFontSize(): number {
  try {
    const raw = Number(localStorage.getItem(FONT_SIZE_KEY))
    return Number.isFinite(raw) && raw > 0 ? clampFontSize(raw) : DEFAULT_FONT_SIZE
  } catch {
    return DEFAULT_FONT_SIZE
  }
}

function applyFontSize(size: number): void {
  fontSize.value = clampFontSize(size)
  try {
    localStorage.setItem(FONT_SIZE_KEY, String(fontSize.value))
  } catch {
    /* private mode: the size still applies for this session */
  }
}

const commandContext = computed<CommandContext>(() => ({
  mode: editorMode.value,
  hasNote: Boolean(selectedPath.value),
  dirty: dirty.value,
  busy: busy.value,
  sidebarOpen: sidebarOpen.value,
  outlineOpen: outlineOpen.value,
  outlineTab: outlineTab.value,
  trashOpen: showTrash.value,
  fontSize: fontSize.value,
}))

const commandActions: CommandActions = {
  enterEdit: () => { void enterEdit() },
  enterSource: () => { void enterSource() },
  leaveEdit: () => { void leaveEdit() },
  saveNote: () => { void saveCurrent() },
  toggleSidebar: () => { sidebarOpen.value = !sidebarOpen.value },
  toggleOutline: () => toggleOutlinePanel(),
  toggleFind: () => toggleFindPanel(),
  toggleTrash: () => { sidebarOpen.value = true; void toggleTrashPanel() },
  openAttachments: () => { void openAttachmentDialog() },
  changeFontSize: delta => applyFontSize(fontSize.value + delta),
  exportNote: format => { void exportNote(format) },
  copyMarkdown: () => { void copyNoteMarkdown() },
  openSettings: () => emit('settings'),
}

const commands = computed<EditorCommand[]>(() =>
  buildEditorCommands(commandActions).concat(buildPluginCommands(pluginCommands.value)),
)

function runEditorCommand(command: EditorCommand): void {
  // Repeatable commands (font size) stay in the palette so they can be repeated.
  if (!command.keepOpen) paletteOpen.value = false
  Promise.resolve()
    .then(() => command.run())
    .catch(error => { status.value = error instanceof Error ? error.message : String(error) })
}

function toggleOutlinePanel(): void {
  if (outlineOpen.value && outlineTab.value === 'outline') {
    outlineOpen.value = false
    return
  }
  outlineOpen.value = true
  setOutlineTab('outline')
}

function toggleFindPanel(): void {
  if (outlineOpen.value && outlineTab.value === 'find') {
    outlineOpen.value = false
    return
  }
  openFind()
}

function showModeToast(mode: EditorMode): void {
  showToast(modeSwitchLabel(mode))
}

/** The vault has no server, so relative attachment links resolve locally. */
function resolveExportAsset(source: string): string {
  const match = /^(attachments|附件)\//.exec(source)
  if (!match) return source
  return new URL(`${match[1]}/${source.slice(match[0].length)}`, `${window.location.origin}/`).href
}

function exportFilters(format: ExportFormat): FileFilter[] {
  if (format === 'image') return [{ name: 'PNG 图片', extensions: ['png'] }]
  if (format === 'markdown') return [{ name: 'Markdown', extensions: ['md'] }]
  if (format === 'html') return [{ name: 'HTML 网页', extensions: ['html'] }]
  return [{ name: 'PDF', extensions: ['pdf'] }]
}

/**
 * Export the open note. A dirty draft is saved first so the file matches the
 * editor; a failed save cancels the export instead of shipping stale content.
 */
async function exportNote(format: ExportFormat): Promise<void> {
  if (!selectedPath.value || exporting.value) return
  exporting.value = true
  status.value = ''
  try {
    if (dirty.value) {
      const ok = await saveCurrent()
      if (!ok || dirty.value) {
        status.value = '保存失败，已取消导出'
        return
      }
    }
    if (!editorSession.value) await ensureEditorMounted()
    // Source mode renders Markdown, not the note: rasterise from the formatted
    // view so the export still shows the note the way it reads.
    if (sourceMode.value && (format === 'pdf' || format === 'image')) {
      sourceMode.value = false
      syncEditorSurface()
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 60))
    }
    const markdown = editorSession.value?.getMarkdown() ?? content.value
    const payload = {
      name: noteTitle.value,
      markdown,
      html: rewriteImageSources(
        snapshotRenderedHtml(editorSession.value?.getContentElement?.() ?? null),
        resolveExportAsset,
      ),
    }
    const fileName = exportFileName(noteTitle.value, format === 'markdown' ? 'md' : format === 'image' ? 'png' : format)
    let result: 'saved' | 'canceled'
    let missing = 0
    let pages = 0
    if (format === 'markdown') {
      result = await saveExportFile(fileName, buildMarkdownDocument(payload), exportFilters(format))
    } else if (format === 'html') {
      result = await saveExportFile(
        fileName,
        buildRenderedDocument(payload.name, payload.html, EXPORT_HTML_THEME),
        exportFilters(format),
      )
    } else {
      // Rasterising needs the rendered note; images must settle first or the
      // snapshot would carry empty boxes.
      await nextTick()
      await editorSession.value?.waitForImages?.()
      const rendered = format === 'image'
        ? await renderNotePng(payload.html, { resolveAsset: resolveExportAsset })
        : await renderNotePdf(payload.html, { resolveAsset: resolveExportAsset })
      missing = rendered.missingImages
      pages = format === 'pdf' ? ('pages' in rendered ? Number(rendered.pages) : 0) : 0
      result = await saveExportFile(
        fileName,
        new Uint8Array(await rendered.blob.arrayBuffer()),
        exportFilters(format),
      )
    }
    if (result === 'canceled') return
    if (missing) status.value = `已导出 ${fileName}，${missing} 张外链图片未能嵌入`
    else if (pages) status.value = `已导出 ${fileName}（${pages} 页）`
    else status.value = `已导出 ${fileName}`
  } catch (error) {
    status.value = error instanceof Error ? error.message : '导出失败'
  } finally {
    exporting.value = false
  }
}

async function copyNoteMarkdown(): Promise<void> {
  try {
    const markdown = editorSession.value?.getMarkdown() ?? content.value
    await navigator.clipboard.writeText(markdown)
    status.value = '已复制 Markdown'
  } catch (error) {
    status.value = `复制失败：${error instanceof Error ? error.message : String(error)}`
  }
}

const toast = ref<string | null>(null)

interface FindHitView {
  from: number
  to: number
  index: number
  before: string
  match: string
  after: string
}

function refreshRibbons() {
  pluginRibbons.value = listHostRibbons()
}

async function runRibbon(r: HostRibbon) {
  try {
    await r.run()
  } catch (error) {
    status.value = error instanceof Error ? error.message : String(error)
  }
}

const nameDialog = ref<{
  mode: 'note' | 'dir' | 'rename'
  parentPath: string | null
  target: VaultTreeNode | null
  error: string | null
  /** Note kind being created; only meaningful when mode is 'note'. */
  docKind?: string
} | null>(null)
const moveDialog = ref<{
  node: VaultTreeNode
  error: string | null
  submitting: boolean
} | null>(null)
const confirmDialog = ref<{
  mode: 'delete' | 'empty-trash' | 'close-dirty' | 'external-reload'
  node?: VaultTreeNode | null
  message: string
  title: string
} | null>(null)

const dirty = computed(() => selectedPath.value != null && content.value !== savedContent.value)
const vaultColor = computed<VaultColorSwatch>(() => resolveVaultColor(props.vault.rootPath))
const vaultInitial = computed(() => (props.vault.name || 'V').slice(0, 1).toUpperCase())
const noteTitle = computed(() => {
  if (!selectedPath.value) return ''
  const name = selectedPath.value.split('/').pop() ?? selectedPath.value
  return displayNameOfIn(creatableKinds.value, name)
})
const modKey = navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'

watch(
  () => props.vault.rootPath,
  path => {
    applyVaultColorForPath(path)
  },
  { immediate: true },
)

let unwatch: (() => void) | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null
let pendingClose = false
let narrowQuery: MediaQueryList | null = null
let narrowOutlineQuery: MediaQueryList | null = null

function onNarrowChange(event: MediaQueryListEvent) {
  if (event.matches) sidebarOpen.value = false
}

function onNarrowOutlineChange(event: MediaQueryListEvent) {
  if (event.matches) outlineOpen.value = false
}

watch(dirty, value => emit('dirtyChange', value), { immediate: true })

// Enabling or disabling a plugin can change which kinds count as notes.
watch(docKindsRevision, () => {
  void refreshTree()
})

watch(sidebarOpen, open => {
  if (!open) {
    closeTreeMenu()
    sidebarMenuOpen.value = false
  }
})

/* ---------- 编辑器实例 / 大纲 / 查找 ---------- */

let outlineTimer: ReturnType<typeof setTimeout> | null = null
let findTimer: ReturnType<typeof setTimeout> | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null

function refreshOutline() {
  if (outlineTimer) clearTimeout(outlineTimer)
  outlineTimer = setTimeout(() => {
    outlineTimer = null
    outlineEntries.value = selectedPath.value ? (editorSession.value?.getOutline() ?? []) : []
    if (outlineOpen.value && outlineTab.value === 'find' && findQuery.value.trim()) {
      runFind(false)
    }
  }, 140)
}

/** A remembered kind whose plugin is gone has files but no editor to open them. */
const editorUnavailable = ref(false)

function destroyEditorSession() {
  editorSession.value?.destroy()
  editorSession.value = null
  mountedEditorId = null
}

async function ensureEditorMounted() {
  await nextTick()
  const el = editorMountEl.value
  const path = selectedPath.value
  if (!el || !path) {
    destroyEditorSession()
    return
  }
  const provider = getActiveEditorProvider(docKindOfPath(path)?.id)
  editorUnavailable.value = !provider
  if (!provider) {
    destroyEditorSession()
    return
  }
  if (editorSession.value && mountedEditorId === provider.id) {
    syncEditorSurface()
    return
  }
  destroyEditorSession()
  const rootPath = props.vault.rootPath
  const session = await provider.mount(el, {
    markdown: content.value,
    editable: editorMode.value !== 'preview',
    locale: 'zh-CN',
    theme: 'paper',
    placeholder: '开始写作…',
    onChange: (markdown) => {
      if (markdown === content.value) return
      applyingFromEditor = true
      content.value = markdown
    },
    onUploadImage: async (file) => {
      try {
        return await saveImageToVault(rootPath, file)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        status.value = message
        emit('error', message)
        return ''
      }
    },
    onPickImage: () => {
      // Toolbar image button → the vault attachment picker, never the OS dialog.
      void openAttachmentDialog()
    },
    resolveVaultAsset: async (relativePath) => {
      try {
        if (!(await vaultFs.exists(rootPath, relativePath))) return ''
        return await vaultAssetUrl(rootPath, relativePath)
      } catch {
        return ''
      }
    },
    onFindRequest: () => openFind(),
    onReady: () => refreshOutline(),
  })
  if (selectedPath.value !== path) {
    session.destroy()
    return
  }
  editorSession.value = session
  mountedEditorId = provider.id
  syncEditorSurface()
}

/* ---------- 附件选择对话框 ---------- */

async function refreshAttachments() {
  try {
    attachmentList.value = await listVaultAttachments(props.vault.rootPath)
  } catch (error) {
    emit('error', error instanceof Error ? error.message : String(error))
  }
}

async function openAttachmentDialog() {
  if (attachmentOpen.value) return
  attachmentOpen.value = true
  closeTreeMenu()
  await refreshAttachments()
}

function closeAttachmentDialog() {
  attachmentOpen.value = false
}

async function onAttachmentLoadUrl(item: VaultAttachment) {
  const picker = attachmentPickerRef.value
  if (!picker) return
  try {
    const url = await vaultAssetUrl(props.vault.rootPath, item.rel)
    picker.setPreview(item.rel, url)
  } catch (error) {
    picker.fail(`无法预览「${item.name}」：${error instanceof Error ? error.message : String(error)}`)
  }
}

async function onAttachmentInsert(item: VaultAttachment) {
  if (!selectedPath.value) {
    status.value = '请先打开一篇笔记再插入图片'
    return
  }
  // The stored file is the source of truth — a missing image must not leave a
  // dangling reference behind.
  if (!(await vaultFs.exists(props.vault.rootPath, item.rel))) {
    attachmentPickerRef.value?.fail(`「${item.name}」已不在附件目录中`)
    await refreshAttachments()
    return
  }
  const url = attachmentUrlText(item.rel)
  const name = item.name.replace(/\.[^.]+$/, '')
  if (editorMode.value === 'preview' && selectedPath.value) {
    // No caret in preview: switch to edit so the image lands where the user
    // was reading, not at a forced end-of-document position.
    await enterEdit()
  }
  if (editorMode.value !== 'preview' && editorSession.value) {
    // Focus returns to the caret inside insertImageUrl — no manual refocus.
    editorSession.value.insertImage({ name, url })
    attachmentOpen.value = false
    return
  }
  status.value = '无法进入编辑模式，未插入图片'
}

async function onAttachmentRemove(item: VaultAttachment) {
  const picker = attachmentPickerRef.value
  attachmentBusy.value = true
  try {
    await deleteVaultAttachment(props.vault.rootPath, item.rel)
    picker?.deleteDone(true)
    status.value = `已移入回收站：${item.name}`
  } catch (error) {
    picker?.deleteDone(false, error instanceof Error ? error.message : String(error))
  } finally {
    attachmentBusy.value = false
  }
}

async function onAttachmentImportFiles(files: File[]) {
  const picker = attachmentPickerRef.value
  attachmentBusy.value = true
  const failures: string[] = []
  try {
    for (const file of files) {
      try {
        await importImageFileToVault(props.vault.rootPath, file)
      } catch (error) {
        failures.push(`${file.name}：${error instanceof Error ? error.message : String(error)}`)
      }
    }
  } finally {
    attachmentBusy.value = false
  }
  await refreshAttachments()
  // Imports only land in the list; inserting stays an explicit user action.
  if (failures.length === files.length && failures.length) {
    picker?.fail(failures.join('；'))
    picker?.importDone(false)
    return
  }
  if (failures.length) picker?.fail(`部分导入失败：${failures.join('；')}`)
  picker?.importDone(true)
  status.value = `已导入 ${files.length - failures.length} 张图片`
}

watch(content, (value) => {
  refreshOutline()
  if (applyingFromEditor) {
    applyingFromEditor = false
    return
  }
  editorSession.value?.setMarkdown(value)
})
// Source mode is editable as well; only preview is read-only.
watch(editorMode, () => {
  syncEditorSurface()
})
// Theme changes reach the live editor instance; they never remount it.
watch(editorTheme, (theme) => {
  editorSession.value?.setTheme?.(theme)
})
watch(selectedPath, (path) => {
  if (!path) {
    outlineEntries.value = []
    destroyEditorSession()
    return
  }
  void ensureEditorMounted()
})
// The note canvas mounts on demand; re-apply the body size once it exists.
watch(editorMountEl, el => {
  el?.style.setProperty('--note-font-size', `${fontSize.value}px`)
})

// Keep the plain-text fallback editor in step with the same setting: it inherits
// from its container, so the shared variable is written there too.
watch(fontSize, size => {
  editorMountEl.value?.style.setProperty('--note-font-size', `${size}px`)
}, { immediate: true })

function focusOutline(start: number) {
  editorSession.value?.focusAt(start)
}

function setOutlineTab(tab: 'outline' | 'find') {
  outlineTab.value = tab
  if (tab === 'find') void nextTick(() => findInput.value?.focus())
}

function openFind() {
  if (!selectedPath.value) return
  outlineOpen.value = true
  setOutlineTab('find')
}

function onFindRequest() {
  openFind()
}

function runFind(reset = true) {
  const query = findQuery.value
  if (!selectedPath.value || !query.trim()) {
    findHits.value = []
    findStatus.value = ''
    findCurrent.value = -1
    return
  }
  const { matches, error } = listMatches(content.value, query, findOptions.value)
  if (error) {
    findHits.value = []
    findStatus.value = error
    findCurrent.value = -1
    return
  }
  findHits.value = matches.map(hit => {
    const lineStart = content.value.lastIndexOf('\n', hit.from - 1) + 1
    const lineEndRaw = content.value.indexOf('\n', hit.to)
    const lineEnd = lineEndRaw === -1 ? content.value.length : lineEndRaw
    return {
      from: hit.from,
      to: hit.to,
      index: hit.index,
      before: content.value.slice(lineStart, hit.from).slice(-28),
      match: hit.text,
      after: content.value.slice(hit.to, lineEnd).slice(0, 36),
    }
  })
  findStatus.value = findHits.value.length ? `${findHits.value.length} 个匹配` : '未找到匹配'
  if (reset) {
    findCurrent.value = findHits.value.length ? 0 : -1
    if (findHits.value.length) selectFindHit(0)
  } else if (findCurrent.value >= findHits.value.length) {
    findCurrent.value = findHits.value.length - 1
  }
}

function selectFindHit(index: number) {
  const hit = findHits.value[index]
  if (!hit) return
  findCurrent.value = index
  editorSession.value?.selectFindMatch(hit.from, hit.to)
}

function findStep(direction: 1 | -1) {
  if (!findHits.value.length) return
  const next = (findCurrent.value + direction + findHits.value.length) % findHits.value.length
  selectFindHit(next)
}

watch([caseSensitive, wholeWord, useRegexp], () => {
  if (findQuery.value.trim()) runFind(true)
})

function replaceOne() {
  if (!canReplace.value || !editorSession.value) return
  const index = findCurrent.value >= 0 ? findCurrent.value : 0
  selectFindHit(index)
  const result = editorSession.value.replaceNextMatch(
    findQuery.value,
    replacement.value,
    findOptions.value,
  )
  if (result.error) {
    findStatus.value = result.error
    return
  }
  window.setTimeout(() => runFind(true), 80)
}

function replaceEvery() {
  if (!canReplace.value || !editorSession.value) return
  const result = editorSession.value.replaceAllMatches(
    findQuery.value,
    replacement.value,
    findOptions.value,
  )
  if (result.error) {
    findStatus.value = result.error
    return
  }
  window.setTimeout(() => runFind(true), 80)
}

watch(findQuery, () => {
  if (findTimer) clearTimeout(findTimer)
  findTimer = setTimeout(() => runFind(true), 160)
})

/* ---------- 搜索 / 命令 / 轻提示 ---------- */

function openSearch() {
  sidebarMenuOpen.value = false
  showTrash.value = false
  searchOpen.value = true
  void nextTick(() => searchInput.value?.focus())
}

function closeSearch() {
  searchOpen.value = false
  searchQuery.value = ''
  searchHits.value = []
}

function onDocumentPointer(event: PointerEvent) {
  const target = event.target instanceof Element ? event.target : null
  if (createMenuOpen.value && !target?.closest('.create-menu')) {
    createMenuOpen.value = false
  }
  if (!sidebarMenuOpen.value) return
  if (target?.closest('.sidebar-menu') || target?.closest('.sidebar-menu-btn')) return
  sidebarMenuOpen.value = false
}

function showToast(message: string) {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = null
    toastTimer = null
  }, 3200)
}

watch(status, value => {
  if (value && value !== '已保存') showToast(value)
})

// Closing a dialog returns the caret to the editor so typing continues.
watch([nameDialog, moveDialog, confirmDialog, attachmentOpen], ([name, move, confirm, picker], previous) => {
  if (name || move || confirm || picker) {
    closeTreeMenu()
    return
  }
  const wasOpen = previous ? !!previous[0] || !!previous[1] || !!previous[2] || !!previous[3] : false
  if (wasOpen && selectedPath.value && editorMode.value !== 'preview') {
    void nextTick(() => editorSession.value?.focus())
  }
})


async function refreshTree() {
  tree.value = await vaultFs.listTree(props.vault.rootPath, creatableKinds.value)
}

function findTreeNode(nodes: VaultTreeNode[], identityKey: string): VaultTreeNode | null {
  for (const node of nodes) {
    if (node.identityKey === identityKey) return node
    const hit = node.children ? findTreeNode(node.children, identityKey) : null
    if (hit) return hit
  }
  return null
}

async function refreshTrash() {
  trashEntries.value = await listTrash(props.vault.rootPath, creatableKinds.value)
}

async function openNote(node: VaultTreeNode) {
  if (node.kind !== 'note') return
  if (dirty.value) {
    const ok = await saveCurrent()
    if (!ok) return
  }
  // Plugin openFile() gets a path, not a tree node; a note written just now may
  // not be listed yet, so re-read the tree before selecting it.
  if (!findTreeNode(tree.value, node.identityKey)) {
    await refreshTree()
    if (!findTreeNode(tree.value, node.identityKey)) {
      status.value = '笔记未在目录中找到'
      return
    }
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
    touchNoteRecency(node.path)
    outlineTab.value = 'outline'
    if (searchOpen.value) closeSearch()
    sidebarMenuOpen.value = false
    if (window.matchMedia('(max-width: 800px)').matches) sidebarOpen.value = false
  } catch (error) {
    emit('error', error instanceof Error ? error.message : String(error))
  } finally {
    busy.value = false
  }
}

async function saveCurrent(): Promise<boolean> {
  // An unopenable note's in-memory copy is not authoritative; never write it back.
  if (editorUnavailable.value) return true
  if (!selectedPath.value || !dirty.value) return true
  busy.value = true
  status.value = ''
  try {
    await vaultFs.writeText(props.vault.rootPath, selectedPath.value, content.value)
    savedContent.value = content.value
    touchNoteRecency(selectedPath.value)
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
  enterWritableMode('edit')
}

async function enterSource() {
  enterWritableMode('source')
}

/**
 * Put the live editor into one mode. Both surfaces being writable is what makes
 * the switches work: source mode is editable too, and the editor reports its
 * editable flag separately from its view.
 */
function syncEditorSurface(): void {
  editorSession.value?.setEditable(editorMode.value !== 'preview')
  editorSession.value?.setSourceMode?.(sourceMode.value)
}

/** Undo history and the Markdown model survive a mode switch: no remount. */
function enterWritableMode(mode: Exclude<EditorMode, 'preview'>): void {
  // Nothing can accept keystrokes without an editor for this note's kind.
  if (editorUnavailable.value) return
  if (editorMode.value === mode) return
  editorMode.value = mode
  sourceMode.value = mode === 'source'
  syncEditorSurface()
  showModeToast(mode)
}

/** Preview only reports success once the save lands; a failure keeps edit mode. */
async function leaveEdit() {
  if (editorMode.value === 'preview') return
  if (dirty.value) {
    const ok = await saveCurrent()
    if (!ok) return
  }
  editorMode.value = 'preview'
  sourceMode.value = false
  syncEditorSurface()
  showModeToast('preview')
}

function parentOf(path: string | null): string | null {
  if (!path) return null
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : null
}

function formatDeletedAt(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function openCreateNote(parent: VaultTreeNode | null, docKind: string = MARKDOWN_KIND) {
  closeTreeMenu()
  nameDialog.value = {
    mode: 'note',
    parentPath: parent?.path ?? null,
    target: null,
    error: null,
    docKind,
  }
}

function openCreateDir(parent: VaultTreeNode | null) {
  closeTreeMenu()
  nameDialog.value = {
    mode: 'dir',
    parentPath: parent?.path ?? null,
    target: null,
    error: null,
  }
}

function openRename(node: VaultTreeNode) {
  closeTreeMenu()
  nameDialog.value = {
    mode: 'rename',
    parentPath: parentOf(node.path),
    target: node,
    error: null,
  }
}

function openDelete(node: VaultTreeNode) {
  closeTreeMenu()
  const isDir = node.kind === 'dir'
  confirmDialog.value = {
    mode: 'delete',
    node,
    title: isDir ? '删除目录' : '删除笔记',
    message: isDir
      ? `将「${node.name}」及其子目录与笔记移入本地回收站（.v5notes/trash，永不同步）。可稍后还原。`
      : `将「${displayNameOfIn(creatableKinds.value, node.name)}」移入本地回收站（永不同步）。可稍后还原。`,
  }
}

/* ---------- 移动目录 / 笔记 ---------- */

function parentDirOf(path: string): string {
  const index = path.lastIndexOf('/')
  return index >= 0 ? path.slice(0, index) : ''
}

function isUnder(path: string, ancestor: string): boolean {
  return ancestor === '' || path === ancestor || path.startsWith(`${ancestor}/`)
}

/** Every directory in the vault, depth-first, so the picker mirrors the tree order. */
const directoryOptions = computed<MoveTargetOption[]>(() => {
  const out: MoveTargetOption[] = [{ path: '', label: '库根目录', depth: 0 }]
  const walk = (nodes: VaultTreeNode[], depth: number) => {
    for (const node of nodes) {
      if (node.kind !== 'dir') continue
      out.push({ path: node.path, label: node.name, depth })
      walk(node.children ?? [], depth + 1)
    }
  }
  walk(tree.value, 1)
  return out
})

const moveTargets = computed<MoveTargetOption[]>(() => {
  const node = moveDialog.value?.node
  if (!node) return directoryOptions.value
  const current = parentDirOf(node.path)
  return directoryOptions.value.map(target => ({
    ...target,
    current: target.path === current,
    blocked: node.kind === 'dir' && isUnder(target.path, node.path),
  }))
})

function openMove(node: VaultTreeNode) {
  closeTreeMenu()
  moveDialog.value = { node, error: null, submitting: false }
}

async function submitMove(targetDir: string) {
  const dialog = moveDialog.value
  if (!dialog || dialog.submitting) return
  const node = dialog.node
  const fromDir = parentDirOf(node.path)
  if (targetDir === fromDir || (node.kind === 'dir' && isUnder(targetDir, node.path))) {
    moveDialog.value = null
    return
  }
  const leaf = node.name
  const toRel = targetDir ? `${targetDir}/${leaf}` : leaf
  let destination: string
  try {
    destination = normalizeVaultPath(toRel).displayPath
  } catch (error) {
    dialog.error = error instanceof Error ? error.message : String(error)
    return
  }
  dialog.submitting = true
  busy.value = true
  dialog.error = null
  try {
    if (dirty.value && isUnder(selectedPath.value ?? '', node.path)) {
      const ok = await saveCurrent()
      if (!ok) {
        dialog.error = status.value || '移动前需要先保存当前笔记'
        return
      }
    }
    if (await vaultFs.exists(props.vault.rootPath, destination)) {
      throw new VaultPathError(`目标目录中已有同名的${node.kind === 'dir' ? '目录' : '笔记'}`)
    }
    await vaultFs.rename(props.vault.rootPath, node.path, destination)
    if (selectedPath.value && isUnder(selectedPath.value, node.path)) {
      selectedPath.value = `${destination}${selectedPath.value.slice(node.path.length)}`
    }
    moveDialog.value = null
    await refreshTree()
    status.value = '已移动'
  } catch (error) {
    dialog.error = error instanceof Error ? error.message : String(error)
  } finally {
    dialog.submitting = false
    busy.value = false
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
      const kind =
        creatableKinds.value.find(candidate => candidate.id === dialog.docKind) ??
        docKindById(MARKDOWN_KIND)!
      const leaf = displayNameOfIn(creatableKinds.value, raw.trim()) || raw.trim()
      const fileName = `${leaf}${kind.extension}`
      const rel = dialog.parentPath ? `${dialog.parentPath}/${fileName}` : fileName
      const { displayPath } = normalizeVaultPath(rel)
      if (await vaultFs.exists(props.vault.rootPath, displayPath)) {
        throw new VaultPathError('同名笔记已存在')
      }
      await vaultFs.writeText(props.vault.rootPath, displayPath, initialContentFor(kind, leaf))
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
      const targetKind = docKindOfPathIn(creatableKinds.value, target.name)
      const newLeaf =
        target.kind === 'note'
          ? `${displayNameOfIn(creatableKinds.value, raw.trim()) || raw.trim()}${targetKind?.extension ?? '.md'}`
          : raw.trim()
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

/** Document kinds the user can create right now, core first then plugin kinds. */
const creatableKinds = computed<DocKindSpec[]>(() => listDocKinds())

const createMenuOpen = ref(false)

function closeCreateMenu() {
  createMenuOpen.value = false
}

const LAST_KIND_KEY = 'v5notes.vault.last-note-kind'

function readLastKind(): string | null {
  try {
    return localStorage.getItem(LAST_KIND_KEY)
  } catch {
    return null
  }
}

function rememberKind(docKind: string) {
  try {
    localStorage.setItem(LAST_KIND_KEY, docKind)
  } catch {
    /* private mode */
  }
}

/** Last created kind when it is still creatable, else the first one on offer. */
const preferredKind = computed(() => {
  const last = readLastKind()
  const kinds = creatableKinds.value
  return kinds.find(kind => kind.id === last) ?? kinds[0] ?? null
})

/**
 * ⌘N repeats the last kind; ⌘⇧N (and the sidebar button) opens the chooser.
 * With a single kind there is nothing to choose, so every entry creates it.
 */
async function createNoteRoot() {
  if (creatableKinds.value.length > 1) {
    openCreateMenu()
    return
  }
  createNoteOfKind(creatableKinds.value[0]?.id ?? MARKDOWN_KIND)
}

function openCreateMenu() {
  if (creatableKinds.value.length > 1) {
    sidebarMenuOpen.value = false
    createMenuOpen.value = true
    return
  }
  createNoteOfKind(creatableKinds.value[0]?.id ?? MARKDOWN_KIND)
}

function createNoteOfKind(docKind: string) {
  createMenuOpen.value = false
  rememberKind(docKind)
  openCreateNote(null, docKind)
}

/** ⌘N path: same vault location rules as the chooser, no menu. */
function createNoteWithPreferredKind() {
  createMenuOpen.value = false
  const kind = preferredKind.value
  rememberKind(kind?.id ?? MARKDOWN_KIND)
  openCreateNote(null, kind?.id ?? MARKDOWN_KIND)
}

async function runSearch(query: string) {
  searchBusy.value = true
  try {
    searchHits.value = query.trim()
      ? await vaultSearch.search(props.vault.rootPath, query, { kinds: creatableKinds.value })
      : []
  } catch (error) {
    emit('error', error instanceof Error ? error.message : String(error))
  } finally {
    searchBusy.value = false
  }
}

watch(searchQuery, value => {
  if (value.trim()) showTrash.value = false
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
  if (event.key === 'Escape') {
    if (sidebarMenuOpen.value) sidebarMenuOpen.value = false
    if (createMenuOpen.value) closeCreateMenu()
    if (searchOpen.value) closeSearch()
  }
  const modalBlocking = !!nameDialog.value || !!confirmDialog.value || attachmentOpen.value
  if (meta && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void saveCurrent()
  }
  if (meta && event.key.toLowerCase() === 'n' && !modalBlocking) {
    // ⌘N repeats the last note kind; ⌘⇧N opens the kind chooser.
    event.preventDefault()
    if (event.shiftKey) openCreateMenu()
    else createNoteWithPreferredKind()
  }
  if (meta && event.key.toLowerCase() === 'k' && !modalBlocking) {
    event.preventDefault()
    paletteOpen.value = !paletteOpen.value
    return
  }
  // Editor mode shortcuts mirror the palette chips: ⌘E edit, ⌘2 source, ⌘R preview.
  if (meta && !event.shiftKey && !event.altKey && selectedPath.value && !modalBlocking) {
    if (event.key.toLowerCase() === 'e' || event.key === '1') {
      event.preventDefault()
      void enterEdit()
      return
    }
    if (event.key === '2') {
      event.preventDefault()
      void enterSource()
      return
    }
    if (event.key.toLowerCase() === 'r') {
      event.preventDefault()
      void leaveEdit()
      return
    }
  }
  if (meta && event.key.toLowerCase() === 'f' && selectedPath.value && !modalBlocking) {
    event.preventDefault()
    openFind()
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
    searchOpen.value = false
    showTrash.value = false
    sidebarMenuOpen.value = false
    outlineTab.value = 'outline'
    outlineEntries.value = []
    findQuery.value = ''
    findHits.value = []
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

// The shell writes data-color-mode on <html>; keep `auto` following it.
const appearanceObserver = typeof MutationObserver === 'undefined'
  ? null
  : new MutationObserver(() => syncAppScheme())

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  appearanceObserver?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-color-mode'] })
  narrowQuery = window.matchMedia('(max-width: 800px)')
  if (narrowQuery.matches) sidebarOpen.value = false
  narrowQuery.addEventListener('change', onNarrowChange)
  narrowOutlineQuery = window.matchMedia('(max-width: 1000px)')
  if (narrowOutlineQuery.matches) outlineOpen.value = false
  narrowOutlineQuery.addEventListener('change', onNarrowOutlineChange)
  document.addEventListener('pointerdown', onDocumentPointer, true)
  try {
    await refreshTree()
    await setupWatcher()
    setExtensionNoticeHandler((message) => {
      status.value = message
    })
    setExtensionWorkspaceHandlers({
      getActivePath: () => selectedPath.value,
      openFile: async (path) => {
        // Plugins may hand over a just-written path the tree has not listed yet;
        // staging it keeps the sidebar in sync until the watcher catches up.
        const { displayPath, identityKey } = normalizeVaultPath(path)
        const node: VaultTreeNode = {
          path: displayPath,
          identityKey,
          name: displayPath.split('/').pop() || displayPath,
          kind: 'note',
        }
        const parent = displayPath.includes('/')
          ? findTreeNode(tree.value, normalizeVaultPath(displayPath.slice(0, displayPath.lastIndexOf('/'))).identityKey)
          : null
        if (parent?.kind === 'dir') {
          parent.children = [...(parent.children ?? []), node]
          tree.value = [...tree.value]
        }
        await openNote(node)
        await refreshTree()
      },
    })
    // Extensions stay running across vaults; only the vault they read changes.
    attachExtensionRuntimeVault(props.vault.rootPath)
    if (!getPluginHost()) await startExtensionRuntime(props.vault.rootPath)
    refreshRibbons()
    pluginCommands.value = listHostCommands()
    if (selectedPath.value) void ensureEditorMounted()
    const prefs = loadAppearancePrefs()
    applyAppearance(prefs)
    void persistAppearanceIntent(prefs)
  } catch (error) {
    emit('error', error instanceof Error ? error.message : String(error))
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  appearanceObserver?.disconnect()
  document.removeEventListener('pointerdown', onDocumentPointer, true)
  narrowQuery?.removeEventListener('change', onNarrowChange)
  narrowOutlineQuery?.removeEventListener('change', onNarrowOutlineChange)
  narrowQuery = null
  narrowOutlineQuery = null
  if (unwatch) unwatch()
  if (searchTimer) clearTimeout(searchTimer)
  if (outlineTimer) clearTimeout(outlineTimer)
  if (findTimer) clearTimeout(findTimer)
  if (toastTimer) clearTimeout(toastTimer)
  destroyEditorSession()
  // The app-level extension host outlives this vault view.
  attachExtensionRuntimeVault(null)
  emit('dirtyChange', false)
})

async function toggleTrashPanel() {
  sidebarMenuOpen.value = false
  searchOpen.value = false
  showTrash.value = !showTrash.value
  if (showTrash.value) {
    searchQuery.value = ''
    await refreshTrash()
  }
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
  <div
    class="workspace"
    :class="{ 'sidebar-collapsed': !sidebarOpen, 'is-resizing': resizingSidebar }"
    :style="{ '--sidebar-width': `${sidebarWidth}px` }"
  >
    <aside v-show="sidebarOpen" class="sidebar" aria-label="库目录">
      <div class="sidebar-brand">
        <img class="brand-mark" :src="brandIcon" width="31" height="31" alt="" />
        <strong>V5Notes</strong>
        <button
          type="button"
          class="sidebar-close"
          aria-label="收起侧栏"
          title="收起侧栏"
          @click="sidebarOpen = false"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect x="2.8" y="3.8" width="14.4" height="12.4" rx="2.2" />
            <path d="M8 4v12" />
          </svg>
        </button>
      </div>

      <div class="sidebar-head">
        <div v-if="searchOpen" class="tree-heading is-search">
          <div class="inline-search">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m13 13 4 4" />
            </svg>
            <input
              ref="searchInput"
              v-model="searchQuery"
              type="search"
              placeholder="搜索笔记…"
              autocomplete="off"
              spellcheck="false"
              aria-label="搜索笔记"
              @keydown.esc.stop="closeSearch"
            />
            <button type="button" class="search-close" aria-label="关闭搜索" title="关闭搜索" @click="closeSearch">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>
            </button>
          </div>
        </div>
        <div v-else class="tree-heading">
          <span class="tree-heading-label">{{ showTrash ? '回收站' : '笔记' }}</span>
          <div class="tree-controls">
            <template v-if="showTrash">
              <button type="button" class="tree-control" title="返回笔记" aria-label="返回笔记" @click="toggleTrashPanel">
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M15.5 10h-11M9 4.8 3.8 10 9 15.2" />
                </svg>
              </button>
            </template>
            <template v-else>
              <button type="button" class="tree-control" title="搜索" aria-label="搜索" @click="openSearch">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="10.8" cy="10.8" r="6.8" />
                  <path d="m16 16 4.4 4.4" />
                </svg>
              </button>
              <button
                type="button"
                class="tree-control sidebar-menu-btn"
                title="笔记视图"
                aria-label="笔记视图"
                aria-haspopup="menu"
                :aria-expanded="sidebarMenuOpen"
                @click.stop="toggleSidebarMenu"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                  <circle cx="9" cy="6" r="2" />
                  <circle cx="15" cy="12" r="2" />
                  <circle cx="8" cy="18" r="2" />
                </svg>
              </button>
              <button type="button" class="tree-control" title="新建目录" aria-label="新建目录" @click="openCreateDir(null)">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3.5 7.5h6l2 2H20a1 1 0 0 1 1 1v7.8a1.7 1.7 0 0 1-1.7 1.7H4.7A1.7 1.7 0 0 1 3 18.3V8a.5.5 0 0 1 .5-.5Z" />
                  <path d="M16.5 3.5v6M13.5 6.5h6" />
                </svg>
              </button>
            </template>
          </div>
        </div>

        <div
          v-if="createMenuOpen && creatableKinds.length > 1"
          class="sidebar-menu create-menu"
          role="menu"
          aria-label="新建笔记"
          @click.stop
        >
          <button
            v-for="kind in creatableKinds"
            :key="kind.id"
            type="button"
            role="menuitem"
            class="sidebar-menu-item"
            @click="createNoteOfKind(kind.id)"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 2.5h6l4 4V17H5zM11 2.8v4h3.7M8 10h4M8 13h4M16.5 12v5M14 14.5h5" />
            </svg>
            <span>{{ kind.newLabel }}</span>
          </button>
        </div>

        <div
          v-if="sidebarMenuOpen && !showTrash && !searchOpen"
          class="sidebar-menu"
          role="menu"
          aria-label="笔记视图"
          @click.stop
        >
          <button type="button" role="menuitem" class="sidebar-menu-item" @click="createFromSidebar('dir')">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M2.5 6h5.8L10 8h7.5v8H2.5zM13.5 3v5M11 5.5h5" />
            </svg>
            <span>新建目录</span>
          </button>
          <template v-if="creatableKinds.length > 1">
            <button
              v-for="kind in creatableKinds"
              :key="kind.id"
              type="button"
              role="menuitem"
              class="sidebar-menu-item"
              @click="createFromSidebarKind(kind.id)"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M5 2.5h6l4 4V17H5zM11 2.8v4h3.7M8 10h4M8 13h4M16.5 12v5M14 14.5h5" />
              </svg>
              <span>{{ kind.newLabel }}</span>
            </button>
          </template>
          <button
            v-else
            type="button"
            role="menuitem"
            class="sidebar-menu-item"
            @click="createFromSidebar('note')"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 2.5h6l4 4V17H5zM11 2.8v4h3.7M8 10h4M8 13h4M16.5 12v5M14 14.5h5" />
            </svg>
            <span>新建笔记</span>
          </button>
          <div class="sidebar-menu-sep" role="separator" />
          <p class="sidebar-menu-label" role="presentation">分组方式</p>
          <button
            type="button"
            role="menuitemradio"
            class="sidebar-menu-item"
            :aria-checked="noteGroup === 'tree'"
            @click="chooseGroup('tree')"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 5h5M4 10h5M4 15h5M9 5v10M12 5h4M12 10h4M12 15h4" />
            </svg>
            <span>按目录树</span>
            <svg v-if="noteGroup === 'tree'" class="menu-check" viewBox="0 0 20 20" aria-hidden="true">
              <path d="m4.5 10.2 3.4 3.4 7.2-7.4" />
            </svg>
          </button>
          <button
            type="button"
            role="menuitemradio"
            class="sidebar-menu-item"
            :aria-checked="noteGroup === 'list'"
            @click="chooseGroup('list')"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 5.5h12M4 10h12M4 14.5h12" /></svg>
            <span>单列表</span>
            <svg v-if="noteGroup === 'list'" class="menu-check" viewBox="0 0 20 20" aria-hidden="true">
              <path d="m4.5 10.2 3.4 3.4 7.2-7.4" />
            </svg>
          </button>
          <div class="sidebar-menu-sep" role="separator" />
          <p class="sidebar-menu-label" role="presentation">排序方式</p>
          <button
            type="button"
            role="menuitemradio"
            class="sidebar-menu-item"
            :aria-checked="noteSort === 'name'"
            @click="chooseSort('name')"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M4 10h9M4 14h6" /></svg>
            <span>按名称</span>
            <svg v-if="noteSort === 'name'" class="menu-check" viewBox="0 0 20 20" aria-hidden="true">
              <path d="m4.5 10.2 3.4 3.4 7.2-7.4" />
            </svg>
          </button>
          <button
            type="button"
            role="menuitemradio"
            class="sidebar-menu-item"
            :aria-checked="noteSort === 'updated'"
            @click="chooseSort('updated')"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="10" r="6.2" />
              <path d="M10 6.8V10l2.2 1.6" />
            </svg>
            <span>最近更新</span>
            <svg v-if="noteSort === 'updated'" class="menu-check" viewBox="0 0 20 20" aria-hidden="true">
              <path d="m4.5 10.2 3.4 3.4 7.2-7.4" />
            </svg>
          </button>
        </div>
      </div>

      <div v-if="searchOpen && searchQuery.trim()" class="tree-scroll search-results">
        <p v-if="searchBusy" class="empty-tree">搜索中…</p>
        <p v-else-if="!searchHits.length" class="empty-tree">没有找到匹配的笔记</p>
        <ul v-else class="hit-list">
          <li v-for="hit in searchHits" :key="hit.identityKey">
            <button
              type="button"
              class="search-hit"
              @click="openNote({ path: hit.path, identityKey: hit.identityKey, name: hit.title + '.md', kind: 'note' })"
            >
              <TreeIcon kind="note" />
              <span class="search-hit-copy">
                <strong>{{ hit.title }}</strong>
                <span>{{ hit.snippet || hit.path }}</span>
              </span>
            </button>
          </li>
        </ul>
      </div>

      <div v-else-if="showTrash" class="tree-scroll trash-panel">
        <div class="trash-head">
          <p>回收站只保留在本机，永不同步。</p>
          <button
            type="button"
            class="trash-clear"
            aria-label="清空回收站"
            :disabled="!trashEntries.length || busy"
            @click="requestEmptyTrash"
          >
            清空
          </button>
        </div>
        <ul v-if="trashEntries.length" class="trash-list">
          <li v-for="entry in trashEntries" :key="entry.trashRel" class="trash-entry-row">
            <TreeIcon :kind="entry.kind === 'dir' ? 'folder' : 'note'" />
            <span class="trash-copy">
              <strong>{{ displayNameOfIn(creatableKinds, entry.name) }}</strong>
              <span
                v-if="entry.originalPath !== entry.name && entry.originalPath !== displayNameOfIn(creatableKinds, entry.name)"
              >{{ entry.originalPath }}</span>
              <span>{{ formatDeletedAt(entry.deletedAt) }}</span>
            </span>
            <button
              type="button"
              class="trash-restore"
              :aria-label="`还原 ${entry.name}`"
              :disabled="busy"
              @click="restoreEntry(entry)"
            >
              还原
            </button>
          </li>
        </ul>
        <p v-else class="empty-tree">回收站为空</p>
      </div>

      <div v-else class="tree-scroll">
        <VaultTree
          :nodes="noteGroup === 'list' ? flatNotes : orderedTree"
          :selected-path="selectedPath"
          :show-hint="noteGroup === 'list'"
          @open="openNote"
          :kinds="creatableKinds"
          @add-note="onTreeAddNote"
          @add-dir="openCreateDir"
          @rename="openRename"
          @move="openMove"
          @remove="openDelete"
        />
        <div v-if="noteGroup === 'list' ? !flatNotes.length : !tree.length" class="tree-empty">
          <span class="tree-empty-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 6.4C9.9 5.2 7.3 4.8 4.6 5.2v13c2.7-.4 5.3 0 7.4 1.2 2.1-1.2 4.7-1.6 7.4-1.2v-13c-2.7-.4-5.3 0-7.4 1.2Z" />
              <path d="M12 6.4v13" />
            </svg>
          </span>
          <p>库内还没有笔记。<br />点上方的新建按钮写下第一篇。</p>
        </div>
      </div>

      <footer class="sidebar-footer">
        <button
          type="button"
          class="trash-entry"
          :class="{ active: showTrash }"
          :aria-pressed="showTrash"
          @click="toggleTrashPanel"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4.2 6h11.6M8 6V4.2h4V6M5.6 6l.8 11h7.2l.8-11M8.4 9v5M11.6 9v5" />
          </svg>
          <span>回收站</span>
        </button>
        <div class="footer-row">
          <div class="vault-identity" :title="vault.rootPath">
            <span class="vault-avatar" :style="{ background: vaultColor.color }" aria-hidden="true">{{ vaultInitial }}</span>
            <span class="vault-name">{{ vault.name }}</span>
          </div>
        </div>
      </footer>
      <div
        class="sidebar-resize"
        role="separator"
        aria-label="调整侧栏宽度"
        aria-orientation="vertical"
        :aria-valuemin="220"
        :aria-valuemax="480"
        :aria-valuenow="sidebarWidth"
        tabindex="0"
        @pointerdown="resizeSidebarStart"
        @keydown="keyboardResizeSidebar"
      />
    </aside>

    <section
      class="editor-pane"
      :class="{ editing: editorMode !== 'preview' }"
      :style="{ '--note-font-size': `${fontSize}px` }"
    >
      <div class="editor-main">
        <header class="editor-toolbar">
          <button
            type="button"
            class="toolbar-icon"
            :aria-label="sidebarOpen ? '隐藏侧栏' : '显示侧栏'"
            :title="sidebarOpen ? '隐藏侧栏' : '显示侧栏'"
            @click="sidebarOpen = !sidebarOpen"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <rect x="2.8" y="3.8" width="14.4" height="12.4" rx="2.2" />
              <path d="M8 4v12" />
            </svg>
          </button>

          <div class="editor-title">
            <strong :title="selectedPath || undefined">{{ selectedPath ? noteTitle : '未打开笔记' }}</strong>
            <span v-if="selectedPath" class="mode-indicator">
              <svg v-if="editorMode === 'preview'" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M1.8 8s2.3-4 6.2-4 6.2 4 6.2 4-2.3 4-6.2 4S1.8 8 1.8 8Z" />
                <circle cx="8" cy="8" r="1.8" />
              </svg>
              <svg v-else-if="editorMode === 'source'" viewBox="0 0 16 16" aria-hidden="true">
                <path d="m5.6 4.6-3 3.4 3 3.4M10.4 4.6l3 3.4-3 3.4" />
              </svg>
              <svg v-else viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3 12.7 4.2 9 11 2.2l2.5 2.5-6.8 6.8z" />
                <path d="m9.6 3.8 2.4 2.4" />
              </svg>
              {{ modeChipLabel(editorMode) }}
            </span>
            <span
              v-if="dirty && editorMode === 'preview'"
              class="dirty-dot"
              title="有未保存的更改"
              aria-label="有未保存的更改"
            />
          </div>

          <div class="editor-actions">
            <div v-if="pluginRibbons.length" class="plugin-ribbon" role="toolbar" aria-label="插件 Ribbon">
              <button
                v-for="r in pluginRibbons"
                :key="`${r.pluginId}:${r.id}`"
                type="button"
                class="plugin-btn"
                :title="r.title"
                @click="runRibbon(r)"
              >
                {{ r.icon || r.title }}
              </button>
            </div>

            <button
              type="button"
              class="command-btn"
              aria-haspopup="dialog"
              :aria-expanded="paletteOpen"
              :aria-label="`命令面板（${modKey}K）`"
              :title="`命令面板（${modKey}K）`"
              @click.stop="paletteOpen = true"
            >
              <svg class="command-btn-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6"/><path d="m15.6 15.6 4 4"/></svg>
              命令 <kbd>{{ modKey }}K</kbd>
            </button>

            <button
              v-if="selectedPath"
              type="button"
              class="toolbar-icon outline-toggle"
              :aria-pressed="outlineOpen && outlineTab === 'outline'"
              :title="outlineOpen && outlineTab === 'outline' ? '隐藏大纲' : '显示大纲'"
              :aria-label="outlineOpen && outlineTab === 'outline' ? '隐藏大纲' : '显示大纲'"
              @click="toggleOutlinePanel"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <rect x="2.8" y="3.8" width="14.4" height="12.4" rx="2.2" />
                <path d="M12.5 4v12" />
                <path v-if="outlineOpen" d="m13.6 8.6 2 1.4-2 1.4" />
                <path v-else d="m15.6 8.6-2 1.4 2 1.4" />
              </svg>
            </button>
          </div>
        </header>

        <p v-if="externalNotice" class="external-banner" role="status">
          <span>{{ externalNotice }}</span>
          <button v-if="dirty" type="button" class="ghost compact" @click="reloadExternal">加载磁盘版本</button>
        </p>

        <div v-if="selectedPath && editorUnavailable" class="editor-empty" role="status">
          <span class="empty-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M6 3.5h8l4 4v13H6z" />
              <path d="M14 3.8v4h3.8" />
              <path d="M9 13h6" />
            </svg>
          </span>
          <p>当前笔记类型没有可用编辑器。</p>
          <p class="book-small">启用提供该类型的扩展后即可打开；文件内容不受影响。</p>
        </div>

        <div v-else-if="selectedPath" ref="editorMountEl" class="editor-body"></div>

        <div v-else class="editor-empty">
          <span class="empty-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 6.4C9.9 5.2 7.3 4.8 4.6 5.2v13c2.7-.4 5.3 0 7.4 1.2 2.1-1.2 4.7-1.6 7.4-1.2v-13c-2.7-.4-5.3 0-7.4 1.2Z" />
              <path d="M12 6.4v13" />
            </svg>
          </span>
          <p class="eyebrow">V5NOTES · VAULT</p>
          <h2>从左侧打开一篇笔记</h2>
          <p class="empty-lede">打开后为只读预览；点「编辑」开始写作，切回预览前会先保存。</p>
          <div class="empty-actions">
            <template v-if="creatableKinds.length > 1">
              <button
                v-for="kind in creatableKinds"
                :key="kind.id"
                type="button"
                class="primary"
                @click="createNoteOfKind(kind.id)"
              >{{ kind.newLabel }}</button>
            </template>
            <button v-else type="button" class="primary" @click="createNoteRoot">新建笔记</button>
            <button type="button" class="secondary" @click="openCreateDir(null)">新建目录</button>
          </div>
          <p class="empty-shortcuts">
            <kbd>{{ modKey }}</kbd><kbd>S</kbd> 保存
            <span>·</span>
            <kbd>{{ modKey }}</kbd><kbd>N</kbd> 新建
            <button
              v-if="creatableKinds.length > 1"
              type="button"
              class="shortcut-choice"
              @click="openCreateMenu"
            >
              <kbd>{{ modKey }}</kbd><kbd>⇧</kbd><kbd>N</kbd> 选择类型
            </button>
          </p>
        </div>

        <EditorModeDock
          v-if="selectedPath && !externalNotice"
          :mode="editorMode === 'preview' ? 'preview' : 'edit'"
          :source-mode="sourceMode"
          :dirty="dirty"
          :busy="busy"
          @edit="enterEdit"
          @save="saveCurrent"
          @done="leaveEdit"
        />

        <p v-if="toast" class="workspace-toast" role="status">{{ toast }}</p>

        <EditorPalette
          :open="paletteOpen"
          :commands="commands"
          :context="commandContext"
          :editor-theme="editorThemePreference"
          :resolved-theme="editorTheme"
          @close="paletteOpen = false"
          @run="runEditorCommand"
          @theme="setEditorThemePreference"
        />
      </div>

      <aside v-show="outlineOpen && !!selectedPath" class="outline-sidebar" aria-label="大纲与查找">
        <header class="outline-header">
          <div class="outline-tabs" role="tablist" aria-label="侧栏视图">
            <button
              type="button"
              role="tab"
              :aria-selected="outlineTab === 'outline'"
              @click="setOutlineTab('outline')"
            >大纲</button>
            <button
              type="button"
              role="tab"
              :aria-selected="outlineTab === 'find'"
              @click="setOutlineTab('find')"
            >查找</button>
          </div>
        </header>

        <div class="outline-body">
          <nav v-show="outlineTab === 'outline'" class="outline-list" aria-label="大纲">
            <button
              v-for="entry in outlineEntries"
              :key="`${entry.start}-${entry.text}`"
              type="button"
              :style="{ paddingLeft: `${(entry.depth - 1) * 12 + 8}px` }"
              @click="focusOutline(entry.start)"
            >{{ entry.text }}</button>
            <p v-if="!outlineEntries.length" class="outline-empty">暂无标题</p>
          </nav>

          <div v-show="outlineTab === 'find'" class="find-panel" role="tabpanel" aria-label="查找">
            <div class="find-fields">
              <button
                type="button"
                class="find-expand"
                :aria-expanded="replaceExpanded"
                :aria-label="replaceExpanded ? '收起替换' : '展开替换'"
                :title="replaceExpanded ? '收起替换' : '展开替换'"
                @click="replaceExpanded = !replaceExpanded"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path
                    :d="replaceExpanded ? 'm5.5 7.5 4.5 4.5 4.5-4.5' : 'm7.5 5.5 4.5 4.5-4.5 4.5'"
                  />
                </svg>
              </button>
              <div class="find-field-stack">
                <div class="find-query-row">
                  <input
                    ref="findInput"
                    v-model="findQuery"
                    class="find-query"
                    type="search"
                    placeholder="查找"
                    aria-label="查找"
                    @keydown.enter.prevent="findStep($event.shiftKey ? -1 : 1)"
                    @keydown.esc.stop="findQuery = ''; runFind(true)"
                  />
                  <div class="find-options">
                    <button
                      type="button"
                      class="find-toggle"
                      :class="{ 'is-on': caseSensitive }"
                      :aria-pressed="caseSensitive"
                      title="区分大小写"
                      aria-label="区分大小写"
                      @click="caseSensitive = !caseSensitive"
                    >Aa</button>
                    <button
                      type="button"
                      class="find-toggle"
                      :class="{ 'is-on': wholeWord }"
                      :aria-pressed="wholeWord"
                      title="全词匹配"
                      aria-label="全词匹配"
                      @click="wholeWord = !wholeWord"
                    >ab</button>
                    <button
                      type="button"
                      class="find-toggle"
                      :class="{ 'is-on': useRegexp }"
                      :aria-pressed="useRegexp"
                      title="正则表达式"
                      aria-label="正则表达式"
                      @click="useRegexp = !useRegexp"
                    >.*</button>
                    <button type="button" class="find-step" title="上一个" aria-label="上一个" @click="findStep(-1)">
                      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 12 4.5-4.5 4.5 4.5" /></svg>
                    </button>
                    <button type="button" class="find-step" title="下一个" aria-label="下一个" @click="findStep(1)">
                      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 8 4.5 4.5L14.5 8" /></svg>
                    </button>
                  </div>
                </div>
                <div v-if="replaceExpanded" class="find-replace-row">
                  <input
                    v-model="replacement"
                    class="find-replace"
                    type="text"
                    placeholder="替换为"
                    aria-label="替换为"
                    :disabled="editorMode === 'preview'"
                  />
                  <button type="button" class="find-replace-action" :disabled="!canReplace" @click="replaceOne">
                    替换
                  </button>
                  <button type="button" class="find-replace-action" :disabled="!canReplace" @click="replaceEvery">
                    全部替换
                  </button>
                </div>
              </div>
            </div>
            <p class="find-status">{{ findStatus }}</p>
            <ul v-if="findHits.length" class="find-hits" aria-label="匹配结果">
              <li v-for="(hit, index) in findHits" :key="`${hit.from}-${hit.to}`">
                <button
                  type="button"
                  :class="{ current: index === findCurrent }"
                  :aria-current="index === findCurrent ? 'true' : undefined"
                  @click="selectFindHit(index)"
                >
                  <span class="find-index">{{ hit.index }}</span>
                  <span class="find-line">{{ hit.before }}<mark>{{ hit.match }}</mark>{{ hit.after }}</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </aside>
    </section>

    <NameDialog
      :open="!!nameDialog"
      :title="
        nameDialog?.mode === 'note'
          ? docKindById(nameDialog.docKind ?? MARKDOWN_KIND)?.label.replace('笔记', '') + '笔记'
          : nameDialog?.mode === 'dir'
            ? '新建目录'
            : '重命名'
      "
      :label="nameDialog?.mode === 'dir' ? '目录名' : '名称'"
      :initial-value="
        nameDialog?.mode === 'rename' && nameDialog.target
          ? displayNameOfIn(creatableKinds, nameDialog.target.name)
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

    <MoveDialog
      :open="!!moveDialog"
      :title="moveDialog?.node.kind === 'dir' ? '移动目录' : '移动笔记'"
      :subject="
        moveDialog
          ? moveDialog.node.kind === 'dir'
            ? moveDialog.node.name
            : displayNameOfIn(creatableKinds, moveDialog.node.name)
          : ''
      "
      :targets="moveTargets"
      :initial-path="moveDialog ? parentDirOf(moveDialog.node.path) : ''"
      :busy="!!moveDialog?.submitting"
      :error="moveDialog?.error"
      @cancel="moveDialog = null"
      @submit="submitMove"
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

    <AttachmentPickerDialog
      ref="attachmentPickerRef"
      :is-open="attachmentOpen"
      :busy="attachmentBusy"
      :attachments="attachmentList"
      :referenced="referencedAttachments"
      @cancel="closeAttachmentDialog"
      @insert="onAttachmentInsert"
      @remove="onAttachmentRemove"
      @import-files="onAttachmentImportFiles"
      @load-url="onAttachmentLoadUrl"
      @refresh="refreshAttachments"
    />
  </div>
</template>
