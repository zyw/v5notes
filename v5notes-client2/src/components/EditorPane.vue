<script setup lang="ts">
import { invoke, isTauri } from '@tauri-apps/api/core'
import { listMatches, type FindOptions } from '@v5md/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import EditorModeDock from './EditorModeDock.vue'
import EditorPalette from './EditorPalette.vue'
import ImageLibraryDialog from './ImageLibraryDialog.vue'
import { useWorkspaceContext } from '../hooks/workspaceContext'
import { editorLocale } from '../i18n'
import type { LibraryImage } from '../service/api'
import { canReplace, closeFindView, findStatus, matchPreview, openFindView, type FindKind, type FindMatchPreview, type FindSidebarState, type SidebarView } from '../models/findSidebar'
import { buildEditorCommands, modeSwitchLabel, type CommandActions, type CommandContext, type EditorCommand, type ExportFormat, type WorkspaceMode } from '../models/editorCommands'
import { PDF_CONTENT_HEIGHT, PDF_CONTENT_WIDTH, buildMarkdownDocument, buildRenderedDocument, computePdfSlices, downloadBlob, downloadText, exportFileName, fetchImageDataUrl, renderNotePdf, renderNotePng, rewriteImageSources, snapshotRenderedHtml, type PdfBlock } from '../utils/exportFile'
import { modShortcut } from '../utils/platform'
const { t, locale } = useI18n()
const { sessionExpired, reauthenticate, error, notice, trialExpired, draft, directoryVisible, focusMode, toggleSidebar, editorMode, sourceMode, toggleSourceMode, toolbarVisible, toggleToolbar, outlineVisible, editorInstance, activeActionMenu, syncActionMenu, renameNote, copyNoteContent, deleteNote, finishEditing, save, openHistory, selectedId, content, api, editorReady, newNote, server } = useWorkspaceContext()
const outlineWidth = ref(Number(localStorage.getItem('v5notes-outline-width')) || 270)
const resizingOutline = ref(false)
const sidebarView = ref<SidebarView>('outline')
const replaceExpanded = ref(false)
const findQuery = ref('')
const replacement = ref('')
const caseSensitive = ref(false)
const wholeWord = ref(false)
const useRegexp = ref(false)
const findMessage = ref('')
const findHits = ref<FindMatchPreview[]>([])
const currentMatch = ref<{ from: number, to: number } | null>(null)
const findInput = ref<HTMLInputElement | null>(null)
const findList = ref<HTMLElement | null>(null)
const libraryOpen = ref(false)
const findOptions = computed<FindOptions>(() => ({
  caseSensitive: caseSensitive.value,
  wholeWord: wholeWord.value,
  regexp: useRegexp.value,
}))
const replacing = computed(() => canReplace(editorMode.value === 'edit'))
const outlineEntries = computed(() => {
  void content.value
  return editorInstance.value?.getOutline() ?? []
})

const FONT_MIN = 13
const FONT_MAX = 26
const fontSize = ref(Number(localStorage.getItem('v5notes-editor-font-size')) || 17)
if (!Number.isFinite(fontSize.value) || fontSize.value < FONT_MIN || fontSize.value > FONT_MAX) fontSize.value = 17
const paletteOpen = ref(false)
const exporting = ref(false)
const fontPresets = computed(() => [
  { size: 15, label: t('editor.fontSmall', { size: 15 }) },
  { size: 17, label: t('editor.fontNormal', { size: 17 }) },
  { size: 19, label: t('editor.fontLarge', { size: 19 }) },
  { size: 22, label: t('editor.fontXLarge', { size: 22 }) },
])

function onFontRange(event: Event): void {
  applyFontSize(Number((event.target as HTMLInputElement).value))
}

function applyFontSize(next: number): void {
  const clamped = Math.max(FONT_MIN, Math.min(FONT_MAX, Math.round(next)))
  fontSize.value = clamped
  localStorage.setItem('v5notes-editor-font-size', String(clamped))
}

const commandContext = computed<CommandContext>(() => ({
  mode: (editorMode.value === 'preview' ? 'preview' : sourceMode.value ? 'source' : 'edit') as WorkspaceMode,
  focusMode: focusMode.value,
  toolbarVisible: toolbarVisible.value,
  hasNote: Boolean(draft.note),
  dirty: draft.dirty,
  fontSize: fontSize.value,
}))

/**
 * Switch the workspace mode and echo the change with the design's bottom toast.
 * Preview only reports success once `finishEditing` truly lands, so a failed
 * save keeps the user in edit mode without a misleading toast.
 */
