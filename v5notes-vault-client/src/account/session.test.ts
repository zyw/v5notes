import { describe, expect, it } from 'vitest'
import { clearSession, clearTokens, readSession, writeSession } from './session'
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

describe('account session', () => {
  it('writes tokens and username without a password field', () => {
    const store = memoryStorage()
    writeSession({ token: 't1', refreshToken: 'r1', username: 'alice' }, store)
    expect(readSession(store)).toEqual({ token: 't1', refreshToken: 'r1', username: 'alice' })
    expect(store.getItem(STORAGE_KEYS.token)).toBe('t1')
    expect([...Object.keys(Object.fromEntries(
      [...Array(store.length)].map((_, i) => [store.key(i)!, store.getItem(store.key(i)!)] as const),
    ))].every((key) => !key.toLowerCase().includes('password'))).toBe(true)
  })

  it('clears tokens on logout/401 but can keep username', () => {
    const store = memoryStorage()
    writeSession({ token: 't1', refreshToken: 'r1', username: 'alice' }, store)
    clearTokens(store)
    expect(readSession(store)).toEqual({ token: '', refreshToken: '', username: 'alice' })
    clearSession(store)
    expect(readSession(store)).toEqual({ token: '', refreshToken: '', username: '' })
  })
})
