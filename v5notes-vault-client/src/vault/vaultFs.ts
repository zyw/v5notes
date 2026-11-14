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
import type { VaultTreeNode } from './types'

const HIDDEN_ROOT_SKIP = new Set(['.git', '.DS_Store', 'Thumbs.db'])

export interface VaultFs {
  listTree(rootPath: string): Promise<VaultTreeNode[]>
  readText(rootPath: string, relativePath: string): Promise<string>
  writeText(rootPath: string, relativePath: string, content: string): Promise<void>
  mkdir(rootPath: string, relativePath: string): Promise<void>
  rename(rootPath: string, fromRel: string, toRel: string): Promise<void>
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
    if (!dirRel && name === '.v5notes') continue
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
    // Atomic-ish: write temp then rename when possible.
    const tmp = `${absPath}.tmp-${Date.now()}`
    await writeTextFile(tmp, content)
    try {
      if (await exists(absPath)) {
        await remove(absPath)
      }
      await rename(tmp, absPath)
    } catch (error) {
      // Fallback: direct write if rename fails across volumes.
      await writeTextFile(absPath, content)
      try {
        await remove(tmp)
      } catch {
        /* ignore */
      }
      void error
    }
  },

  async mkdir(rootPath, relativePath) {
    const { absPath } = await abs(rootPath, relativePath)
    await mkdir(absPath, { recursive: true })
  },

  async rename(rootPath, fromRel, toRel) {
    const from = await abs(rootPath, fromRel)
    const to = await abs(rootPath, toRel)
    await rename(from.absPath, to.absPath)
  },

  async delete(rootPath, relativePath) {
    const { absPath } = await abs(rootPath, relativePath)
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
