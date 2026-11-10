<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * Floating mode tag from the J design. It sits at the right edge of the editor,
 * can be dragged up and down, remembers where it was left, and returns home on a
 * double click. It never participates in the toolbar layout, so the reading
 * column keeps its full width. The dashed line marks the safe rail it belongs to.
 */
const props = defineProps<{
  mode: 'edit' | 'preview'
  sourceMode: boolean
  dirty: boolean
}>()

const emit = defineEmits<{
  edit: []
  save: []
  done: []
}>()

const STORAGE_KEY = 'v5notes-mode-dock-position'
const PAD = 8

const dock = ref<HTMLElement | null>(null)
const top = ref(16)
const railRight = ref(140)
const dragging = ref(false)
const hovering = ref(false)
const isEditing = computed(() => props.mode !== 'preview')
const stateLabel = computed(() => (props.sourceMode ? '源码' : '编辑中'))
const minTop = computed(() => (props.mode === 'edit' ? 48 : 8))
const railShown = computed(() => isEditing.value || hovering.value || dragging.value)

let pointerDown = false
let moved = false
let suppressClick = false
let startY = 0
let startTop = 16

function measure(): void {
  const el = dock.value
  if (!el) return
  // Keep the dashed rail a small gap to the left of the tag.
  railRight.value = el.offsetWidth + 28
}

function clamp(): void {
  const el = dock.value
  const parent = el?.offsetParent as HTMLElement | null
  if (!el || !parent) return
  const maxTop = Math.max(minTop.value, parent.clientHeight - el.offsetHeight - PAD)
  top.value = Math.min(maxTop, Math.max(minTop.value, top.value))
  measure()
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ top: top.value }))
  } catch {
    // Local storage can be unavailable; the tag still works for this session.
  }
}

function restore(): void {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as { top?: number } | null
    if (stored && Number.isFinite(stored.top)) top.value = stored.top as number
  } catch {
    // Ignore malformed positions.
  }
}

function reset(): void {
  top.value = minTop.value
  clamp()
  persist()
}

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  pointerDown = true
  moved = false
  startY = event.clientY
  startTop = top.value
}

function onPointerMove(event: PointerEvent): void {
  if (!pointerDown) return
  const dy = event.clientY - startY
  if (!moved) {
    if (Math.abs(dy) <= 5) return
    moved = true
    suppressClick = true
    dragging.value = true
    try { dock.value?.setPointerCapture(event.pointerId) } catch { /* synthetic pointers */ }
  }
  top.value = startTop + dy
  clamp()
}

function onPointerUp(): void {
  if (!pointerDown) return
  pointerDown = false
  if (moved) {
    persist()
    // The click that follows this pointerup belongs to the drag, not a button.
    window.setTimeout(() => { suppressClick = false }, 0)
  }
  dragging.value = false
  moved = false
}

function onClickCapture(event: MouseEvent): void {
  if (!suppressClick) return
  event.stopPropagation()
  event.preventDefault()
  suppressClick = false
}

function onDoubleClick(event: MouseEvent): void {
  if ((event.target as HTMLElement | null)?.closest('button')) return
  reset()
}

onMounted(() => {
  restore()
  void nextTick(() => clamp())
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
  window.addEventListener('resize', clamp)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  window.removeEventListener('resize', clamp)
})

watch(() => [props.mode, props.sourceMode], () => { void nextTick(() => clamp()) })
</script>

<template>
  <div
    class="mode-dock-rail"
    :class="{ 'is-shown': railShown, 'is-active': dragging }"
    :style="{ '--rail-right': `${railRight}px` }"
    aria-hidden="true"
  ></div>
  <div
    ref="dock"
    class="mode-dock"
    :class="{ 'is-editing': isEditing, 'is-dragging': dragging }"
    :style="{ '--dock-top': `${top}px` }"
    @pointerdown="onPointerDown"
    @pointerenter="hovering = true"
    @pointerleave="hovering = false"
    @click.capture="onClickCapture"
    @dblclick="onDoubleClick"
  >
    <span class="mode-dock-grip" aria-hidden="true" title="上下拖动移动位置；双击这里归位"><i></i><i></i><i></i></span>
    <button v-if="!isEditing" class="mode-dock-edit" type="button" title="编辑（⌘1）" aria-label="切换到编辑模式" @click="emit('edit')">
      <span class="mode-dock-ic">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5a2.12 2.12 0 0 1 3 0Z"/></svg>
      </span>
      <span>编辑</span>
    </button>
    <div v-else class="mode-dock-bar">
      <span class="mode-dock-dot" :class="{ 'is-dirty': dirty }" role="img" :title="stateLabel" :aria-label="stateLabel"></span>
      <button class="mode-dock-done" type="button" :disabled="dirty" :title="dirty ? '请先保存，再完成' : '完成：回到预览'" :aria-label="dirty ? '请先保存再完成' : '完成编辑并回到预览'" @click="emit('done')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4.6 12.4 4.6 4.6L19.4 6.6"/></svg>
        <span>完成</span>
      </button>
      <span class="mode-dock-sep" aria-hidden="true"></span>
      <button class="mode-dock-save" type="button" :title="dirty ? '保存笔记' : '笔记已保存'" :aria-label="dirty ? '保存笔记' : '笔记已保存'" @click="emit('save')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 3.5h9.6L19 8.4v11.1a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1z"/><path d="M8 3.8v5.4h6.6V3.8M6.8 20.5v-7h8.4v7"/></svg>
        <span>{{ dirty ? '保存' : '已保存' }}</span>
      </button>
    </div>
  </div>
</template>
