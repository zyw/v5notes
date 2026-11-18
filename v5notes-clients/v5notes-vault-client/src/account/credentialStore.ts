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
 * failure (locked keychain, unsupported platform) degrades to "no stored
 * session" instead of throwing, so login state simply starts empty.
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

let active: CredentialStore | null = null

/** The app-wide credential store: keychain under Tauri, localStorage otherwise. */
export function getSessionStore(): CredentialStore {
  if (active) return active
  active = isTauri()
    ? createKeychainStore('session')
    : createFallbackStore({ token: STORAGE_KEYS.token, refreshToken: STORAGE_KEYS.refreshToken })
  return active
}

/** Test seam: override the active store (null restores lazy detection). */
export function setSessionStoreForTests(store: CredentialStore | null): void {
  active = store
}
