import { describe, expect, it } from 'vitest'
import { toIdentityKey } from '../path/identity'
import { buildConflictCopyPath, deviceShort } from './conflict'

describe('conflict copy naming §9.3', () => {
  it('builds stamped conflict path', () => {
    const occupied = new Set<string>()
    const path = buildConflictCopyPath(
      '工作/周报.md',
      'macbook-device-01',
      occupied,
      toIdentityKey,
      new Date('2026-11-14T16:42:00'),
    )
    expect(path).toBe('工作/周报 (冲突 2026-11-14 1642 macboo).md')
  })

  it('appends -2 when occupied', () => {
    const first = '周报 (冲突 2026-11-14 1642 abcdef).md'
    const occupied = new Set([toIdentityKey(first)])
    const path = buildConflictCopyPath(
      '周报.md',
      'abcdef',
      occupied,
      toIdentityKey,
      new Date('2026-11-14T16:42:00'),
    )
    expect(path).toContain('-2.md')
  })

  it('shortens device id', () => {
    expect(deviceShort('ABC-123')).toBe('abc123')
  })
})
