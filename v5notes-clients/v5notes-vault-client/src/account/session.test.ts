/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest'
import { clearSession, clearTokens, readSession, writeSession } from './session'
import type { CredentialStore, SessionSecrets } from './credentialStore'
import { STORAGE_KEYS } from './constants'

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed))
  return {
    get length() { return map.size },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => { map.delete(key) },
    setItem: (key: string, value: string) => { map.set(key, value) },
  }
}

/** In-memory stand-in for the OS keychain. */
function fakeStore(): CredentialStore & { secrets: SessionSecrets; calls: string[] } {
  const secrets: SessionSecrets = { token: '', refreshToken: '' }
  const calls: string[] = []
  return {
    secrets,
    calls,
    async load() { calls.push('load'); return { ...secrets } },
    async save(next) { calls.push('save'); secrets.token = next.token; secrets.refreshToken = next.refreshToken },
    async clear() { calls.push('clear'); secrets.token = ''; secrets.refreshToken = '' },
  }
}

describe('account session', () => {
  it('writes tokens to the credential store and username to localStorage — never a password', async () => {
    localStorage.clear()
    const store = fakeStore()
    await writeSession({ token: 't1', refreshToken: 'r1', username: 'alice' }, store)
    expect(await readSession(store)).toEqual({ token: 't1', refreshToken: 'r1', username: 'alice' })
    // Tokens live in the store, not localStorage.
    expect(localStorage.getItem(STORAGE_KEYS.token)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.refreshToken)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.username)).toBe('alice')
    expect([...Object.keys(localStorage)].every(key => !key.toLowerCase().includes('password'))).toBe(true)
  })

  it('clears tokens on logout/401 but can keep username', async () => {
    localStorage.clear()
    const store = fakeStore()
    await writeSession({ token: 't1', refreshToken: 'r1', username: 'alice' }, store)
    await clearTokens(store)
    expect(await readSession(store)).toEqual({ token: '', refreshToken: '', username: 'alice' })
    await clearSession(store)
    expect(await readSession(store)).toEqual({ token: '', refreshToken: '', username: '' })
    expect(store.calls).toContain('clear')
  })
})
