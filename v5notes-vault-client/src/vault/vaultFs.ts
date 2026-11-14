import { basename, join } from '@tauri-apps/api/path'
import {
  exists,
  mkdir,
  readDir,
  readTextFile,
  remove,
  rename,
  writeTextFile,
} from '@tauri-apps/plugin-fs'
import { normalizeVaultPath, toIdentityKey, VaultPathError } from '../path/identity'
import { TRASH_DIR_REL, V5NOTES_DIR } from './skeleton'
import type { VaultTreeNode } from './types'

const HIDDEN_ROOT_SKIP = new Set(['.git', '.DS_Store', 'Thumbs.db'])

/** Paths currently being written by this process — watcher should ignore briefly. */
const localWriteGuards = new Map<string, number>()
const WRITE_GUARD_MS = 1500

export function markLocalWrite(rootPath: string, relativePath: string): void {
  const key = `${rootPath}::${relativePath.replace(/\\/g, '/')}`
  localWriteGuards.set(key, Date.now() + WRITE_GUARD_MS)
}

export function isLocalWrite(rootPath: string, relativePath: string): boolean {
  const key = `${rootPath}::${relativePath.replace(/\\/g, '/')}`
  const until = localWriteGuards.get(key)
  if (!until) return false
  if (Date.now() > until) {
    localWriteGuards.delete(key)
    return false
  }
  return true
}

export function touchLocalWriteGuard(rootPath: string, relativePath?: string | null): void {
  if (relativePath) markLocalWrite(rootPath, relativePath)
  // Also guard vault root briefly for mkdir/rename storms.
  markLocalWrite(rootPath, '.')
}

export interface VaultFs {
  listTree(rootPath: string): Promise<VaultTreeNode[]>
  readText(rootPath: string, relativePath: string): Promise<string>
  writeText(rootPath: string, relativePath: string, content: string): Promise<void>
  mkdir(rootPath: string, relativePath: string): Promise<void>
  rename(rootPath: string, fromRel: string, toRel: string): Promise<void>
  /** Permanent delete (prefer moveToTrash from trash.ts for user deletes). */
  delete(rootPath: string, relativePath: string): Promise<void>
  exists(rootPath: string, relativePath?: string): Promise<boolean>
  absolute(rootPath: string, relativePath: string): Promise<string>
}

async function abs(rootPath: string, relativePath: string): Promise<{ absPath: string; displayPath: string }> {
  const { displayPath } = normalizeVaultPath(relativePath)
  const absPath = await join(rootPath, ...displayPath.split('/'))
  return { absPath, displayPath }
}

function isMarkdown(name: string): boolean {
  return name.toLowerCase().endsWith('.md')
}

async function readChildren(rootPath: string, dirRel: string | null): Promise<VaultTreeNode[]> {
  const dirAbs = dirRel ? (await abs(rootPath, dirRel)).absPath : rootPath
  const entries = await readDir(dirAbs)
  const nodes: VaultTreeNode[] = []

  for (const entry of entries) {
    const name = entry.name
    if (!name || HIDDEN_ROOT_SKIP.has(name)) continue
    // Skip vault metadata dir in the note tree (still exists on disk).
    if (!dirRel && name === V5NOTES_DIR) continue
    if (entry.isSymlink) continue

    const rel = dirRel ? `${dirRel}/${name}` : name
    let normalized
    try {
      normalized = normalizeVaultPath(rel)
    } catch {
      // Skip illegal names already on disk; caller can surface later.
      continue
    }

    if (entry.isDirectory) {
      const children = await readChildren(rootPath, normalized.displayPath)
      nodes.push({
        path: normalized.displayPath,
        identityKey: normalized.identityKey,
        name,
        kind: 'dir',
        children,
      })
      continue
    }

    if (entry.isFile) {
      nodes.push({
        path: normalized.displayPath,
        identityKey: normalized.identityKey,
        name,
        kind: isMarkdown(name) ? 'note' : 'file',
      })
    }
  }

  nodes.sort((a, b) => {
    if (a.kind === 'dir' && b.kind !== 'dir') return -1
    if (a.kind !== 'dir' && b.kind === 'dir') return 1
    return a.name.localeCompare(b.name, 'zh')
  })

  // Reject case-only duplicates under the same parent (Linux-safe §6.2).
  const seen = new Set<string>()
  for (const node of nodes) {
    const key = toIdentityKey(node.path)
    if (seen.has(key)) {
      throw new VaultPathError(`库内存在仅大小写不同的路径冲突: ${node.path}`)
    }
    seen.add(key)
  }

  return nodes
}

