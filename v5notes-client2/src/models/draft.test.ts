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

  it('saves a preview task change without leaving the note unsaved', async () => {
    const draft = new Draft()
    draft.load(note)
    await draft.commit('- [x] 待办', async written => {
      expect(written.content).toBe('- [x] 待办')
      return { contentHash: 'b'.repeat(64) }
    })
    expect(draft.dirty).toBe(false)
    expect(draft.note?.content).toBe('- [x] 待办')
    expect(draft.note?.contentHash).toBe('b'.repeat(64))
  })

  it('keeps a failed preview task change and marks it unsaved', async () => {
    const draft = new Draft()
    draft.load(note)
    await expect(draft.commit('- [x] 待办', async () => { throw new Error('断网') })).rejects.toThrow('断网')
    expect(draft.dirty).toBe(true)
    expect(draft.note?.content).toBe('- [x] 待办')
  })

  it('writes rapid preview task changes in order and stays saved', async () => {
    const draft = new Draft()
    draft.load(note)
    const written: string[] = []
    let releaseFirst!: () => void
    const first = draft.commit('第一下', () => new Promise<void>(resolve => { releaseFirst = () => resolve() }).then(() => {
      written.push('第一下')
    }))
    const second = draft.commit('第二下', async () => {
      written.push('第二下')
      return { contentHash: 'c'.repeat(64) }
    })
    await Promise.resolve()
    releaseFirst()
    await first
    await second
    expect(written).toEqual(['第一下', '第二下'])
    expect(draft.dirty).toBe(false)
    expect(draft.note?.content).toBe('第二下')
    expect(draft.note?.contentHash).toBe('c'.repeat(64))
  })

  it('does not send another save when toggles return to the request already in flight', async () => {
    const draft = new Draft()
    draft.load({ ...note, content: '- [ ] 待办', contentHash: 'h0' })
    const seen: string[] = []
    let release!: () => void
    const write = (written: Note) => {
      seen.push(written.content)
      return new Promise<{ contentHash: string }>(resolve => {
        release = () => resolve({ contentHash: 'h1' })
      })
    }
    const first = draft.commit('- [x] 待办', write)
    await Promise.resolve()
    draft.commit('- [ ] 待办', write)
    const back = draft.commit('- [x] 待办', write)
    release()
    await first
    await back
    expect(seen).toEqual(['- [x] 待办'])
    expect(draft.dirty).toBe(false)
    expect(draft.note?.content).toBe('- [x] 待办')
    expect(draft.note?.contentHash).toBe('h1')
  })

  it('follows an in-flight preview save with the latest content and the new hash', async () => {
    const draft = new Draft()
    draft.load({ ...note, contentHash: 'h0' })
    const seen: Array<{ content: string; contentHash?: string }> = []
    let release!: () => void
    const first = draft.commit('勾上', async written => {
      seen.push({ content: written.content, contentHash: written.contentHash })
      await new Promise<void>(resolve => { release = resolve })
      return { contentHash: 'h1' }
    })
    await Promise.resolve()
    const second = draft.commit('取消', async written => {
      seen.push({ content: written.content, contentHash: written.contentHash })
      return { contentHash: 'h2' }
    })
    release()
    await first
    await second
    expect(seen).toEqual([
      { content: '勾上', contentHash: 'h0' },
      { content: '取消', contentHash: 'h1' },
    ])
    expect(draft.dirty).toBe(false)
    expect(draft.note?.contentHash).toBe('h2')
  })

  it('treats a repeated preview save as already stored', async () => {
    const draft = new Draft()
    draft.load(note)
    await draft.commit('- [x] 待办', async () => { throw new Error('不允许重复提交，请稍候再试') })
    expect(draft.dirty).toBe(false)
    expect(draft.note?.content).toBe('- [x] 待办')
  })

  it('does not clear a newer manual edit when an earlier preview save finishes', async () => {
    const draft = new Draft()
    draft.load(note)
    let release!: () => void
    const pending = draft.commit('勾选', () => new Promise<void>(resolve => { release = resolve }))
    await Promise.resolve()
    draft.edit('手改')
    release()
    await pending
    expect(draft.note?.content).toBe('手改')
    expect(draft.dirty).toBe(true)
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
