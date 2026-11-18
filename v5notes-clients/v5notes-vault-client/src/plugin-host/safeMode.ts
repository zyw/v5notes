export const SAFE_MODE_STORAGE_KEY = 'v5notes.vault.safeMode.v1'

export function loadSafeMode(store: Storage | null = defaultStore()): boolean {
  if (!store) return false
  return store.getItem(SAFE_MODE_STORAGE_KEY) === '1'
}

export function saveSafeMode(enabled: boolean, store: Storage | null = defaultStore()): void {
  if (!store) return
  if (enabled) store.setItem(SAFE_MODE_STORAGE_KEY, '1')
  else store.removeItem(SAFE_MODE_STORAGE_KEY)
}

function defaultStore(): Storage | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage
}
