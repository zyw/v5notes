import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  VAULT_COLOR_PALETTE,
  applyPendingWelcomeColor,
  applyVaultColor,
  applyVaultColorForPath,
  commitPendingWelcomeColor,
  getPendingWelcomeColor,
  resolveVaultColor,
  setPendingWelcomeColor,
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

  it('applies pending welcome color when path is null', () => {
    setPendingWelcomeColor('yushui')
    applyVaultColor('#7d8f6e')
    const pending = applyVaultColorForPath(null)
    expect(pending?.id).toBe('yushui')
    expect(styleMap.get('--vault')).toBe(pending?.color)
  })

  it('persists welcome pending color and commits it to a path', () => {
    const picked = setPendingWelcomeColor('dongzhi')
    expect(getPendingWelcomeColor().id).toBe('dongzhi')
    expect(applyPendingWelcomeColor().color).toBe(picked.color)
    const bound = commitPendingWelcomeColor('/tmp/new-vault')
    expect(bound.id).toBe('dongzhi')
    expect(resolveVaultColor('/tmp/new-vault').id).toBe('dongzhi')
  })
})
