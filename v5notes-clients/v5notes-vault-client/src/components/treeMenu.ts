import { nextTick, ref } from 'vue'

export interface TreeMenuState {
  key: string
  top: number
  left: number
}

/** One menu is open for the whole tree at a time. */
export const activeTreeMenu = ref<TreeMenuState | null>(null)

let trigger: HTMLElement | null = null
let detach: (() => void) | null = null

function onPointerDown(event: PointerEvent): void {
  const target = event.target instanceof Element ? event.target : null
  if (target?.closest('.tree-menu')) return
  if (target?.closest('.tree-more')) return
  closeTreeMenu()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  event.preventDefault()
  closeTreeMenu(true)
}

function onViewportChange(): void {
  closeTreeMenu()
}

function bindDismiss(): void {
  detach?.()
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
  detach = () => {
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('keydown', onKeydown)
    window.removeEventListener('resize', onViewportChange)
    window.removeEventListener('scroll', onViewportChange, true)
  }
}

/**
 * Open the row action menu. It is fixed-positioned so the tree scroller's
 * overflow cannot clip it; it flips above the trigger near the window bottom.
 */
export function openTreeMenu(key: string, element: HTMLElement): void {
  if (activeTreeMenu.value?.key === key) {
    closeTreeMenu()
    return
  }
  trigger = element
  const rect = element.getBoundingClientRect()
  activeTreeMenu.value = {
    key,
    top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 12)),
    left: Math.max(8, Math.min(rect.right - 180, window.innerWidth - 188)),
  }
  bindDismiss()
  void nextTick(() => {
    const menu = document.querySelector<HTMLElement>('.tree-menu')
    if (!menu || activeTreeMenu.value?.key !== key) return
    const height = menu.offsetHeight
    const width = menu.offsetWidth || 180
    const opensUp = rect.bottom + 6 + height + 8 > window.innerHeight
    activeTreeMenu.value = {
      key,
      top: opensUp ? Math.max(8, rect.top - height - 6) : rect.bottom + 6,
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
    }
    menu.querySelector<HTMLButtonElement>('button')?.focus()
  })
}

export function closeTreeMenu(restoreFocus = false): void {
  if (restoreFocus && trigger?.isConnected) trigger.focus()
  activeTreeMenu.value = null
  detach?.()
  detach = null
  trigger = null
}
