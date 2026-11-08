import type { Note } from '../service/api'
import type { Draft } from '../models/draft'
import { ConflictError } from '../service/request'

export type DirtyChoice = 'save' | 'discard' | 'cancel'

export async function resolveDirty(
  draft: Pick<Draft, 'dirty' | 'save'>,
  choose: () => Promise<DirtyChoice>,
  write: (note: Note) => Promise<unknown>,
): Promise<boolean> {
  if (!draft.dirty) return true
  const choice = await choose()
  if (choice === 'cancel') return false
  if (choice === 'discard') return true
  try {
    await draft.save(write)
    return !draft.dirty
  } catch (cause) {
    if (cause instanceof ConflictError) throw cause
    return false
  }
}
