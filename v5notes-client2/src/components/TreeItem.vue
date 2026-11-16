<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TreeNode } from '../service/api'
import {
  clearNoteDrag,
  dragDistance,
  markNoteDragActive,
  markNoteDragReady,
  noteDragSession,
  readDropDirFromPoint,
  shouldStartNoteDrag,
  updateNoteDragTarget,
} from '../models/noteDrag'
import TreeIcon from './TreeIcon.vue'

const { t } = useI18n()
const props = defineProps<{
  node: TreeNode
  selectedId: string
  defaultTreeExpanded: boolean
  depth?: number
  hint?: string
}>()
defineOptions({ name: 'TreeItem' })
const emit = defineEmits<{
  select: [id: string]
  directory: [id: string]
  add: [id: string]
  rename: [node: TreeNode]
  remove: [node: TreeNode]
  addNote: [id: string]
  noteOpen: [id: string]
  noteRename: [id: string]
  noteMove: [id: string]
  noteDelete: [id: string]
  noteDrop: [noteId: string, targetDirId: string]
}>()

const isDirectory = computed(() => props.node.type === 1)
function containsSelectedNote(node: TreeNode): boolean {
  return node.id === props.selectedId || Boolean(node.children?.some(containsSelectedNote))
}

const expanded = ref(isDirectory.value && (props.defaultTreeExpanded || containsSelectedNote(props.node)))
const menuOpen = ref(false)
const menuRoot = ref<HTMLDetailsElement | null>(null)
type MenuPosition = { top: string; left: string }
// 关闭时清空，所以每次渲染都可能是空对象（菜单还挂在 DOM 上但未定位）。
const menuStyle = ref<Partial<MenuPosition>>({})
let trackingMenu = false
let sidebarObserver: ResizeObserver | null = null
let expandTimer: number | undefined
let suppressClick = false
let pointerTracking: {
  pointerId: number
  startX: number
  startY: number
  noteId: string
  fromDirId: string
  row: HTMLElement | null
} | null = null
const onMenuViewportChange = (): void => { placeMenu() }

const dragging = computed(() => noteDragSession.value?.active === true && noteDragSession.value.noteId === props.node.id)
const dropActive = computed(() => (
  isDirectory.value
  && noteDragSession.value?.active === true
  && noteDragSession.value.targetDirId === props.node.id
  && noteDragSession.value.noteId !== props.node.id
))
const noteTitle = computed(() => {
  if (isDirectory.value) return props.hint ? `${props.node.label} · ${props.hint}` : props.node.label
  const base = props.hint ? `${props.node.label} · ${props.hint}` : props.node.label
  return `${base} · ${t('tree.notePointerHint')}`
})

function menuPopover(): HTMLElement | null {
  const popover = menuRoot.value?.querySelector('.popover-menu')
  return popover instanceof HTMLElement ? popover : null
}

