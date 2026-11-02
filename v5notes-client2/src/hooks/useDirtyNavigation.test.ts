import { describe, expect, it } from 'vitest'
import { Draft } from '../models/draft'
import { resolveDirty } from './useDirtyNavigation'

const note = { id: '912345678901234567', dirId: '0', name: '原笔记', content: '原文' }

describe('unsaved navigation', () => {
  it('does not leave when canceled', async () => {
    const draft = new Draft()
    draft.load(note)
    draft.edit('尚未保存')
    expect(await resolveDirty(draft, async () => 'cancel', async () => {})).toBe(false)
    expect(draft.note?.id).toBe(note.id)
    expect(draft.dirty).toBe(true)
  })

  it('only leaves after save succeeds or the user discards', async () => {
    const draft = new Draft()
    draft.load(note)
    draft.edit('已修改')
    expect(await resolveDirty(draft, async () => 'save', async () => { throw new Error('断网') })).toBe(false)
    expect(draft.dirty).toBe(true)
    expect(await resolveDirty(draft, async () => 'save', async () => {})).toBe(true)
    draft.edit('再修改')
    expect(await resolveDirty(draft, async () => 'discard', async () => {})).toBe(true)
  })
})
