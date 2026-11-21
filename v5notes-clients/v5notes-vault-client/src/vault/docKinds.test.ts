import { describe, expect, it } from 'vitest'
import {
  DOC_KINDS,
  MARKDOWN_KIND,
  TEXT_KIND,
  displayNameOf,
  docKindById,
  docKindOfPath,
  initialContentFor,
  isNotePath,
  isSafeExtension,
  noteSuffixes,
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

  it('rejects provider extensions that could escape the vault', () => {
    expect(isSafeExtension('.csv')).toBe(true)
    expect(isSafeExtension('.tar.gz')).toBe(false)
    expect(isSafeExtension('../x')).toBe(false)
    expect(isSafeExtension('.md/../x')).toBe(false)
    expect(isSafeExtension('')).toBe(false)
  })
})