function placeMenu(retry = true): void {
  const anchor = menuRoot.value?.querySelector('summary')
  const popover = menuPopover()
  if (!(anchor instanceof HTMLElement) || !popover || !menuOpen.value) return
  const scroller = anchor.closest('.tree-scroll')
  const anchorRect = anchor.getBoundingClientRect()
  if (scroller) {
    const scrollerRect = scroller.getBoundingClientRect()
    if (anchorRect.bottom <= scrollerRect.top || anchorRect.top >= scrollerRect.bottom) {
      menuOpen.value = false
      return
    }
  }
  const width = popover.offsetWidth
  const height = popover.offsetHeight
  if (!width || !height) {
    if (retry) requestAnimationFrame(() => placeMenu(false))
    return
  }
  const gap = 5
  const margin = 8
  const spaceBelow = window.innerHeight - anchorRect.bottom - gap - margin
  const spaceAbove = anchorRect.top - gap - margin
  const openUp = spaceBelow < height && spaceAbove > spaceBelow
  let top = openUp ? anchorRect.top - gap - height : anchorRect.bottom + gap
  top = Math.max(margin, Math.min(top, window.innerHeight - margin - height))
  let left = anchorRect.right - width
  left = Math.max(margin, Math.min(left, window.innerWidth - margin - width))
  menuStyle.value = { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` }
}

function trackMenu(track: boolean): void {
  if (track === trackingMenu) return
  trackingMenu = track
  if (track) {
    window.addEventListener('resize', onMenuViewportChange)
    document.addEventListener('scroll', onMenuViewportChange, true)
    const sidebar = menuRoot.value?.closest('.sidebar')
    if (sidebar) {
      sidebarObserver = new ResizeObserver(onMenuViewportChange)
      sidebarObserver.observe(sidebar)
    }
    return
  }
  window.removeEventListener('resize', onMenuViewportChange)
  document.removeEventListener('scroll', onMenuViewportChange, true)
  sidebarObserver?.disconnect()
  sidebarObserver = null
}

function showMenu(popover: HTMLElement): void {
  if (popover.matches(':popover-open')) return
  // 挂到顶层，避免被目录折叠动画和侧栏滚动区的 overflow 裁切。
  try {
    popover.showPopover()
  } catch {
    popover.removeAttribute('popover')
  }
}

function hideMenu(popover: HTMLElement): void {
  if (!popover.matches(':popover-open')) return
  try { popover.hidePopover() } catch { /* 节点卸载时浏览器会拒绝关闭 */ }
}

async function syncMenu(open: boolean): Promise<void> {
  await nextTick()
  if (menuOpen.value !== open) return
  const popover = menuPopover()
  if (!popover) return
  if (!open) {
    trackMenu(false)
    hideMenu(popover)
    menuStyle.value = {}
    return
  }
  showMenu(popover)
  placeMenu()
  trackMenu(true)
}

function onMenuToggle(event: Event): void {
  if (event.target !== menuRoot.value || !(event.target instanceof HTMLDetailsElement)) return
  menuOpen.value = event.target.open
}

watch(menuOpen, (open) => { void syncMenu(open) })
onBeforeUnmount(() => {
  trackMenu(false)
  clearExpandTimer()
  stopPointerTracking()
  const popover = menuPopover()
  if (popover) hideMenu(popover)
})

watch(() => props.defaultTreeExpanded, (shouldExpand) => {
  if (!isDirectory.value) return
  expanded.value = shouldExpand || containsSelectedNote(props.node)
})

watch(() => props.selectedId, () => {
  if (isDirectory.value && containsSelectedNote(props.node)) expanded.value = true
})

watch(() => noteDragSession.value?.targetDirId, (targetDirId) => {
  if (!isDirectory.value) return
  clearExpandTimer()
  if (!noteDragSession.value?.active || targetDirId !== props.node.id || expanded.value) return
  expandTimer = window.setTimeout(() => {
    expanded.value = true
    expandTimer = undefined
  }, 450)
})

function activate(): void {
  if (suppressClick) return
  if (isDirectory.value) {
    expanded.value = !expanded.value
    emit('directory', props.node.id)
  } else {
    emit('select', props.node.id)
  }
}

function onRowKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  activate()
}

function clearExpandTimer(): void {
  if (expandTimer !== undefined) {
    window.clearTimeout(expandTimer)
    expandTimer = undefined
  }
}

function stopPointerTracking(): void {
  if (!pointerTracking) return
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  pointerTracking = null
}

function onPointerDown(event: PointerEvent): void {
  if (isDirectory.value || event.button !== 0 || event.pointerType === 'touch' && event.isPrimary === false) return
  if (event.target instanceof Element && event.target.closest('.tree-menu, .tree-actions')) return
  menuOpen.value = false
  suppressClick = false
  pointerTracking = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    noteId: props.node.id,
    fromDirId: props.node.pid || '0',
    row: event.currentTarget instanceof HTMLElement ? event.currentTarget : null,
  }
  // 按下即显示可拖光标；未拖出前仍可单击打开。阈值前不 capture，避免 click 被重定向。
  markNoteDragReady({
    noteId: props.node.id,
    fromDirId: props.node.pid || '0',
    ready: true,
    active: false,
    targetDirId: null,
  })
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

function onPointerMove(event: PointerEvent): void {
  const tracking = pointerTracking
  if (!tracking || event.pointerId !== tracking.pointerId) return
  const session = noteDragSession.value
  if (!session || session.noteId !== tracking.noteId) return
  const distance = dragDistance(tracking.startX, tracking.startY, event.clientX, event.clientY)
  if (!session.active) {
    if (!shouldStartNoteDrag(distance)) return
    markNoteDragActive(session)
    suppressClick = true
    try { tracking.row?.setPointerCapture(event.pointerId) } catch { /* 部分环境不支持 capture */ }
  }
  event.preventDefault()
  const targetDirId = readDropDirFromPoint(event.clientX, event.clientY)
  // 不能拖到自己当前目录时仍高亮目标，松手时再跳过
  updateNoteDragTarget(targetDirId)
}

function onPointerUp(event: PointerEvent): void {
  const tracking = pointerTracking
  if (!tracking || event.pointerId !== tracking.pointerId) return
  const session = noteDragSession.value
  const didDrag = session?.active === true && session.noteId === tracking.noteId
  const targetDirId = didDrag
    ? (readDropDirFromPoint(event.clientX, event.clientY) ?? session.targetDirId)
    : null
  try {
    if (tracking.row?.hasPointerCapture(event.pointerId)) tracking.row.releasePointerCapture(event.pointerId)
  } catch { /* ignore */ }
  stopPointerTracking()
  clearNoteDrag()
  clearExpandTimer()
  if (didDrag) {
    // 拖动结束后吞掉紧随其后的 click，避免误打开
    suppressClick = true
    window.setTimeout(() => { suppressClick = false }, 0)
    if (targetDirId && targetDirId !== tracking.fromDirId) {
      emit('noteDrop', tracking.noteId, targetDirId)
    }
    return
  }
  // 按下后未拖出：视为单击，交给后续 click 打开笔记
  suppressClick = false
}
</script>

<template>
  <div class="tree-node" :data-drop-dir="isDirectory ? node.id : undefined" :class="{ 'is-drop-target': dropActive }">
    <div
      class="tree-row"
      :class="{
        active: !isDirectory && selectedId === node.id,
        'directory-row': isDirectory,
        'is-drop-target': dropActive,
        'is-dragging': dragging,
        'is-note-row': !isDirectory,
      }"
      :style="{ '--tree-depth': depth || 0 }"
      @contextmenu.prevent="menuOpen = true"
      @pointerdown="onPointerDown"
      @click="activate"
    >
      <div
        class="tree-disclosure"
        role="button"
        tabindex="0"
        :aria-label="isDirectory ? t('tree.toggle', { action: expanded ? t('tree.collapse') : t('tree.expand'), name: node.label }) : undefined"
        :aria-expanded="isDirectory ? expanded : undefined"
        @keydown="onRowKeydown"
      >
        <svg v-if="isDirectory" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m5.75 3.5 4.5 4.5-4.5 4.5" />
        </svg>
      </div>
      <div
        class="tree-label"
        role="button"
        tabindex="0"
        :title="noteTitle"
        :aria-label="hint ? `${node.label}，${hint}` : node.label"
        @keydown="onRowKeydown"
      >
        <TreeIcon :kind="isDirectory ? 'folder' : 'note'" :open="isDirectory && expanded" />
        <span class="tree-name">{{ node.label }}</span>
        <span v-if="hint" class="tree-hint">{{ hint }}</span>
      </div>
      <div class="tree-actions">
        <details ref="menuRoot" class="tree-menu" :open="menuOpen" @toggle="onMenuToggle" @click.stop @pointerdown.stop>
          <summary :title="t('tree.more')" :aria-label="t('tree.moreFor', { name: node.label })"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="4" cy="10" r="1.35"/><circle cx="10" cy="10" r="1.35"/><circle cx="16" cy="10" r="1.35"/></svg></summary>
          <div class="popover-menu" popover="manual" :style="menuStyle" @toggle.stop>
            <template v-if="isDirectory">
              <button @click="emit('add', node.id); menuOpen = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 6h5.8L10 8h7.5v8H2.5zM13.5 3v5M11 5.5h5"/></svg>{{ t('tree.newChild') }}</button>
              <button @click="emit('addNote', node.id); menuOpen = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2.5h6l4 4V17H5zM11 2.8v4h3.7M8 10h4M8 13h4M16.5 12v5M14 14.5h5"/></svg>{{ t('tree.newNote') }}</button>
              <button @click="emit('rename', node); menuOpen = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.8 3.2 4 4M3 17l3.8-.8L16 7a1.4 1.4 0 0 0-2-2L4.8 14.2z"/></svg>{{ t('tree.rename') }}</button>
              <button class="danger-menu-item" @click="emit('remove', node); menuOpen = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 5.5h13M8 5.5V3.5h4v2M5.5 5.5l.8 11h7.4l.8-11M8.5 8.5v5M11.5 8.5v5"/></svg>{{ t('tree.deleteDirectory') }}</button>
            </template>
            <template v-else>
              <button @click="emit('noteOpen', node.id); menuOpen = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16 16 4M8 4h8v8"/></svg>{{ t('tree.open') }}</button>
              <button @click="emit('noteRename', node.id); menuOpen = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.8 3.2 4 4M3 17l3.8-.8L16 7a1.4 1.4 0 0 0-2-2L4.8 14.2z"/></svg>{{ t('tree.rename') }}</button>
              <button @click="emit('noteMove', node.id); menuOpen = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 10h9.5M10 6.5 13.5 10 10 13.5M15.5 4.5v11"/></svg>{{ t('tree.move') }}</button>
              <button class="danger-menu-item" @click="emit('noteDelete', node.id); menuOpen = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 5.5h13M8 5.5V3.5h4v2M5.5 5.5l.8 11h7.4l.8-11M8.5 8.5v5M11.5 8.5v5"/></svg>{{ t('tree.deleteNote') }}</button>
            </template>
          </div>
        </details>
      </div>
    </div>
    <Transition name="tree-expand">
      <div v-if="isDirectory && expanded && node.children?.length" class="tree-children">
        <div class="tree-children-inner">
          <TreeItem
            v-for="child in node.children" :key="child.id" :node="child" :selected-id="selectedId" :default-tree-expanded="defaultTreeExpanded" :depth="(depth || 0) + 1"
            @select="emit('select', $event)" @directory="emit('directory', $event)" @add="emit('add', $event)"
            @rename="emit('rename', $event)" @remove="emit('remove', $event)"
            @add-note="emit('addNote', $event)" @note-open="emit('noteOpen', $event)"
            @note-rename="emit('noteRename', $event)" @note-move="emit('noteMove', $event)" @note-delete="emit('noteDelete', $event)"
            @note-drop="(noteId, targetDirId) => emit('noteDrop', noteId, targetDirId)"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>
