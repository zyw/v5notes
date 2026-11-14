import { describe, expect, it } from 'vitest'
import {
  identityKeysEqual,
  normalizeDisplayPath,
  normalizeVaultName,
  normalizeVaultPath,
  toIdentityKey,
  VaultPathError,
} from './identity'

describe('normalizeVaultPath / identity (§6.2)', () => {
  it('uses forward slashes and preserves display case', () => {
    const result = normalizeVaultPath('工作\\周报.md')
    expect(result.displayPath).toBe('工作/周报.md')
    expect(result.identityKey).toBe('工作/周报.md')
  })

  it('NFC-normalizes and case-folds identity only', () => {
    const nfd = 'Cafe\u0301.md'
    const nfc = 'Café.md'
    expect(normalizeDisplayPath(nfd)).toBe(nfc)
    expect(toIdentityKey('Notes/Hello.MD')).toBe('notes/hello.md')
    expect(identityKeysEqual('Notes/Hello.MD', 'notes/hello.md')).toBe(true)
  })

  it('rejects only-case collisions as equal identity keys', () => {
    expect(toIdentityKey('A/B.md')).toBe(toIdentityKey('a/b.MD'))
  })

  it('rejects empty, absolute, and traversal segments', () => {
    expect(() => normalizeDisplayPath('')).toThrow(VaultPathError)
    expect(() => normalizeDisplayPath('/abs')).toThrow(VaultPathError)
    expect(() => normalizeDisplayPath('C:\\x')).toThrow(VaultPathError)
    expect(() => normalizeDisplayPath('a/../b.md')).toThrow(VaultPathError)
    expect(() => normalizeDisplayPath('a/./b.md')).toThrow(VaultPathError)
  })

  it('rejects Windows reserved names and illegal characters', () => {
    expect(() => normalizeDisplayPath('CON')).toThrow(VaultPathError)
    expect(() => normalizeDisplayPath('aux.txt')).toThrow(VaultPathError)
    expect(() => normalizeDisplayPath('foo?.md')).toThrow(VaultPathError)
    expect(() => normalizeDisplayPath('bad ')).toThrow(VaultPathError)
    expect(() => normalizeDisplayPath('bad.')).toThrow(VaultPathError)
  })

  it('normalizes vault names', () => {
    expect(normalizeVaultName('  MyVault  ')).toBe('MyVault')
    expect(() => normalizeVaultName('')).toThrow(VaultPathError)
    expect(() => normalizeVaultName('x'.repeat(101))).toThrow(VaultPathError)
  })
})
