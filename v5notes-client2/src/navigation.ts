import type { Note } from './api'
import type { Draft } from './draft'

export type DirtyChoice = 'save' | 'discard' | 'cancel'

export async function resolveDirty(
  draft: Pick<Draft, 'dirty' | 'save'>,
  choose: () => Promise<DirtyChoice>,
  write: (note: Note) => Promise<void>,
): Promise<boolean> {
  if (!draft.dirty) return true
  const choice = await choose()
  if (choice === 'cancel') return false
  if (choice === 'discard') return true
  try {
    await draft.save(write)
    return !draft.dirty
  } catch {
    return false
  }
}
