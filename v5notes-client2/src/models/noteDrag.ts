import { ref } from 'vue'

export interface NoteDragSession {
  noteId: string
  fromDirId: string
  /** 已超过拖动阈值，进入拖动中 */
  active: boolean
  /** 当前悬停的目标目录；`0` 表示根目录，null 表示无有效目标 */
  targetDirId: string | null
}

/** 侧栏笔记拖动的共享状态（树递归组件共用）。 */
export const noteDragSession = ref<NoteDragSession | null>(null)

const DRAG_THRESHOLD_PX = 5

export function dragDistance(fromX: number, fromY: number, toX: number, toY: number): number {
  return Math.hypot(toX - fromX, toY - fromY)
}

export function shouldStartNoteDrag(distance: number): boolean {
  return distance >= DRAG_THRESHOLD_PX
}

/** 从指针下的元素解析 `data-drop-dir`（目录 id 或 `0`）。 */
export function readDropDirFromPoint(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY)
  if (!(el instanceof Element)) return null
  const host = el.closest('[data-drop-dir]')
  if (!(host instanceof HTMLElement)) return null
  const dirId = host.dataset.dropDir
  return dirId === undefined || dirId === '' ? null : dirId
}

export function clearNoteDrag(): void {
  noteDragSession.value = null
  document.documentElement.classList.remove('is-dragging-note')
}

export function markNoteDragActive(session: NoteDragSession): void {
  session.active = true
  noteDragSession.value = { ...session }
  document.documentElement.classList.add('is-dragging-note')
}

export function updateNoteDragTarget(targetDirId: string | null): void {
  const current = noteDragSession.value
  if (!current?.active) return
  if (current.targetDirId === targetDirId) return
  noteDragSession.value = { ...current, targetDirId }
}
