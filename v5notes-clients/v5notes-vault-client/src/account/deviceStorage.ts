/**
 * Device-local copy of the session secrets.
 *
 * The OS keychain entry is shared by every build that carries the same signing
 * identity, so it cannot answer "was I signed in on *this* install?". WebView
 * localStorage is per app data directory (dev build and installed app each get
 * their own), which is the right scope for restoring the session after a
 * reload. Values here still never contain a password.
 */

/** localStorage keys, deliberately outside `STORAGE_KEYS` (never the shared token keys). */
export const DEVICE_KEYS = {
  token: 'v5notes-vault-device-token',
  refreshToken: 'v5notes-vault-device-refresh-token',
} as const

function storage(): Storage | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

export function writeDeviceScopedItem(name: keyof typeof DEVICE_KEYS, value: string): void {
  const store = storage()
  if (!store) return
  if (value) store.setItem(DEVICE_KEYS[name], value)
  else store.removeItem(DEVICE_KEYS[name])
}

export function removeDeviceScopedItem(name: keyof typeof DEVICE_KEYS): void {
  storage()?.removeItem(DEVICE_KEYS[name])
}
