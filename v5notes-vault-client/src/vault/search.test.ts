import { describe, expect, it } from 'vitest'
import { scoreNoteHit } from './searchScore'
import { buildTrashRel, isMetaOrTrashPath, isUnderTrash } from './trashPaths'

describe('scoreNoteHit (local search MVP)', () => {
  it('scores title matches above body', () => {
    const titleHit = scoreNoteHit('工作/周报.md', '无关正文', '周报')
    const bodyHit = scoreNoteHit('工作/其他.md', '这里有周报内容', '周报')
    expect(titleHit).not.toBeNull()
    expect(bodyHit).not.toBeNull()
    expect(titleHit!.score).toBeGreaterThan(bodyHit!.score)
  })

  it('returns null when query misses', () => {
    expect(scoreNoteHit('a.md', 'hello', 'xyz')).toBeNull()
  })

  it('builds a body snippet around the match', () => {
    const hit = scoreNoteHit('note.md', '前面内容 关键字 后面内容', '关键字')
    expect(hit?.snippet).toContain('关键字')
  })
})

describe('trash helpers (§6.4 local only)', () => {
  it('builds stamp-prefixed trash paths', () => {
    const rel = buildTrashRel('工作/周报.md', new Date('2026-11-14T08:00:00.000Z'))
    expect(rel.startsWith('.v5notes/trash/')).toBe(true)
    expect(rel.endsWith('工作/周报.md')).toBe(true)
  })

  it('detects trash / metadata paths', () => {
    expect(isUnderTrash('.v5notes/trash/x')).toBe(true)
    expect(isMetaOrTrashPath('.v5notes/vault.json')).toBe(true)
    expect(isUnderTrash('工作/周报.md')).toBe(false)
  })
})
