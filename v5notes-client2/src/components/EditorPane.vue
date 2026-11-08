<script setup lang="ts">
import { listMatches, type FindOptions } from '@v5md/core'
import { computed, nextTick, ref, watch } from 'vue'
import ImageLibraryDialog from './ImageLibraryDialog.vue'
import { useWorkspaceContext } from '../hooks/workspaceContext'
import type { LibraryImage } from '../service/api'
import { canReplace, closeFindView, findStatus, matchPreview, openFindView, type FindKind, type FindMatchPreview, type FindSidebarState, type SidebarView } from '../models/findSidebar'
const { sessionExpired, reauthenticate, error, notice, draft, directoryVisible, focusMode, toggleSidebar, editorMode, sourceMode, toggleSourceMode, outlineVisible, editorInstance, activeActionMenu, syncActionMenu, renameNote, copyNoteContent, deleteNote, finishEditing, save, openHistory, selectedId, content, api, editorReady, newNote } = useWorkspaceContext()
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

function openImageLibrary(): void {
  if (editorMode.value !== 'edit') return
  libraryOpen.value = true
}

function insertLibraryImage(image: LibraryImage): void {
  const alt = image.name.replace(/\.[^.]+$/, '').trim() || '图片'
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

function refreshFind(advance: boolean, direction: 1 | -1 = 1): void {
  const editor = editorInstance.value
  if (!editor) return
  const result = editor.findNextMatch(findQuery.value, findOptions.value, direction, advance)
  showFindResult(editor.getMarkdown(), result)
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

function switchEditorMode(): void {
  if (editorMode.value === 'preview') editorMode.value = 'edit'
  else void finishEditing()
}

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
</script>

<template>
    <main class="editor-pane" :class="{ 'is-resizing-outline': resizingOutline }" :style="{ '--outline-width': `${outlineVisible ? outlineWidth : 0}px` }" @pointermove="resizeOutline" @pointerup="stopOutlineResize" @pointercancel="stopOutlineResize">
      <div v-if="sessionExpired" class="session-alert">登录已过期；草稿仍在当前窗口。请重新登录后保存。<button @click="reauthenticate">重新登录</button></div>
      <div v-if="notice" class="notice-bar">{{ notice }} <button @click="notice = ''">×</button></div>
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
              <span class="mode-label" aria-label="当前模式：预览"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 2.5h7l4 4v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3.5 17.5v-13A2 2 0 0 1 5.5 2.5Z"/><path d="M11.5 2.75v4h3.75M5.5 12s1.5-2.5 4-2.5 4 2.5 4 2.5-1.5 2.5-4 2.5-4-2.5-4-2.5Z"/><circle cx="9.5" cy="12" r="1"/></svg>预览</span>
              <span v-if="draft.dirty" class="save-state unsaved"><i />未保存</span>
              <button class="history-toggle" type="button" @click="openHistory"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="M10 6.5V10l2.5 1.5"/></svg>历史</button>
              <button class="mode-switch" type="button" aria-label="切换到编辑模式" title="切换到编辑模式" @click="switchEditorMode"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5a2.12 2.12 0 0 1 3 0Z"/></svg>编辑</button>
            </template>
            <template v-else>
              <button class="mode-label" type="button" :aria-pressed="sourceMode" :aria-label="sourceMode ? '切换到编辑模式' : '切换到源码模式'" :title="sourceMode ? '切换到编辑模式' : '切换到源码模式'" @click="toggleSourceMode"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5a2.12 2.12 0 0 1 3 0Z"/></svg><span class="mode-label-text">{{ sourceMode ? '源码' : '编辑' }}</span></button>
              <span class="save-state" :class="{ unsaved: draft.dirty }"><i />{{ draft.dirty ? '未保存' : '已保存' }}</span>
              <button class="mode-switch" type="button" aria-label="切换到预览模式" title="切换到预览模式" @click="switchEditorMode"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 10s2.8-4.5 8-4.5 8 4.5 8 4.5-2.8 4.5-8 4.5S2 10 2 10Z"/><circle cx="10" cy="10" r="2"/></svg>预览</button>
              <button class="focus-toggle" type="button" :aria-pressed="focusMode" @click="focusMode = !focusMode"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3H3v4M13 3h4v4M17 13v4h-4M7 17H3v-4"/></svg>{{ focusMode ? '退出专注' : '专注写作' }}</button>
              <button class="history-toggle" type="button" @click="openHistory"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="M10 6.5V10l2.5 1.5"/></svg>历史</button>
            </template>
            <div v-if="editorMode === 'edit'" class="save-split">
              <button class="primary save-button" :disabled="!draft.dirty" @click="save"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 2.5h10l3.5 3.5v10A1.5 1.5 0 0 1 16 17.5H4A1.5 1.5 0 0 1 2.5 16V4A1.5 1.5 0 0 1 4 2.5Z"/><path d="M6 2.8v5h7v-5M6 17v-6h8v6"/></svg>保存 <kbd>⌘S / Ctrl+S</kbd></button>
              <details class="action-menu save-menu" data-action-menu="note" @toggle="syncActionMenu('note', $event)">
                <summary aria-label="笔记操作" title="笔记操作"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 7.5 4.5 4.5 4.5-4.5"/></svg></summary>
                <div class="popover-menu" @click="closeActionMenu"><button @click="renameNote"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.8 3.2 4 4M3 17l3.8-.8L16 7a1.4 1.4 0 0 0-2-2L4.8 14.2z"/></svg>重命名</button><button @click="copyNoteContent"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="6" width="10" height="11" rx="1.5"/><path d="M13 6V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"/></svg>复制内容</button><button class="danger-menu-item" @click="deleteNote"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 5.5h13M8 5.5V3.5h4v2M5.5 5.5l.8 11h7.4l.8-11M8.5 8.5v5M11.5 8.5v5"/></svg>删除笔记</button></div>
              </details>
            </div>
            <button class="toolbar-icon outline-toggle" :aria-pressed="outlineVisible" :aria-label="outlineVisible ? '隐藏大纲' : '显示大纲'" :title="outlineVisible ? '隐藏大纲' : '显示大纲'" @click="outlineVisible = !outlineVisible">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M14 4v16"/><path v-if="outlineVisible" d="m15 9 3 3-3 3"/><path v-else d="m18 9-3 3 3 3"/></svg>
            </button>
          </div>
        </header>
        <div class="editor-body">
          <div class="editor-scroll" :class="{ 'preview-scroll': editorMode === 'preview', 'edit-scroll': editorMode === 'edit' }">
            <div class="editor-paper">
              <div class="editor-mount">
                <V5Editor :key="selectedId" v-model="content" placeholder="开始编写…" :editable="editorMode === 'edit'" :on-upload-image="api.upload" :on-pick-image="openImageLibrary" :on-ready="onEditorReady" :on-find-request="onFindRequest" />
              </div>
            </div>
          </div>
        </div>
        <aside class="outline-sidebar" :class="{ 'is-hidden': !outlineVisible }" :aria-label="sidebarView === 'find' ? '查找' : '笔记大纲'">
          <header class="outline-header">
            <div class="outline-tabs" role="tablist" aria-label="侧栏视图">
              <button type="button" role="tab" :aria-selected="sidebarView === 'outline'" @click="sidebarView = 'outline'">大纲</button>
              <button type="button" role="tab" :aria-selected="sidebarView === 'find'" @click="sidebarView = 'find'">查找</button>
            </div>
          </header>
          <div class="outline-body" :class="{ 'is-find': sidebarView === 'find' }">
            <nav v-show="sidebarView === 'outline'" class="outline-list" aria-label="大纲">
              <button v-for="entry in outlineEntries" :key="`${entry.start}-${entry.text}`" type="button" :style="{ paddingLeft: `${(entry.depth - 1) * 12 + 8}px` }" @click="focusOutline(entry.start)">{{ entry.text }}</button>
            </nav>
            <form v-show="sidebarView === 'find'" class="find-panel" role="tabpanel" aria-label="查找" @submit.prevent="refreshFind(true, 1)" @keydown="onFindKeydown">
              <div class="find-fields">
                <button type="button" class="find-expand" :aria-expanded="replaceExpanded" :aria-label="replaceExpanded ? '收起替换' : '展开替换'" :title="replaceExpanded ? '收起替换' : '展开替换'" @click="replaceExpanded = !replaceExpanded"><svg viewBox="0 0 20 20" aria-hidden="true"><path :d="replaceExpanded ? 'm5.5 7.5 4.5 4.5 4.5-4.5' : 'm7.5 5.5 4.5 4.5-4.5 4.5'"/></svg></button>
                <div class="find-field-stack">
                  <input ref="findInput" v-model="findQuery" type="search" aria-label="查找" placeholder="查找" @input="refreshFind(false)" />
                  <div class="find-options">
                    <button type="button" class="find-toggle" :class="{ 'is-on': caseSensitive }" :aria-pressed="caseSensitive" title="区分大小写" aria-label="区分大小写" @click="toggleFindOption('case')">Aa</button>
                    <button type="button" class="find-toggle" :class="{ 'is-on': wholeWord }" :aria-pressed="wholeWord" title="全词匹配" aria-label="全词匹配" @click="toggleFindOption('word')">ab</button>
                    <button type="button" class="find-toggle" :class="{ 'is-on': useRegexp }" :aria-pressed="useRegexp" title="使用正则表达式" aria-label="使用正则表达式" @click="toggleFindOption('regexp')">.*</button>
                    <button type="button" class="find-step" title="上一处" aria-label="上一处" @click="refreshFind(true, -1)"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 12.5 4.5-4.5 4.5 4.5"/></svg></button>
                    <button type="button" class="find-step" title="下一处" aria-label="下一处" @click="refreshFind(true, 1)"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 7.5 4.5 4.5 4.5-4.5"/></svg></button>
                  </div>
                  <template v-if="replaceExpanded">
                    <input v-model="replacement" type="text" aria-label="替换为" placeholder="替换为" :disabled="!replacing" />
                    <div class="replace-actions">
                      <button type="button" :disabled="!replacing" @click="replaceOne">替换</button>
                      <button type="button" :disabled="!replacing" @click="replaceEvery">全部替换</button>
                    </div>
                  </template>
                </div>
              </div>
              <p class="find-status" aria-live="polite">{{ findMessage }}</p>
              <ul ref="findList" class="find-hits" aria-label="匹配项">
                <li v-for="item in findHits" :key="`${item.index}-${item.from}-${item.to}`">
                  <button type="button" :class="{ 'is-current': isCurrentMatch(item) }" :aria-current="isCurrentMatch(item) ? 'true' : undefined" @click="goToMatch(item)">
                    <span class="find-hit-index">{{ item.index }}</span>
                    <span class="find-hit-line"><span>{{ item.before }}</span><mark>{{ item.match }}</mark><span>{{ item.after }}</span></span>
                  </button>
                </li>
              </ul>
            </form>
          </div>
          <div v-show="outlineVisible" class="outline-resize" role="separator" aria-label="调整大纲栏宽度" aria-orientation="vertical" aria-valuemin="190" aria-valuemax="520" :aria-valuenow="outlineWidth" tabindex="0" @pointerdown="startOutlineResize" @keydown="keyboardResizeOutline" />
        </aside>
      </template>
      <div v-else class="empty-editor">
        <span class="empty-mark">✳</span><p class="eyebrow">V5 NOTES</p><h2>选择一篇笔记开始阅读</h2><p>从左侧目录树打开笔记。笔记默认以预览模式显示，需要修改时再进入编辑。</p>
        <div class="empty-actions"><button class="primary" @click="newNote">新建笔记</button><button class="secondary-action" @click="directoryVisible = true">显示目录</button></div>
      </div>
      <ImageLibraryDialog v-model="libraryOpen" @insert="insertLibraryImage" />
    </main>
</template>
