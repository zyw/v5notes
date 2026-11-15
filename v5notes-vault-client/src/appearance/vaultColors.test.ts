import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  VAULT_COLOR_PALETTE,
  applyVaultColor,
  applyVaultColorForPath,
  resolveVaultColor,
  setVaultColor,
} from './vaultColors'

const store = new Map<string, string>()

vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, v)
  },
  removeItem: (k: string) => {
    store.delete(k)
  },
  clear: () => {
    store.clear()
  },
})

const styleMap = new Map<string, string>()
vi.stubGlobal('document', {
  documentElement: {
    style: {
      setProperty: (k: string, v: string) => {
        styleMap.set(k, v)
      },
      removeProperty: (k: string) => {
        styleMap.delete(k)
      },
      getPropertyValue: (k: string) => styleMap.get(k) ?? '',
    },
    dataset: {} as Record<string, string>,
  },
})

describe('vaultColors', () => {
  beforeEach(() => {
    store.clear()
    styleMap.clear()
  })

  it('resolves a stable palette color from path', () => {
    const a = resolveVaultColor('/Users/demo/Notes/alpha')
    const b = resolveVaultColor('/Users/demo/Notes/alpha')
    expect(a).toEqual(b)
    expect(VAULT_COLOR_PALETTE.some(s => s.id === a.id)).toBe(true)
  })

  it('persists an override and applies CSS variable', () => {
    const picked = setVaultColor('/tmp/vault', 'hanlu')
    expect(picked.id).toBe('hanlu')
    expect(resolveVaultColor('/tmp/vault').id).toBe('hanlu')
    expect(styleMap.get('--vault')).toBe(picked.color)
  })

  it('clears CSS variable when path is null', () => {
    applyVaultColor('#7d8f6e')
    applyVaultColorForPath(null)
    expect(styleMap.has('--vault')).toBe(false)
  })
})
