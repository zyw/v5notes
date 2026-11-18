/**
 * Vault scanner — find vault.json roots under a user-picked directory so
 * forgotten vaults can be recovered into the registry (所有库 → 扫描).
 *
 * Depth-limited, skips noisy/system dirs; any permission error on a subtree
 * just prunes that branch. Results carry absolute root paths for opening and
 * registration.
 */

import { isTauri } from '@tauri-apps/api/core'
import { join } from '@tauri-apps/api/path'
import type { DirEntry } from '@tauri-apps/plugin-fs'
import { exists, readDir, readTextFile } from '@tauri-apps/plugin-fs'
import type { VaultJson } from '../models/vault'
import { VAULT_JSON_REL } from './skeleton'

export const SCAN_MAX_DEPTH = 3
const MAX_VISITED_DIRS = 4000

const IGNORED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'target',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '__pycache__',
  '.venv',
  'venv',
  '.idea',
  '.vscode',
  '$recycle.bin',
  '.trash',
  '.trashes',
])

export interface ScannedVault {
  /** Absolute path of the vault root. */
  rootPath: string
  name: string
  /** Local creation time from vault.json when readable. */
  createdAt?: string
}

async function listDirs(absolutePath: string): Promise<DirEntry[]> {
  try {
    return await readDir(absolutePath)
  } catch {
    // Unscoped or unreadable subtree: prune silently, the scan continues elsewhere.
    return []
  }
}

function isIgnored(name: string): boolean {
  const lower = name.toLowerCase()
  if (IGNORED_DIR_NAMES.has(lower)) return true
  // Hidden dot-folders except none — `.v5notes` never appears as a container to descend.
  return lower.startsWith('.')
}

async function readConfigAt(rootPath: string): Promise<VaultJson | null> {
  // Cheap existence gate first (vault.json is dot-namespaced and easy to miss anyway).
  try {
    const metaPath = await join(rootPath, VAULT_JSON_REL)
    if (!(await exists(metaPath))) return null
    const parsed = JSON.parse(await readTextFile(metaPath)) as Partial<VaultJson>
    if (!parsed || typeof parsed.localVaultId !== 'string' || typeof parsed.name !== 'string') {
      return null
    }
    return parsed as VaultJson
  } catch {
    return null
  }
}

export async function scanForVaults(
  rootPath: string,
  options?: { maxDepth?: number; signal?: { cancelled: boolean } },
): Promise<ScannedVault[]> {
  if (!isTauri()) return []
  const maxDepth = Math.min(options?.maxDepth ?? SCAN_MAX_DEPTH, SCAN_MAX_DEPTH)
  const found: ScannedVault[] = []
  let visited = 0

  async function walk(dir: string, depth: number): Promise<void> {
    if (options?.signal?.cancelled || visited >= MAX_VISITED_DIRS || depth > maxDepth) return
    const entries = await listDirs(dir)
    for (const entry of entries) {
      if (options?.signal?.cancelled || visited >= MAX_VISITED_DIRS) return
      if (!entry.isDirectory || entry.isSymlink || isIgnored(entry.name)) continue
      visited += 1
      const child = await join(dir, entry.name)
      const config = await readConfigAt(child)
      if (config) {
        // A vault root is terminal: its own subfolders cannot host another vault.
        found.push({
          rootPath: child,
          name: config.name || entry.name,
          createdAt: typeof config.createdAt === 'string' ? config.createdAt : undefined,
        })
        continue
      }
      await walk(child, depth + 1)
    }
  }

  // The picked folder itself may already be a vault root.
  const selfConfig = await readConfigAt(rootPath)
  if (selfConfig) {
    found.push({
      rootPath,
      name: selfConfig.name,
      createdAt: typeof selfConfig.createdAt === 'string' ? selfConfig.createdAt : undefined,
    })
    return found
  }

  await walk(rootPath, 1)
  return found
}
