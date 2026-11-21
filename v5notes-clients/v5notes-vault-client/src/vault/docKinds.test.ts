import { describe, expect, it } from 'vitest'
import {
  DOC_KINDS,
  MARKDOWN_KIND,
  TEXT_KIND,
  displayNameOf,
  displayNameOfIn,
  docKindById,
  docKindOfPath,
  initialContentFor,
  isNotePath,
  isSafeExtension,
  noteSuffixes,
  sortKinds,
  toCustomKind,
  docKindOfPathIn,
} from './docKinds'

describe('docKinds', () => {
  it('maps every built-in suffix to its kind', () => {
    expect(docKindOfPath('notes/a.md')?.id).toBe(MARKDOWN_KIND)
    expect(docKindOfPath('notes/a.txt')?.id).toBe(TEXT_KIND)
    expect(docKindOfPath('a.MD')?.id).toBe(MARKDOWN_KIND)
    expect(docKindOfPath('a.Txt')?.id).toBe(TEXT_KIND)
  })

  it('returns null for assets and bare names', () => {
    expect(docKindOfPath('attachments/pic.png')).toBeNull()
    expect(docKindOfPath('notes/markdown')).toBeNull()
    expect(docKindOfPath('')).toBeNull()
    expect(docKindOfPath(null)).toBeNull()
    expect(docKindOfPath(undefined)).toBeNull()
  })

  it('strips only the kind suffix from the leaf', () => {
    expect(displayNameOf('dir/sub/My Note.md')).toBe('My Note')
    expect(displayNameOf('dir/sub/My Note.txt')).toBe('My Note')
    expect(displayNameOf('dir.md/inner.txt')).toBe('inner')
    expect(displayNameOf('README')).toBe('README')
  })

  it('exposes the note suffix list for sync, trash and search', () => {
    expect(noteSuffixes()).toEqual(['.md', '.txt'])
    expect(isNotePath('a.txt')).toBe(true)
    expect(isNotePath('a.png')).toBe(false)
  })

  it('seeds Markdown with a heading and text notes empty', () => {
    const markdown = docKindById(MARKDOWN_KIND)!
    const text = docKindById(TEXT_KIND)!
    expect(initialContentFor(markdown, 'Untitled')).toBe('# Untitled\n\n')
    expect(initialContentFor(text, 'Untitled')).toBe('')
  })

  it('keeps core kinds unique and resolvable by id', () => {
    const ids = DOC_KINDS.map(kind => kind.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(docKindById('nope')).toBeNull()
  })

  it('accepts a fresh plugin kind and rejects reserved ones', () => {
    const ok = toCustomKind({ id: 'csv', label: 'CSV 表格', newLabel: '新建 CSV 表格', extension: '.CSV' })
    expect('kind' in ok && ok.kind).toMatchObject({ id: 'csv', extension: '.csv', initialContent: '' })

    // Core ids and core suffixes stay reserved.
    expect('error' in toCustomKind({ id: 'markdown', label: 'x', newLabel: 'x', extension: '.sql' })).toBe(true)
    expect('error' in toCustomKind({ id: 'sneaky', label: 'x', newLabel: 'x', extension: '.md' })).toBe(true)
    expect('error' in toCustomKind({ id: 'sneaky', label: 'x', newLabel: 'x', extension: '.TXT' })).toBe(true)
    expect('error' in toCustomKind({ id: 'bad', label: 'x', newLabel: 'x', extension: '../x' })).toBe(true)
  })

  it('sorts core kinds ahead of plugin kinds', () => {
    const custom = { id: 'csv', label: 'CSV', newLabel: '新建 CSV', extension: '.csv', initialContent: '' }
    const sorted = sortKinds([custom, ...DOC_KINDS])
    expect(sorted.map((kind) => kind.id)).toEqual(['markdown', 'text', 'csv'])
    expect(docKindOfPathIn(sorted, 'table.csv')?.id).toBe('csv')
  })

  it('treats a plugin kind as a note across shared helpers', () => {
    const ok = toCustomKind({ id: 'csv', label: 'CSV 表格', newLabel: '新建 CSV 表格', extension: '.csv' })
    const csv = 'kind' in ok ? ok.kind : null
    expect(csv).not.toBeNull()
    const table = [...DOC_KINDS, csv!]

    // Tree, trash, sync and search all route through these two helpers.
    expect(docKindOfPathIn(table, 'dir/预算.csv')?.id).toBe('csv')
    expect(displayNameOfIn(table, 'dir/预算.csv')).toBe('预算')
    // Core kinds keep working alongside it.
    expect(docKindOfPathIn(table, 'a.md')?.id).toBe(MARKDOWN_KIND)
  })

  it('rejects provider extensions that could escape the vault', () => {
    expect(isSafeExtension('.csv')).toBe(true)
    expect(isSafeExtension('.tar.gz')).toBe(false)
    expect(isSafeExtension('../x')).toBe(false)
    expect(isSafeExtension('.md/../x')).toBe(false)
    expect(isSafeExtension('')).toBe(false)
  })
})
