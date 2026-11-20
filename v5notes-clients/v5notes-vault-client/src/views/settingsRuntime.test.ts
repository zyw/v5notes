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

  it('sorts by newest note change, newest first', () => {
    const rows = buildSettingsVaultRows(
      [
        { rootPath: '/old', name: '旧库', updatedAt: 1_000 },
        { rootPath: '/new', name: '新库', updatedAt: 3_000 },
        { rootPath: '/mid', name: '中库', updatedAt: 2_000 },
      ],
      { rootPath: '/old', name: '旧库' },
    )
    expect(rows.map((r) => r.name)).toEqual(['新库', '中库', '旧库'])
    // 正在看的库只是被标记，不会因为被看而跳到最前
    expect(rows.find((r) => r.name === '旧库')!.active).toBe(true)
  })

  it('falls back to the registry time when the folder cannot be read', () => {
    const rows = buildSettingsVaultRows(
      [
        { rootPath: '/a', name: 'A', updatedAt: null, registeredAt: '2026-11-01T00:00:00.000Z' },
        { rootPath: '/b', name: 'B', updatedAt: null, registeredAt: '2026-11-20T00:00:00.000Z' },
      ],
      null,
    )
    expect(rows.map((r) => r.name)).toEqual(['B', 'A'])
  })

  it('keeps ties in registry order so the list does not shuffle', () => {
    const rows = buildSettingsVaultRows(
      [
        { rootPath: '/x', name: 'X', updatedAt: 5_000 },
        { rootPath: '/y', name: 'Y', updatedAt: 5_000 },
        { rootPath: '/z', name: 'Z', updatedAt: 5_000 },
      ],
      { rootPath: '/y', name: 'Y' },
    )
    expect(rows.map((r) => r.name)).toEqual(['X', 'Y', 'Z'])
  })

  it('keeps registry order: viewing a vault does not move it to the top', () => {
    const rows = buildSettingsVaultRows(
      [
        { rootPath: '/b', name: '工作日志' },
        { rootPath: '/a', name: '读书笔记' },
        { rootPath: '/c', name: '资料库' },
      ],
      { rootPath: '/a', name: '读书笔记' },
    )
    // 顺序完全来自登记顺序；当前库只是被标记，不会被挪到首位
    expect(rows.map((r) => r.rootPath)).toEqual(['/b', '/a', '/c'])
    expect(rows.filter((r) => r.rootPath === '/a')).toHaveLength(1)
    expect(rows[1]!.active).toBe(true)
    expect(rows[0]!.active).toBe(false)
  })

  it('appends a vault that is open but missing from the registry', () => {
    const rows = buildSettingsVaultRows(
      [{ rootPath: '/b', name: '工作日志' }],
      { rootPath: '/new', name: '新库' },
    )
    expect(rows.map((r) => r.rootPath)).toEqual(['/b', '/new'])
    expect(rows[1]).toMatchObject({ active: true })
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
describe('active vault never reorders the list', () => {
  const snapshot = [
    { rootPath: '/a', name: 'A' },
    { rootPath: '/b', name: 'B' },
    { rootPath: '/c', name: 'C' },
  ]

  it('keeps every vault in place when the active one changes', () => {
    for (const activeRoot of ['/a', '/b', '/c']) {
      const rows = buildSettingsVaultRows(snapshot, { rootPath: activeRoot, name: activeRoot })
      expect(rows.map((r) => r.rootPath)).toEqual(['/a', '/b', '/c'])
      expect(rows.filter((r) => r.active).map((r) => r.rootPath)).toEqual([activeRoot])
    }
  })

  it('appends a vault that is active but not in the snapshot, without moving others', () => {
    const rows = buildSettingsVaultRows(snapshot, { rootPath: '/zz', name: '新库' })
    expect(rows.map((r) => r.rootPath)).toEqual(['/a', '/b', '/c', '/zz'])
  })
})
