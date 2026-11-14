/**
 * Local vault search MVP (design §10).
 * Full-text scan of `.md` files — FTS can replace this later without UI changes.
 */

import { toIdentityKey } from '../path/identity'
import { scoreNoteHit } from './searchScore'
import type { VaultTreeNode } from './types'
import { vaultFs } from './vaultFs'

export type { ScoredHit } from './searchScore'
export { scoreNoteHit } from './searchScore'

export interface SearchHit {
  path: string
  identityKey: string
  title: string
  snippet: string
  score: number
}

export interface VaultSearch {
  search(rootPath: string, query: string, options?: { limit?: number }): Promise<SearchHit[]>
}

function collectNotes(nodes: VaultTreeNode[], out: VaultTreeNode[] = []): VaultTreeNode[] {
  for (const node of nodes) {
    if (node.kind === 'note') out.push(node)
    if (node.children?.length) collectNotes(node.children, out)
  }
  return out
}

export const vaultSearch: VaultSearch = {
  async search(rootPath, query, options) {
    const limit = options?.limit ?? 50
    const q = query.trim()
    if (!q) return []

    const tree = await vaultFs.listTree(rootPath)
    const notes = collectNotes(tree)
    const hits: SearchHit[] = []

    for (const note of notes) {
      let body = ''
      try {
        body = await vaultFs.readText(rootPath, note.path)
      } catch {
        continue
      }
      const scored = scoreNoteHit(note.path, body, q)
      if (!scored) continue
      hits.push({
        ...scored,
        identityKey: note.identityKey || toIdentityKey(note.path),
      })
    }

    hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path, 'zh'))
    return hits.slice(0, limit)
  },
}
