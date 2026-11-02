import { getCurrentWindow } from '@tauri-apps/api/window'

export async function watchClose(guard: () => Promise<boolean>): Promise<() => void> {
  if (!('__TAURI_INTERNALS__' in window)) {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const handler = (event: BeforeUnloadEvent) => {
      if (windowDirty()) beforeUnload(event)
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }
  const appWindow = getCurrentWindow()
  return appWindow.onCloseRequested(async event => {
    event.preventDefault()
    if (await guard()) await appWindow.hide()
  })
}

let windowDirty = () => false
export function setDirtyCheck(check: () => boolean): void {
  windowDirty = check
}
