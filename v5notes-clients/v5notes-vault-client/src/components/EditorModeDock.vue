<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * Floating edit / done + save control.
 *
 * Ported from v5notes-client2's EditorModeDock: it sits on a vertical rail at
 * the right edge of the editor, can be dragged up and down, remembers the
 * dragged position, and returns home on a double click. The dashed rail marks
 * the safe lane so the dock never reads as part of the document flow.
 */
const props = defineProps<{
  mode: 'edit' | 'preview'
  /** Editing the Markdown source rather than the rendered view. */
  sourceMode: boolean
  dirty: boolean
  busy: boolean
}>()

const emit = defineEmits<{
  edit: []
  save: []
  done: []
}>()

const STORAGE_KEY = 'v5notes.vault.mode-dock-position.v1'
const PAD = 8
const HOME_TOP = { preview: 64, edit: 104 } as const
const MIN_TOP = { preview: 56, edit: 104 } as const

const dock = ref<HTMLElement | null>(null)
const top = ref<number>(HOME_TOP[props.mode])
const railRight = ref(140)
const dragging = ref(false)
const hovering = ref(false)
const customPosition = ref(false)

const isEditing = computed(() => props.mode === 'edit')
const minTop = computed(() => MIN_TOP[props.mode])
const railShown = computed(() => isEditing.value || hovering.value || dragging.value)
const stateLabel = computed(() => {
  const mode = props.sourceMode ? '源码模式，' : ''
  return `${mode}${props.dirty ? '有未保存的更改' : '所有更改已保存'}`
})

let pointerDown = false
let moved = false
let suppressClick = false
let startY = 0
let startTop = 0

function measure(): void {
  const el = dock.value
  if (!el) return
  // 22px from the editor edge + 12px gap between the dock and its dashed rail.
  railRight.value = el.offsetWidth + 34
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
    // Local storage can be unavailable; the dock still works for this session.
  }
}

function restore(): void {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as { top?: unknown } | null
    if (stored && typeof stored.top === 'number' && Number.isFinite(stored.top)) {
      top.value = stored.top
      customPosition.value = true
    }
  } catch {
    // Ignore malformed positions.
  }
}

function reset(): void {
  customPosition.value = false
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  top.value = HOME_TOP[props.mode]
  clamp()
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
    try {
      dock.value?.setPointerCapture(event.pointerId)
    } catch {
      // Synthetic pointers in tests cannot be captured.
    }
  }
  top.value = startTop + dy
  clamp()
}

function onPointerUp(): void {
  if (!pointerDown) return
  pointerDown = false
  if (moved) {
    customPosition.value = true
    persist()
    // The click that follows this pointerup belongs to the drag, not a button.
    window.setTimeout(() => {
      suppressClick = false
    }, 0)
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
  if (!customPosition.value) top.value = HOME_TOP[props.mode]
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

watch(
  () => props.mode,
  mode => {
    if (!customPosition.value) top.value = HOME_TOP[mode]
    void nextTick(() => clamp())
  },
)

watch(
  () => props.dirty,
  () => {
    void nextTick(measure)
  },
)
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
    <span class="mode-dock-grip" aria-hidden="true" title="上下拖动移动位置；双击归位">
      <i></i><i></i><i></i>
    </span>

    <button
      v-if="!isEditing"
      type="button"
      class="dock-edit"
      title="进入编辑"
      aria-label="进入编辑"
      @click="emit('edit')"
    >
      <span class="dock-edit-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.4 2.6a2.1 2.1 0 1 1 3 3L12 15l-4 1 1-4Z" />
        </svg>
      </span>
      <span>编辑</span>
    </button>

    <div v-else class="dock-cluster" role="group" aria-label="编辑状态">
      <button
        type="button"
        class="dock-done"
        :disabled="busy"
        :title="dirty ? '完成并保存，返回预览' : '完成编辑，返回预览'"
        @click="emit('done')"
      >
        <span
          class="dock-status-dot"
          :class="{ 'is-dirty': dirty }"
          role="img"
          :title="stateLabel"
          :aria-label="stateLabel"
        />
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" /></svg>
        <span>完成</span>
      </button>

      <button
        v-if="dirty"
        type="button"
        class="dock-save"
        :disabled="busy"
        title="保存笔记"
        aria-label="保存笔记"
        @click="emit('save')"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 3.4h9.2L16.6 6.8V16.6H4z" />
          <path d="M6.6 3.6v4.6h6.2V3.6M6.8 16.4v-4.6h6.4v4.6" />
        </svg>
        <span>保存</span>
      </button>
      <span v-else class="dock-save is-saved" role="status" aria-live="polite" title="笔记已保存">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 3.4h9.2L16.6 6.8V16.6H4z" />
          <path d="M6.6 3.6v4.6h6.2V3.6M6.8 16.4v-4.6h6.4v4.6" />
        </svg>
        <span>已保存</span>
      </span>
    </div>
  </div>
</template>
