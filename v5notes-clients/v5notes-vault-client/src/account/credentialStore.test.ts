/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it } from 'vitest'
import { createFallbackStore, createPersistentStore, type CredentialStore, type SessionSecrets } from './credentialStore'
import { DEVICE_KEYS } from './deviceStorage'

function fakeStore(seed: SessionSecrets = { token: '', refreshToken: '' }): CredentialStore & { secrets: SessionSecrets } {
  const secrets = { ...seed }
  return {
    secrets,
    async load() { return { ...secrets } },
    async save(next) { secrets.token = next.token; secrets.refreshToken = next.refreshToken },
    async clear() { secrets.token = ''; secrets.refreshToken = '' },
  }
}

function store() {
  return createFallbackStore({ token: DEVICE_KEYS.token, refreshToken: DEVICE_KEYS.refreshToken })
}

describe('persistent credential store (Tauri)', () => {
  beforeEach(() => localStorage.clear())

  it('restores a session after a reload', async () => {
    const keychain = fakeStore()
    await createPersistentStore(store(), keychain).save({ token: 't1', refreshToken: 'r1' })
    // Fresh store instances, as a page reload creates.
    const restored = await createPersistentStore(store(), fakeStore(keychain.secrets)).load()
    expect(restored).toEqual({ token: 't1', refreshToken: 'r1' })
  })

  it('keeps the session when another build wipes the shared keychain entry', async () => {
    const keychain = fakeStore()
    await createPersistentStore(store(), keychain).save({ token: 't1', refreshToken: 'r1' })
    // A different install/binary sharing the keychain service signs out.
    keychain.secrets.token = ''
    keychain.secrets.refreshToken = ''
    const loaded = await createPersistentStore(store(), keychain).load()
    expect(loaded).toEqual({ token: 't1', refreshToken: 'r1' })
    // …and writes its copy back so the next reload is still signed in.
    expect(keychain.secrets).toEqual({ token: 't1', refreshToken: 'r1' })
  })

  it('clears both copies on explicit logout', async () => {
    const keychain = fakeStore()
    await createPersistentStore(store(), keychain).save({ token: 't1', refreshToken: 'r1' })
    await createPersistentStore(store(), keychain).clear()
    expect(keychain.secrets).toEqual({ token: '', refreshToken: '' })
    expect(await store().load()).toEqual({ token: '', refreshToken: '' })
    expect(await createPersistentStore(store(), keychain).load()).toEqual({ token: '', refreshToken: '' })
  })

  it('stays signed out after logout even when the keychain read fails', async () => {
    const keychain = fakeStore()
    await createPersistentStore(store(), keychain).save({ token: 't1', refreshToken: 'r1' })
    const denied: CredentialStore = {
      load: async () => ({ token: '', refreshToken: '' }),
      save: async () => {},
      clear: async () => {},
    }
    await createPersistentStore(store(), denied).clear()
    expect(await createPersistentStore(store(), denied).load()).toEqual({ token: '', refreshToken: '' })
  })

  it('prefers the keychain copy when it holds a newer token', async () => {
    const keychain = fakeStore({ token: 'fresh', refreshToken: 'freshR' })
    await store().save({ token: 'stale', refreshToken: 'staleR' })
    expect(await createPersistentStore(store(), keychain).load()).toEqual({ token: 'fresh', refreshToken: 'freshR' })
  })
})
