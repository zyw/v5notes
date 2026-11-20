import { describe, expect, it } from 'vitest'
import { decideRuntimeBoot } from './settingsRuntime'

describe('settings runtime boot', () => {
  it('starts the extension host even before a vault is open', () => {
    expect(decideRuntimeBoot({ hostPresent: false })).toBe('start')
    expect(decideRuntimeBoot({ hostPresent: false, rootPath: null })).toBe('start')
  })

  it('reuses a running host', () => {
    expect(decideRuntimeBoot({ hostPresent: true })).toBe('reuse')
  })

  it('reuses the host when switching vaults: extensions are app-level', () => {
    expect(decideRuntimeBoot({ hostPresent: true, hostRoot: '/vault-a', rootPath: '/vault-b' })).toBe(
      'reuse',
    )
  })
})
import { buildSettingsVaultRows, resolveInitialScope } from './settingsRuntime'

describe('settings scope', () => {
  it('opens on the global page when no vault is open', () => {
    expect(resolveInitialScope(false)).toBe('global')
    expect(resolveInitialScope(true)).toBe('vault')
  })

  it('pins the open vault first, then keeps registry order without duplicates', () => {
    const rows = buildSettingsVaultRows(
      [
        { rootPath: '/b', name: '工作日志' },
        { rootPath: '/a', name: '读书笔记' },
        { rootPath: '/c', name: '资料库' },
      ],
      { rootPath: '/a', name: '读书笔记' },
    )
    expect(rows.map((r) => r.rootPath)).toEqual(['/a', '/b', '/c'])
    expect(rows.filter((r) => r.rootPath === '/a')).toHaveLength(1)
    expect(rows[0]!.active).toBe(true)
    expect(rows[1]!.active).toBe(false)
  })

  it('lists registry vaults when nothing is open, none of them active', () => {
    const rows = buildSettingsVaultRows([{ rootPath: '/x', name: 'X' }], null)
    expect(rows).toEqual([{ rootPath: '/x', name: 'X', active: false, missing: false }])
  })

  it('marks off-disk vaults missing but never the open one', () => {
    const rows = buildSettingsVaultRows(
      [
        { rootPath: '/gone', name: '资料库' },
        { rootPath: '/here', name: '读书笔记' },
      ],
      { rootPath: '/here', name: '读书笔记' },
      new Set(['/gone', '/here']),
    )
    expect(rows.find((r) => r.rootPath === '/gone')!.missing).toBe(true)
    expect(rows.find((r) => r.rootPath === '/here')!.missing).toBe(false)
  })
})
