import { describe, expect, it } from 'vitest'
import { DOC_KINDS } from '../vault/docKinds'
import { __setRememberedKindsForTest, liveDocKinds } from './runtime'

const csv = { id: 'csv', label: 'CSV 表格', newLabel: '新建 CSV 表格', extension: '.csv', initialContent: '' }

describe('liveDocKinds', () => {
  it('falls back to core kinds before the extension host starts', () => {
    __setRememberedKindsForTest([])
    expect(liveDocKinds().map((kind) => kind.id)).toEqual(DOC_KINDS.map((kind) => kind.id))
  })

  it('keeps a retired plugin kind so its files stay notes', () => {
    // The plugin is gone: no live host, but the suffix was remembered.
    __setRememberedKindsForTest([csv])
    const ids = liveDocKinds().map((kind) => kind.id)
    expect(ids).toContain('csv')
    expect(ids).toContain('markdown')
  })

  it('does not duplicate a kind that is both live and remembered', () => {
    __setRememberedKindsForTest([csv])
    const ids = liveDocKinds().map((kind) => kind.id)
    expect(ids.filter((id) => id === 'csv')).toHaveLength(1)
  })
})