async function enterMode(mode: WorkspaceMode): Promise<void> {
  if (mode === 'preview') {
    if (editorMode.value === 'preview') return
    if (await finishEditing()) showModeToast('preview')
    return
  }
  if (editorMode.value !== 'edit') editorMode.value = 'edit'
  if (mode === 'source' && !sourceMode.value) toggleSourceMode()
  if (mode === 'edit' && sourceMode.value) toggleSourceMode()
  showModeToast(mode)
}

function setMode(mode: WorkspaceMode): void {
  void enterMode(mode)
}

/**
 * The webview cannot read cross-origin image bytes (CORS), and drawing a
 * cross-origin image would taint the export canvas. The desktop shell fetches
 * images through Rust instead; browser dev falls back to a normal request.
 */
async function loadExportImage(source: string): Promise<string> {
  if (isTauri()) {
    try {
      return await invoke<string>('fetch_image_data_url', { url: source })
    } catch (cause) {
      console.warn('[export] 宿主取图失败，尝试浏览器请求：', source, cause)
    }
  }
  return fetchImageDataUrl(source)
}

const toast = ref<{ message: string; tone: 'ok' | 'warn' } | null>(null)
let toastTimer: number | undefined
function showToast(message: string, tone: 'ok' | 'warn' = 'ok'): void {
  toast.value = { message, tone }
  if (toastTimer !== undefined) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.value = null }, 4000)
}
onBeforeUnmount(() => { if (toastTimer !== undefined) window.clearTimeout(toastTimer) })

// Mode switching is a user-facing state change; echo it with the design's bottom toast.
const modeToast = ref<string | null>(null)
let modeToastTimer: number | undefined
function showModeToast(mode: WorkspaceMode): void {
  modeToast.value = modeSwitchLabel(mode)
  if (modeToastTimer !== undefined) window.clearTimeout(modeToastTimer)
  modeToastTimer = window.setTimeout(() => { modeToast.value = null }, 2200)
}
onBeforeUnmount(() => { if (modeToastTimer !== undefined) window.clearTimeout(modeToastTimer) })

/**
 * macOS: writes a vector, selectable PDF straight into ~/Downloads through
 * NSPrintOperation(NSPrintSaveJob) — no print dialog. Returns false when the
 * platform/command is unavailable so the caller can fall back to the image PDF.
 */
async function exportVectorPdf(fileName: string): Promise<boolean> {
  if (!isTauri()) return false
  // createPDF captures the screen layout, so the app chrome has to be hidden by
  // class (not @media print) and the document measured in that state.
  document.body.classList.add('is-exporting')
  try {
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 120))
    // .v5-doc is the text column itself: it excludes the format strip above it.
    const canvas = document.querySelector<HTMLElement>('.editor-pane .v5-doc')
      ?? document.querySelector<HTMLElement>('.editor-mount')
    if (!canvas) throw new Error(t('editor.missingCanvas'))
    const rect = canvas.getBoundingClientRect()
    const x = Math.round(rect.left + window.scrollX)
    const y = Math.round(rect.top + window.scrollY)
    const width = Math.ceil(rect.width)
    const height = Math.ceil(canvas.scrollHeight)
    // Break pages on block boundaries so an image is never cut in half.
    const scale = PDF_CONTENT_WIDTH / width
    const blocks: PdfBlock[] = []
    canvas.querySelectorAll<HTMLElement>('img, figure, pre, table, blockquote, .v5-image, .v5-image-frame, .v5-mermaid, .v5-math')
      .forEach(node => {
        const box = node.getBoundingClientRect()
        blocks.push({ top: box.top - rect.top, bottom: box.bottom - rect.top, atomic: true })
      })
    canvas.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6').forEach(node => {
      const box = node.getBoundingClientRect()
      blocks.push({ top: box.top - rect.top, bottom: box.bottom - rect.top, heading: true })
    })
    const slices = computePdfSlices(height, PDF_CONTENT_HEIGHT / scale, blocks)
      .map(slice => [Math.round(slice.top), Math.round(slice.height)])
    const path = await invoke<string>('export_pdf', { fileName, x, y, width, height, slices })
    showToast(t('editor.exportedVector', { path }))
    return true
  } catch (cause) {
    console.warn('[export] 矢量 PDF 不可用，改用图片版：', cause)
    return false
  } finally {
    document.body.classList.remove('is-exporting')
  }
}

