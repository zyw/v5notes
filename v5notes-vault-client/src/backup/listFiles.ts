import { join } from '@tauri-apps/api/path'
import { readDir } from '@tauri-apps/plugin-fs'
import { isExcludedFromBackup } from './collect'

const SKIP_NAMES = new Set(['.git', '.DS_Store', 'Thumbs.db'])

/**
 * Recursively list all file relative paths under a vault root (including `.v5notes`),
 * applying backup exclusion rules.
 */
export async function listBackupRelativePaths(rootPath: string): Promise<string[]> {
  const out: string[] = []

  async function walk(dirAbs: string, dirRel: string | null): Promise<void> {
    const entries = await readDir(dirAbs)
    for (const entry of entries) {
      const name = entry.name
      if (!name || SKIP_NAMES.has(name)) continue
      if (entry.isSymlink) continue
      const rel = dirRel ? `${dirRel}/${name}` : name
      if (isExcludedFromBackup(rel)) continue
      if (entry.isDirectory) {
        await walk(await join(dirAbs, name), rel)
        continue
      }
      if (entry.isFile) out.push(rel.replace(/\\/g, '/'))
    }
  }

  await walk(rootPath, null)
  out.sort((a, b) => a.localeCompare(b))
  return out
}
