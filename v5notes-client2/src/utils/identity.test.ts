import { describe, expect, it } from 'vitest'
import { normalizeIds } from './identity'

describe('backend identities', () => {
  it('converts numeric sentinel IDs without changing pagination counts or enums', () => {
    expect(normalizeIds({ data: [{ id: 0, pid: 0, type: 1, children: [{ id: '934509293439939393' }] }], total: 42 }))
      .toEqual({ data: [{ id: '0', pid: '0', type: 1, children: [{ id: '934509293439939393' }] }], total: 42 })
  })

  it('rejects unsafe numeric snowflakes instead of silently rounding them', () => {
    expect(() => normalizeIds({ data: { dirId: 934509293439939400 } })).toThrow(/unsafe numeric ID/)
  })
})