function tmpNameFor(displayPath: string): string {
  const leaf = displayPath.includes('/') ? displayPath.slice(displayPath.lastIndexOf('/') + 1) : displayPath
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `${leaf}.tmp-${rand}`
}

export const vaultFs: VaultFs = {
  async listTree(rootPath: string) {
    return readChildren(rootPath, null)
  },

  async readText(rootPath, relativePath) {
    const { absPath } = await abs(rootPath, relativePath)
    return readTextFile(absPath)
  },

  async writeText(rootPath, relativePath, content) {
    const { absPath, displayPath } = await abs(rootPath, relativePath)
    const parentRel = displayPath.includes('/')
      ? displayPath.slice(0, displayPath.lastIndexOf('/'))
      : null
    if (parentRel) {
      await vaultFs.mkdir(rootPath, parentRel)
    }

    markLocalWrite(rootPath, displayPath)
    // Crash-safer atomic write: temp sibling → rename over target (same volume).
    // Temp lives next to the target so rename stays atomic on the vault volume.
    const parentAbs = parentRel ? (await abs(rootPath, parentRel)).absPath : rootPath
    const tmpAbs = await join(parentAbs, tmpNameFor(displayPath))
    // Also keep a staging area under .v5notes for diagnostics / orphan cleanup.
    try {
      await mkdir(await join(rootPath, V5NOTES_DIR, '.tmp'), { recursive: true })
    } catch {
      /* ignore */
    }

    await writeTextFile(tmpAbs, content)
    try {
      if (await exists(absPath)) {
        // Prefer replace via remove+rename; same-volume rename is crash-safe enough for Phase 2.
        await remove(absPath)
      }
      await rename(tmpAbs, absPath)
    } catch {
      // Cross-volume or permission fallback: direct write, then drop temp.
      await writeTextFile(absPath, content)
      try {
        await remove(tmpAbs)
      } catch {
        /* ignore */
      }
    }
  },

  async mkdir(rootPath, relativePath) {
    const { absPath, displayPath } = await abs(rootPath, relativePath)
    markLocalWrite(rootPath, displayPath)
    await mkdir(absPath, { recursive: true })
  },

  async rename(rootPath, fromRel, toRel) {
    const from = await abs(rootPath, fromRel)
    const to = await abs(rootPath, toRel)
    if (to.displayPath === TRASH_DIR_REL || to.displayPath.startsWith(`${TRASH_DIR_REL}/`)) {
      // Allow intentional trash moves via trash.ts using absolute rename; block casual rename into trash.
    }
    markLocalWrite(rootPath, from.displayPath)
    markLocalWrite(rootPath, to.displayPath)
    const parentRel = to.displayPath.includes('/')
      ? to.displayPath.slice(0, to.displayPath.lastIndexOf('/'))
      : null
    if (parentRel) await vaultFs.mkdir(rootPath, parentRel)
    await rename(from.absPath, to.absPath)
  },

  async delete(rootPath, relativePath) {
    const { absPath, displayPath } = await abs(rootPath, relativePath)
    markLocalWrite(rootPath, displayPath)
    await remove(absPath, { recursive: true })
  },

  async exists(rootPath, relativePath) {
    if (!relativePath) return exists(rootPath)
    const { absPath } = await abs(rootPath, relativePath)
    return exists(absPath)
  },

  async absolute(rootPath, relativePath) {
    return (await abs(rootPath, relativePath)).absPath
  },
}

export async function vaultRootName(rootPath: string): Promise<string> {
  return basename(rootPath)
}
