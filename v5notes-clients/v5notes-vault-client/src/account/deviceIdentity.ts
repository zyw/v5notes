/**
 * Identity of this machine, not of any one vault.
 *
 * A vault directory carries its own replica id in `.v5notes/vault.json`; that id
 * answers "which copy of the library is this". The server also needs to know
 * which machine is calling, so that the same machine running several libraries
 * or re-binding after a reinstall is recognised as one device. That id must not
 * live in a vault (it would travel with the folder, or multiply per directory),
 * so it is kept in WebView localStorage — the same per-app-data-directory scope
 * `deviceStorage` uses for session secrets: a reinstall that keeps app data
 * keeps the id, one that wipes it does not.
 */

export const DEVICE_ID_KEY = 'v5notes-vault-device-id'

function storage(): Storage | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

function newDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

/**
 * This machine's device id, created on first use. Never empty, so callers can
 * send it without a fallback.
 */
export function getDeviceId(): string {
  const store = storage()
  const existing = store?.getItem(DEVICE_ID_KEY)?.trim()
  if (existing) return existing
  const created = newDeviceId()
  try {
    store?.setItem(DEVICE_ID_KEY, created)
  } catch {
    // Private mode or a full quota: the id still identifies this bind call.
  }
  return created
}

/** Test seam: forget the id as if app data had been wiped. */
export function resetDeviceId(): void {
  storage()?.removeItem(DEVICE_ID_KEY)
}

/** Short, filesystem- and label-safe form used in device labels. */
export function deviceShort(deviceId: string | null | undefined, fallback = 'dev'): string {
  const raw = (deviceId || fallback).replace(/[^a-zA-Z0-9]/g, '')
  if (!raw) return 'dev'
  return raw.slice(0, 6).toLowerCase()
}