/** Snapshot of the rendered note: KaTeX formulas, diagrams and images included. */
function renderedBodyHtml(): string {
  const element = editorInstance.value?.getContentElement()
    ?? document.querySelector<HTMLElement>('.editor-pane .v5-doc')
  return snapshotRenderedHtml(element)
}

async function exportNote(format: ExportFormat): Promise<void> {
  const note = draft.note
  if (!note || exporting.value) return
  exporting.value = true
  try {
    if (draft.dirty) {
      await save()
      if (draft.dirty) {
        error.value = t('editor.exportCancelled')
        return
      }
    }
    // The live editor DOM already has KaTeX and Mermaid rendered; the wechat-HTML
    // converter would degrade them back to source code. Relative image paths still
    // have to be pointed at the notes server instead of the webview origin.
    const payload = {
      name: note.name,
      markdown: note.content,
      html: rewriteImageSources(renderedBodyHtml(), server.value),
    }
    if (format === 'markdown') {
      const fileName = exportFileName(note.name, 'md')
      downloadText(fileName, buildMarkdownDocument(payload), 'text/markdown')
      showToast(t('editor.exported', { fileName }))
    } else if (format === 'html') {
      const fileName = exportFileName(note.name, 'html')
      downloadText(fileName, buildRenderedDocument(note.name, payload.html), 'text/html')
      showToast(t('editor.exported', { fileName }))
    } else if (format === 'pdf' || format === 'pdf-image') {
      const fileName = exportFileName(note.name, 'pdf')
      // The vector path prints the live view, so source mode would print the
      // markdown source instead of the formatted note.
      if (format === 'pdf' && sourceMode.value) {
        setMode('edit')
        await nextTick()
        await new Promise(resolve => setTimeout(resolve, 60))
      }
      // Vector first (macOS prints the live view in-app, no dialog); anything
      // that fails falls back to the cross-platform image PDF.
      if (format === 'pdf' && (await exportVectorPdf(fileName))) return
      const { blob, pages, missingImages } = await renderNotePdf(payload.html, { serverBase: server.value, loadImage: loadExportImage })
      downloadBlob(fileName, blob)
      showToast(
        missingImages
          ? t('editor.exportedPdfMissing', { fileName, pages, missing: missingImages })
          : t('editor.exportedPdf', { fileName, pages }),
        missingImages ? 'warn' : 'ok',
      )
    } else {
      const fileName = exportFileName(note.name, 'png')
      const { blob, missingImages } = await renderNotePng(payload.html, { serverBase: server.value, loadImage: loadExportImage })
      downloadBlob(fileName, blob)
      showToast(
        missingImages
          ? t('editor.exportedImageMissing', { fileName, missing: missingImages })
          : t('editor.exported', { fileName }),
        missingImages ? 'warn' : 'ok',
      )
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('editor.exportFailed')
  } finally {
    exporting.value = false
  }
}

const commandActions: CommandActions = {
  setMode,
  toggleFocus: () => { focusMode.value = !focusMode.value },
  toggleToolbar,
  openHistory: () => { if (editorMode.value !== 'preview') void openHistory() },
  changeFontSize: delta => applyFontSize(fontSize.value + delta),
  exportNote: format => { void exportNote(format) },
  renameNote,
  copyMarkdown: () => { void copyNoteContent() },
  deleteNote,
}
const commands = computed(() => {
  void locale.value
  return buildEditorCommands(commandActions)
})

function runCommand(command: EditorCommand): void {
  // Repeatable commands (font size) stay in the palette so they can be repeated.
  if (!command.keepOpen) paletteOpen.value = false
  void command.run()
}

function onGlobalKeydown(event: KeyboardEvent): void {
  const modifier = event.metaKey || event.ctrlKey
  if (!modifier || event.altKey) return
  if ((event.target as HTMLElement | null)?.closest('.modal-backdrop')) return
  const key = event.key.toLowerCase()
  if (key === 'k') {
    event.preventDefault()
    paletteOpen.value = true
    return
  }
  if (event.key === '/') {
    event.preventDefault()
    if (editorMode.value === 'edit' && !sourceMode.value) toggleToolbar()
    return
  }
  if (!draft.note) return
  if (key === '1' || key === '2' || key === '3') {
    event.preventDefault()
    setMode(key === '1' ? 'edit' : key === '2' ? 'source' : 'preview')
    return
  }
  if (event.key === '.') {
    event.preventDefault()
    if (editorMode.value !== 'preview') focusMode.value = !focusMode.value
    return
  }
  if (key === 'y') {
    if (editorMode.value === 'preview') return
    event.preventDefault()
    void openHistory()
  }
}

function openImageLibrary(): void {
  if (editorMode.value !== 'edit') return
  libraryOpen.value = true
}

function insertLibraryImage(image: LibraryImage): void {
  const alt = image.name.replace(/\.[^.]+$/, '').trim() || t('editor.imageAlt')
  editorInstance.value?.insertImageUrl(image.url, alt)
  libraryOpen.value = false
}

function onEditorReady(instance: Parameters<typeof editorReady>[0]): void {
  editorReady(instance)
  instance.setOutlineVisible(false)
  if (sidebarView.value === 'find') refreshFind(false)
}

function sidebarState(): FindSidebarState {
  return { visible: outlineVisible.value, view: sidebarView.value, replaceExpanded: replaceExpanded.value }
}

function applySidebar(next: FindSidebarState): void {
  outlineVisible.value = next.visible
  sidebarView.value = next.view
  replaceExpanded.value = next.replaceExpanded
}

function onFindRequest(request: { kind: FindKind }): void {
  applySidebar(openFindView(sidebarState(), request.kind))
  void nextTick(() => {
    findInput.value?.focus()
    refreshFind(false)
    findInput.value?.select()
  })
}

function dismissFind(): void {
  applySidebar(closeFindView(sidebarState()))
  editorInstance.value?.focus()
}

function selectFindQuery(): void {
  findInput.value?.focus()
  findInput.value?.select()
}

function onFindKeydown(event: KeyboardEvent): void {
  const mod = event.metaKey || event.ctrlKey
  const key = event.key.toLowerCase()
  if (mod && !event.altKey && !event.shiftKey && key === 'f') {
    event.preventDefault()
    selectFindQuery()
    return
  }
  if (mod && !event.altKey && !event.shiftKey && key === 'h') {
    event.preventDefault()
    replaceExpanded.value = true
    selectFindQuery()
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    dismissFind()
    return
  }
  if (event.key === 'Enter' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const backward = event.key === 'ArrowUp' || (event.key === 'Enter' && event.shiftKey)
    refreshFind(true, backward ? -1 : 1)
  }
}

interface FindFieldCaret {
  field: HTMLInputElement
  start: number
  end: number
  value: string
}

function focusedFindField(): FindFieldCaret | null {
  const field = document.activeElement
  if (!(field instanceof HTMLInputElement) || !field.closest('.find-panel')) return null
  return {
    field,
    start: field.selectionStart ?? field.value.length,
    end: field.selectionEnd ?? field.value.length,
    value: field.value,
  }
}

function editorHoldsCaret(editor: { getContentElement(): HTMLElement }): boolean {
  const surface = editor.getContentElement()
  const active = document.activeElement
  if (active === surface || (active instanceof Node && surface.contains(active))) return true
  const node = document.getSelection()?.anchorNode
  return !!node && (node === surface || surface.contains(node))
}

function restoreFindFieldCaret(editor: { getContentElement(): HTMLElement }, caret: FindFieldCaret): void {
  const apply = () => {
    const { field, start, end, value } = caret
    if (!field.isConnected || field.value !== value || !editorHoldsCaret(editor)) return
    field.focus({ preventScroll: true })
    const max = field.value.length
    field.setSelectionRange(Math.min(start, max), Math.min(end, max))
  }
  apply()
  queueMicrotask(apply)
  requestAnimationFrame(apply)
}

function onFindQueryInput(event: Event): void {
  if (event instanceof InputEvent && event.isComposing) return
  refreshFind(false)
}

function refreshFind(advance: boolean, direction: 1 | -1 = 1): void {
  const editor = editorInstance.value
  if (!editor) return
  const caret = focusedFindField()
  const result = editor.findNextMatch(findQuery.value, findOptions.value, direction, advance)
  showFindResult(editor.getMarkdown(), result)
  if (caret) restoreFindFieldCaret(editor, caret)
}

function showFindResult(doc: string, result: { hit: { from: number, to: number, index: number, total: number } | null, error: string | null }): void {
  const listed = listMatches(doc, findQuery.value, findOptions.value)
  findHits.value = listed.error ? [] : listed.matches.map((match) => matchPreview(doc, match.from, match.to, match.index))
  currentMatch.value = result.hit ? { from: result.hit.from, to: result.hit.to } : null
  findMessage.value = findStatus(findQuery.value, listed.error ? { hit: null, error: listed.error } : result)
  void nextTick(() => findList.value?.querySelector('.is-current')?.scrollIntoView({ block: 'nearest' }))
}

function isCurrentMatch(item: FindMatchPreview): boolean {
  return currentMatch.value?.from === item.from && currentMatch.value.to === item.to
}

function goToMatch(item: FindMatchPreview): void {
  const editor = editorInstance.value
  if (!editor) return
  editor.selectFindMatch(item.from, item.to)
  currentMatch.value = { from: item.from, to: item.to }
  findMessage.value = findStatus(findQuery.value, { hit: { index: item.index, total: findHits.value.length }, error: null })
  void nextTick(() => findList.value?.querySelector('.is-current')?.scrollIntoView({ block: 'nearest' }))
}

function toggleFindOption(option: 'case' | 'word' | 'regexp'): void {
  if (option === 'case') caseSensitive.value = !caseSensitive.value
  else if (option === 'word') wholeWord.value = !wholeWord.value
  else useRegexp.value = !useRegexp.value
  refreshFind(false)
}

function replaceOne(): void {
  if (!replacing.value) return
  const editor = editorInstance.value
  if (!editor) return
  const result = editor.replaceNextMatch(findQuery.value, replacement.value, findOptions.value)
  showFindResult(editor.getMarkdown(), result)
}

function replaceEvery(): void {
  if (!replacing.value) return
  const editor = editorInstance.value
  if (!editor) return
  const result = editor.replaceAllMatches(findQuery.value, replacement.value, findOptions.value)
  showFindResult(editor.getMarkdown(), result)
}

watch(selectedId, () => {
  if (sidebarView.value === 'find') void nextTick(() => refreshFind(false))
})

function closeActionMenu(event: MouseEvent): void {
  const menu = (event.currentTarget as HTMLElement).closest('details')
  if (menu) menu.open = false
  activeActionMenu.value = null
}

function focusOutline(start: number): void {
  editorInstance.value?.focusAt(start)
}

function resizeOutline(event: PointerEvent): void {
  if (!resizingOutline.value) return
  outlineWidth.value = Math.max(190, Math.min(520, window.innerWidth - event.clientX))
}

function startOutlineResize(event: PointerEvent): void {
  if (event.button !== 0) return
  resizingOutline.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  resizeOutline(event)
}

function stopOutlineResize(): void {
  if (!resizingOutline.value) return
  resizingOutline.value = false
  localStorage.setItem('v5notes-outline-width', String(outlineWidth.value))
}

function keyboardResizeOutline(event: KeyboardEvent): void {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  const direction = event.key === 'ArrowLeft' ? 1 : -1
  outlineWidth.value = Math.max(190, Math.min(520, outlineWidth.value + direction * 16))
  localStorage.setItem('v5notes-outline-width', String(outlineWidth.value))
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKeydown))
</script>

