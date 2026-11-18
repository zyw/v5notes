import { describe, expect, it } from 'vitest'
import { isExcludedFromBackup, flattenFilePaths, BACKUP_META_CANDIDATES } from './collect'
import { buildZipStore, defaultBackupFileName } from './zipStore'
import { BACKUP_NOT_SYNC_LINE, MIGRATION_EXPLICIT_LINE } from './copy'

describe('backup exclusion', () => {
  it('excludes trash, sync-state, index, tmp', () => {
    expect(isExcludedFromBackup('.v5notes/trash/a.md')).toBe(true)
    expect(isExcludedFromBackup('.v5notes/sync-state.json')).toBe(true)
    expect(isExcludedFromBackup('.v5notes/index.sqlite')).toBe(true)
    expect(isExcludedFromBackup('.v5notes/.tmp/x')).toBe(true)
    expect(isExcludedFromBackup('note.tmp-abc')).toBe(true)
    expect(isExcludedFromBackup('欢迎.md')).toBe(false)
    expect(isExcludedFromBackup('.v5notes/vault.json')).toBe(false)
  })

  it('flattens tree and skips excluded', () => {
    const paths = flattenFilePaths([
      { path: 'a.md', kind: 'note' },
      {
        path: 'dir',
        kind: 'dir',
        children: [
          { path: 'dir/b.md', kind: 'note' },
          { path: '.v5notes/trash/x.md', kind: 'file' },
        ],
      },
    ])
    expect(paths).toEqual(['a.md', 'dir/b.md'])
  })

  it('lists meta candidates under .v5notes', () => {
    expect(BACKUP_META_CANDIDATES.some((p) => p.endsWith('vault.json'))).toBe(true)
  })
})

describe('zip store', () => {
  it('builds a recognizable zip with entries', () => {
    const data = new TextEncoder().encode('# hello\n')
    const zip = buildZipStore([
      { path: '欢迎.md', data },
      { path: '.v5notes/vault.json', data: new TextEncoder().encode('{"ok":true}') },
    ])
    // Local file header signature PK\x03\x04
    expect(zip[0]).toBe(0x50)
    expect(zip[1]).toBe(0x4b)
    expect(zip[2]).toBe(0x03)
    expect(zip[3]).toBe(0x04)
    // End of central directory signature
    const endSig = [0x50, 0x4b, 0x05, 0x06]
    let found = false
    for (let i = 0; i < zip.length - 3; i++) {
      if (zip[i] === endSig[0] && zip[i + 1] === endSig[1] && zip[i + 2] === endSig[2] && zip[i + 3] === endSig[3]) {
        found = true
        break
      }
    }
    expect(found).toBe(true)
    const asText = new TextDecoder().decode(zip)
    expect(asText).toContain('欢迎.md')
    expect(asText).toContain('.v5notes/vault.json')
  })

  it('rejects path traversal', () => {
    expect(() => buildZipStore([{ path: '../escape.md', data: new Uint8Array([1]) }])).toThrow(/非法/)
  })

  it('names backup files safely', () => {
    const name = defaultBackupFileName('My Vault:草稿', new Date('2026-11-15T05:00:00.000Z'))
    expect(name).toMatch(/^My-Vault-草稿-backup-/)
    expect(name.endsWith('.zip')).toBe(true)
    expect(name).not.toMatch(/[:/]/)
  })
})

describe('backup product copy', () => {
  it('states backup is not sync and migration is explicit', () => {
    expect(BACKUP_NOT_SYNC_LINE).toMatch(/备份/)
    expect(BACKUP_NOT_SYNC_LINE).toMatch(/不是日常同步|非.*Sync|不作.*Sync|不是.*Sync/i)
    expect(MIGRATION_EXPLICIT_LINE).toMatch(/不会自动合并/)
  })
})
