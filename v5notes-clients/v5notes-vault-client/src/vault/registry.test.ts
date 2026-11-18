import { beforeEach, describe, expect, it } from 'vitest'
import {
  hydrateVaultRegistry,
  listVaultRegistry,
  registerVault,
  setVaultHidden,
  unregisterVault,
} from './recent'

/**
 * Registry semantics (design-demos/vault-registry-scan.html):
 * hiding never deletes; created-source is sticky; scanning keeps hidden state.
 */

class MemoryStorage {
  private map = new Map<string, string>()
  getItem(key: string) {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.map.set(key, value)
  }
}

const KEY = 'v5notes.vault.registry.v1'

beforeEach(() => {
  const store = new MemoryStorage()
  ;(globalThis as { localStorage?: unknown }).localStorage = store
})

describe('vault registry', () => {
  it('registers creates and opens with sticky created source', async () => {
    await hydrateVaultRegistry()
    registerVault({ rootPath: '/vaults/a', name: 'A' }, 'created')
    registerVault({ rootPath: '/vaults/a', name: 'A' }, 'opened')

    const entry = listVaultRegistry().find(item => item.rootPath === '/vaults/a')
    expect(entry?.source).toBe('created')
    expect(entry?.hidden).toBe(false)
  })

  it('hiding survives later scans but not a real open', () => {
    registerVault({ rootPath: '/vaults/b', name: 'B' }, 'created')
    setVaultHidden('/vaults/b', true)
    expect(listVaultRegistry().find(item => item.rootPath === '/vaults/b')?.hidden).toBe(true)

    registerVault({ rootPath: '/vaults/b', name: 'B' }, 'scanned')
    expect(listVaultRegistry().find(item => item.rootPath === '/vaults/b')?.hidden).toBe(true)

    registerVault({ rootPath: '/vaults/b', name: 'B' }, 'opened')
    expect(listVaultRegistry().find(item => item.rootPath === '/vaults/b')?.hidden).toBe(false)
  })

  it('unregister removes only the targeted record', () => {
    registerVault({ rootPath: '/vaults/c', name: 'C' }, 'created')
    registerVault({ rootPath: '/vaults/d', name: 'D' }, 'opened')
    unregisterVault('/vaults/c')

    const paths = listVaultRegistry().map(item => item.rootPath)
    expect(paths).not.toContain('/vaults/c')
    expect(paths).toContain('/vaults/d')
  })

  it('persists through the localStorage mirror', () => {
    registerVault({ rootPath: '/vaults/e', name: 'E' }, 'created')
    setVaultHidden('/vaults/e', true)
    const raw = JSON.parse(localStorage.getItem(KEY)!) as { rootPath: string; hidden: boolean }[]
    expect(raw.find(item => item.rootPath === '/vaults/e')?.hidden).toBe(true)
  })
})