<template>
    <main class="editor-pane" :class="{ 'is-resizing-outline': resizingOutline }" :style="{ '--outline-width': `${outlineVisible ? outlineWidth : 0}px`, '--doc-size': `${fontSize}px` }" @pointermove="resizeOutline" @pointerup="stopOutlineResize" @pointercancel="stopOutlineResize">
      <div v-if="sessionExpired" class="session-alert">{{ t('editor.sessionExpired') }}<button @click="reauthenticate">{{ t('editor.reauthenticate') }}</button></div>
      <div v-if="trialExpired" class="trial-alert" role="status">{{ t('trial.expired') }}</div>
      <div v-if="notice" class="notice-bar">{{ notice }} <button @click="notice = ''">×</button></div>
      <div v-if="error" class="error-bar" role="alert">{{ error }} <button @click="error = ''">×</button></div>
      <Teleport to="body">
        <Transition name="export-toast">
          <div v-if="toast" class="export-toast" :class="`is-${toast.tone}`" role="status" aria-live="polite">
            <svg class="export-toast-icon" viewBox="0 0 20 20" aria-hidden="true">
              <path v-if="toast.tone === 'ok'" d="m4.5 10.5 3.5 3.5 7.5-8" />
              <path v-else d="M10 5.5v5.5m0 3v.5" />
              <circle v-if="toast.tone !== 'ok'" cx="10" cy="10" r="7.5" />
            </svg>
            <span class="export-toast-text">{{ toast.message }}</span>
            <button type="button" class="export-toast-close" :aria-label="t('editor.dismissToast')" @click="toast = null">×</button>
          </div>
        </Transition>
        <Transition name="mode-toast">
          <div v-if="modeToast" class="mode-toast" role="status" aria-live="polite">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.5 3.4 3.4 7.6-7.6" /></svg>
            <span>{{ modeToast }}</span>
          </div>
        </Transition>
      </Teleport>
      <template v-if="draft.note">
        <header class="editor-header">
          <div class="editor-toolbar-left">
            <button class="toolbar-icon sidebar-toggle" :aria-pressed="directoryVisible && !focusMode" :aria-label="directoryVisible ? t('editor.collapseSidebar') : t('editor.expandSidebar')" :title="directoryVisible ? t('editor.collapseSidebar') : t('editor.expandSidebar')" @click="toggleSidebar">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M9 4v16"/><path v-if="directoryVisible" d="m15 9-3 3 3 3"/><path v-else d="m12 9 3 3-3 3"/></svg>
            </button>
            <div class="note-identity">
              <span class="note-name" :title="draft.note.name">{{ draft.note.name }}</span>
              <span v-if="editorMode === 'preview'" class="preview-state"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 10s2.8-4.5 8-4.5 8 4.5 8 4.5-2.8 4.5-8 4.5S2 10 2 10Z"/><circle cx="10" cy="10" r="2"/></svg>{{ t('editor.previewing') }}</span>
              <span v-else-if="sourceMode" class="preview-state"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 6-3.5 4 3.5 4M13 6l3.5 4-3.5 4"/></svg>{{ t('editor.source') }}</span>
              <span v-if="draft.dirty" class="save-state unsaved"><i />{{ t('editor.unsaved') }}</span>
            </div>
          </div>
          <div class="actions">
            <button class="command-trigger" type="button" :aria-label="t('editor.openPalette')" :title="t('editor.paletteTitle', { shortcut: modShortcut('K') })" @click="paletteOpen = true">
              <span>{{ t('editor.commands') }}</span><kbd>{{ modShortcut('K') }}</kbd>
            </button>
            <template v-if="editorMode !== 'preview'">
              <details class="action-menu note-menu" data-action-menu="note" @toggle="syncActionMenu('note', $event)">
                <summary :aria-label="t('editor.moreNoteActions')" :title="t('editor.moreNoteActions')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14M5 12h14M5 16h14"/></svg></summary>
                <div class="popover-menu" @click="closeActionMenu">
                  <button @click="renameNote"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.8 3.2 4 4M3 17l3.8-.8L16 7a1.4 1.4 0 0 0-2-2L4.8 14.2z"/></svg>{{ t('editor.rename') }}</button>
                  <button @click="copyNoteContent"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="6" width="10" height="11" rx="1.5"/><path d="M13 6V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"/></svg>{{ t('editor.copyMarkdown') }}</button>
                  <button @click="openHistory"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="M10 6.5V10l2.5 1.5"/></svg>{{ t('editor.history') }}</button>
                  <button class="danger-menu-item" @click="deleteNote"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 5.5h13M8 5.5V3.5h4v2M5.5 5.5l.8 11h7.4l.8-11M8.5 8.5v5M11.5 8.5v5"/></svg>{{ t('editor.deleteNote') }}</button>
                </div>
              </details>
            </template>
            <button class="toolbar-icon outline-toggle" :aria-pressed="outlineVisible" :aria-label="outlineVisible ? t('editor.hideOutline') : t('editor.showOutline')" :title="outlineVisible ? t('editor.hideOutline') : t('editor.showOutline')" @click="outlineVisible = !outlineVisible">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M14 4v16"/><path v-if="outlineVisible" d="m15 9 3 3-3 3"/><path v-else d="m18 9-3 3 3 3"/></svg>
            </button>
          </div>
        </header>
        <div class="editor-body">
          <div v-if="editorMode === 'edit' && !sourceMode && toolbarVisible" class="strip-tools">
            <details class="font-menu">
              <summary :aria-label="t('editor.fontSize')" :title="t('editor.fontSize')"><span class="font-aa">Aa</span><span class="font-current">{{ fontSize }}</span></summary>
              <div class="font-panel">
                <div class="font-head"><strong>{{ t('editor.bodySize') }}</strong><span>{{ t('editor.fontScope') }}</span></div>
                <div class="font-value">
                  <button type="button" class="font-step" :aria-label="t('editor.decreaseFont')" @click="applyFontSize(fontSize - 1)">−</button>
                  <div class="font-read">{{ fontSize }}<small> px</small></div>
                  <button type="button" class="font-step" :aria-label="t('editor.increaseFont')" @click="applyFontSize(fontSize + 1)">+</button>
                </div>
                <input class="font-range" type="range" min="13" max="26" step="1" :value="fontSize" :aria-label="t('editor.fontSlider')" @input="onFontRange">
                <div class="font-presets">
                  <button v-for="preset in fontPresets" :key="preset.size" type="button" :aria-pressed="fontSize === preset.size" @click="applyFontSize(preset.size)">{{ preset.label }}</button>
                </div>
                <div class="font-note"><span>{{ t('editor.fontRemembered') }}</span><button type="button" @click="applyFontSize(17)">{{ t('editor.reset') }}</button></div>
              </div>
            </details>
            <span class="strip-divider" aria-hidden="true"></span>
            <button class="strip-hide" type="button" :title="t('editor.hideToolbarTitle', { shortcut: modShortcut('/') })" :aria-label="t('editor.hideToolbar')" @click="toggleToolbar">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 12.5 4.5-4.5 4.5 4.5"/></svg><span>{{ t('editor.hide') }}</span>
            </button>
          </div>
          <button v-if="editorMode === 'edit' && !sourceMode && !toolbarVisible" class="toolbar-reveal" type="button" :title="t('editor.showToolbarTitle', { shortcut: modShortcut('/') })" :aria-label="t('editor.showToolbar')" @click="toggleToolbar">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 7.5 4.5 4.5 4.5-4.5"/></svg>{{ t('editor.format') }}<kbd>{{ modShortcut('/') }}</kbd>
          </button>
          <div class="editor-scroll" :class="{ 'preview-scroll': editorMode === 'preview', 'edit-scroll': editorMode === 'edit' }">
            <div class="editor-paper">
              <div class="editor-mount">
                <V5Editor :key="selectedId" v-model="content" :locale="editorLocale(locale)" :placeholder="t('editor.placeholder')" :editable="editorMode === 'edit'" :on-upload-image="api.upload" :on-pick-image="openImageLibrary" :on-ready="onEditorReady" :on-find-request="onFindRequest" />
              </div>
            </div>
          </div>
          <EditorModeDock
            :mode="editorMode"
            :source-mode="sourceMode"
            :dirty="draft.dirty"
            @edit="setMode('edit')"
            @save="save"
            @done="setMode('preview')"
          />
        </div>
        <aside class="outline-sidebar" :class="{ 'is-hidden': !outlineVisible }" :aria-label="sidebarView === 'find' ? t('editor.findPane') : t('editor.outlinePane')">
          <header class="outline-header">
            <div class="outline-tabs" role="tablist" :aria-label="t('editor.sidebarViews')">
              <button type="button" role="tab" :aria-selected="sidebarView === 'outline'" @click="sidebarView = 'outline'">{{ t('editor.outline') }}</button>
              <button type="button" role="tab" :aria-selected="sidebarView === 'find'" @click="sidebarView = 'find'">{{ t('editor.find') }}</button>
            </div>
          </header>
          <div class="outline-body" :class="{ 'is-find': sidebarView === 'find' }">
            <nav v-show="sidebarView === 'outline'" class="outline-list" :aria-label="t('editor.outline')">
              <button v-for="entry in outlineEntries" :key="`${entry.start}-${entry.text}`" type="button" :style="{ paddingLeft: `${(entry.depth - 1) * 12 + 8}px` }" @click="focusOutline(entry.start)">{{ entry.text }}</button>
            </nav>
            <form v-show="sidebarView === 'find'" class="find-panel" role="tabpanel" :aria-label="t('editor.find')" @submit.prevent="refreshFind(true, 1)" @keydown="onFindKeydown">
              <div class="find-fields">
                <button type="button" class="find-expand" :aria-expanded="replaceExpanded" :aria-label="replaceExpanded ? t('editor.collapseReplace') : t('editor.expandReplace')" :title="replaceExpanded ? t('editor.collapseReplace') : t('editor.expandReplace')" @click="replaceExpanded = !replaceExpanded"><svg viewBox="0 0 20 20" aria-hidden="true"><path :d="replaceExpanded ? 'm5.5 7.5 4.5 4.5 4.5-4.5' : 'm7.5 5.5 4.5 4.5-4.5 4.5'"/></svg></button>
                <div class="find-field-stack">
                  <input ref="findInput" v-model="findQuery" type="search" :aria-label="t('editor.findLabel')" :placeholder="t('editor.findLabel')" @input="onFindQueryInput" />
                  <div class="find-options">
                    <button type="button" class="find-toggle" :class="{ 'is-on': caseSensitive }" :aria-pressed="caseSensitive" :title="t('editor.matchCase')" :aria-label="t('editor.matchCase')" @click="toggleFindOption('case')">Aa</button>
                    <button type="button" class="find-toggle" :class="{ 'is-on': wholeWord }" :aria-pressed="wholeWord" :title="t('editor.wholeWord')" :aria-label="t('editor.wholeWord')" @click="toggleFindOption('word')">ab</button>
                    <button type="button" class="find-toggle" :class="{ 'is-on': useRegexp }" :aria-pressed="useRegexp" :title="t('editor.regexp')" :aria-label="t('editor.regexp')" @click="toggleFindOption('regexp')">.*</button>
                    <button type="button" class="find-step" :title="t('editor.previous')" :aria-label="t('editor.previous')" @click="refreshFind(true, -1)"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 12.5 4.5-4.5 4.5 4.5"/></svg></button>
                    <button type="button" class="find-step" :title="t('editor.next')" :aria-label="t('editor.next')" @click="refreshFind(true, 1)"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 7.5 4.5 4.5 4.5-4.5"/></svg></button>
                  </div>
                  <template v-if="replaceExpanded">
                    <input v-model="replacement" type="text" :aria-label="t('editor.replaceWith')" :placeholder="t('editor.replaceWith')" :disabled="!replacing" />
                    <div class="replace-actions">
                      <button type="button" :disabled="!replacing" @click="replaceOne">{{ t('editor.replace') }}</button>
                      <button type="button" :disabled="!replacing" @click="replaceEvery">{{ t('editor.replaceAll') }}</button>
                    </div>
                  </template>
                </div>
              </div>
              <p class="find-status" aria-live="polite">{{ findMessage }}</p>
              <ul ref="findList" class="find-hits" :aria-label="t('editor.matches')">
                <li v-for="item in findHits" :key="`${item.index}-${item.from}-${item.to}`">
                  <button type="button" :class="{ 'is-current': isCurrentMatch(item) }" :aria-current="isCurrentMatch(item) ? 'true' : undefined" @click="goToMatch(item)">
                    <span class="find-hit-index">{{ item.index }}</span>
                    <span class="find-hit-line"><span>{{ item.before }}</span><mark>{{ item.match }}</mark><span>{{ item.after }}</span></span>
                  </button>
                </li>
              </ul>
            </form>
          </div>
          <div v-show="outlineVisible" class="outline-resize" role="separator" :aria-label="t('editor.resizeOutline')" aria-orientation="vertical" aria-valuemin="190" aria-valuemax="520" :aria-valuenow="outlineWidth" tabindex="0" @pointerdown="startOutlineResize" @keydown="keyboardResizeOutline" />
        </aside>
      </template>
      <div v-else class="empty-editor">
        <span class="empty-mark">✳</span><p class="eyebrow">V5 NOTES</p><h2>{{ t('editor.emptyTitle') }}</h2><p>{{ t('editor.emptyBody') }}</p>
        <div class="empty-actions">
          <button class="primary" type="button" @click="newNote">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4.5v11M4.5 10h11" /></svg>
            {{ t('editor.newNote') }}
          </button>
          <button v-if="!directoryVisible || focusMode" class="secondary-action" type="button" @click="directoryVisible = true; focusMode = false">
            <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M8 4v12" /></svg>
            {{ t('editor.showDirectory') }}
          </button>
        </div>
      </div>
      <div v-if="focusMode" class="focus-hud">
        <span class="save-state" :class="{ unsaved: draft.dirty }"><i />{{ draft.dirty ? t('editor.unsaved') : t('editor.saved') }}</span>
        <span class="hud-divider" aria-hidden="true"></span>
        <button type="button" @click="focusMode = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3H3v4M13 3h4v4M17 13v4h-4M7 17H3v-4"/></svg>{{ t('editor.exitFocus') }}</button>
        <button type="button" @click="directoryVisible = true; focusMode = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6h14M3 10h14M3 14h14"/></svg>{{ t('editor.directory') }}</button>
      </div>
      <EditorPalette :open="paletteOpen" :commands="commands" :context="commandContext" @close="paletteOpen = false" @run="runCommand" />
      <ImageLibraryDialog v-model="libraryOpen" @insert="insertLibraryImage" />
    </main>
</template>
