/**
 * Credential store abstraction (Phase 5 hardening).
 *
 * Access/refresh tokens move out of localStorage into the OS keychain via the
 * Rust `keychain` command (macOS Keychain, Windows Credential Manager, Linux
 * Secret Service — all through the `keyring` crate). Username and server stay
 * in localStorage: they are not secrets. In a plain browser dev preview there
 * is no keychain, so tokens fall back to localStorage with a console warning;
 * the Tauri shell is the shipped product surface.
 */

import { invoke, isTauri } from '@tauri-apps/api/core'
import { STORAGE_KEYS } from './constants'
import { DEVICE_KEYS, removeDeviceScopedItem } from './deviceStorage'

export interface SessionSecrets {
  token: string
  refreshToken: string
}

export interface CredentialStore {
  load(): Promise<SessionSecrets>
  save(secrets: SessionSecrets): Promise<void>
  clear(): Promise<void>
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function webStorage(): StorageLike | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

/** localStorage fallback for non-Tauri (browser dev) contexts. */
export function createFallbackStore(keys: { token: string; refreshToken: string }): CredentialStore {
  return {
    async load() {
      const store = webStorage()
      return {
        token: store?.getItem(keys.token) || '',
        refreshToken: store?.getItem(keys.refreshToken) || '',
      }
    },
    async save(secrets) {
      const store = webStorage()
      if (!store) return
      store.setItem(keys.token, secrets.token)
      if (secrets.refreshToken) store.setItem(keys.refreshToken, secrets.refreshToken)
      else store.removeItem(keys.refreshToken)
    },
    async clear() {
      const store = webStorage()
      if (!store) return
      store.removeItem(keys.token)
      store.removeItem(keys.refreshToken)
    },
  }
}

interface KeychainResponse {
  token?: string | null
  refreshToken?: string | null
}

/**
 * OS keychain store. Every operation invokes the Rust `keychain` command; any
 * failure (locked keychain, unsupported platform) degrades to "no keychain
 * session" instead of throwing. The OS keychain is shared by every build of the
 * app that uses the same signing identity, so an unsigned `tauri dev` build and
 * the installed app can see (and overwrite) each other's entries — which is why
 * the store never relies on the keychain as its only copy.
 */
export function createKeychainStore(account: string): CredentialStore {
  async function call(operation: 'get' | 'set' | 'delete', values?: SessionSecrets): Promise<KeychainResponse | null> {
    try {
      return await invoke<KeychainResponse>('keychain', {
        args: { account, operation, token: values?.token ?? '', refreshToken: values?.refreshToken ?? '' },
      })
    } catch {
      return null
    }
  }
  return {
    async load() {
      const res = await call('get')
      return { token: res?.token || '', refreshToken: res?.refreshToken || '' }
    },
    async save(secrets) {
      await call('set', secrets)
    },
    async clear() {
      await call('delete')
    },
  }
}

/**
 * Restores the session after a reload for *this* install.
 *
 * Why not the keychain alone: the keychain service name is fixed, so the
 * installed app, a second checkout and an unsigned `tauri dev` build all read
 * and overwrite one entry. A login made by another build therefore either
 * disappears (its empty save deletes the entry) or is handed to a build that
 * should have its own session. Observed symptom: sign in, reload, signed out.
 *
 * Order of truth: keychain (survives reinstall, and is what other builds see)
 * → device-scoped localStorage (survives a lost/rejected keychain entry) →
 * empty. Writes are mirrored to both; a delete that empties the session clears
 * both.
 */
export function createPersistentStore(
  /** Per-install copy of the tokens (a keychain-independent fallback). */
  device: CredentialStore,
  keychain: CredentialStore = createKeychainStore('session'),
): CredentialStore {
  return {
    async load() {
      const [fromKeychain, fromDevice] = await Promise.all([keychain.load(), device.load()])
      if (fromKeychain.token) return fromKeychain
      if (!fromDevice.token) return fromKeychain
      // Keychain entry is gone (deleted, denied, or written empty by another
      // build): put this install's copy back so the next reload is still signed in.
      await keychain.save(fromDevice)
      return fromDevice
    },
    async save(secrets) {
      await Promise.all([device.save(secrets), keychain.save(secrets)])
    },
    async clear() {
      removeDeviceScopedItem('token')
      removeDeviceScopedItem('refreshToken')
      await Promise.all([device.clear(), keychain.clear()])
    },
  }
}

let active: CredentialStore | null = null

/**
 * The app-wide credential store:
 * - Production Tauri: OS keychain only (never mirror plaintext tokens into localStorage,
 *   which is shared with `new Function` plugins in the same WebView origin).
 * - Unsigned `tauri dev`: persistent store with localStorage fallback so dev reloads survive
 *   shared keychain overwrites.
 * - Browser preview: localStorage fallback.
 */
export function getSessionStore(): CredentialStore {
  if (active) return active
  if (isTauri() && !import.meta.env.DEV) {
    active = createKeychainStore('session')
    return active
  }
  const device = createFallbackStore({ token: DEVICE_KEYS.token, refreshToken: DEVICE_KEYS.refreshToken })
  active = isTauri()
    ? createPersistentStore(device)
    : device
  return active
}

/** Test seam: override the active store (null restores lazy detection). */
export function setSessionStoreForTests(store: CredentialStore | null): void {
  active = store
}
