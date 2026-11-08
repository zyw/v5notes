import { describe, expect, it } from 'vitest'
import { Draft } from './draft'

const note = { id: '934509293439939393', dirId: '0', name: '笔记', content: '原文' }

describe('draft saves', () => {
  it('loads cleanly and clears dirty only after a successful save', async () => {
    const draft = new Draft()
    draft.load(note)
    expect(draft.dirty).toBe(false)
    draft.edit('修改')
    expect(draft.dirty).toBe(true)
    await draft.save(async written => { expect(written.content).toBe('修改') })
    expect(draft.dirty).toBe(false)
  })

  it('keeps newer edits dirty when an earlier save completes', async () => {
    const draft = new Draft()
    draft.load(note)
    draft.edit('第一版')
    let complete!: () => void
    const pending = draft.save(() => new Promise<void>(resolve => { complete = resolve }))
    await Promise.resolve()
    draft.edit('第二版')
    complete()
    await pending
    expect(draft.dirty).toBe(true)
    expect(draft.note?.content).toBe('第二版')
  })

  it('preserves content after a failed save', async () => {
    const draft = new Draft()
    draft.load(note)
    draft.edit('离线草稿')
    await expect(draft.save(async () => { throw new Error('断网') })).rejects.toThrow('断网')
    expect(draft.dirty).toBe(true)
    expect(draft.note?.content).toBe('离线草稿')
  })

  it('keeps the saved content hash for the next request', async () => {
    const draft = new Draft()
    draft.load({ ...note, contentHash: 'a'.repeat(64) })
    draft.edit('修改')
    await draft.save(async () => ({ contentHash: 'b'.repeat(64) }))
    expect(draft.dirty).toBe(false)
    expect(draft.note?.contentHash).toBe('b'.repeat(64))
  })

  it('clears a discarded draft before another directory is opened', () => {
    const draft = new Draft()
    draft.load(note)
    draft.edit('未保存')
    draft.clear()
    expect(draft.note).toBeNull()
    expect(draft.dirty).toBe(false)
  })
})
