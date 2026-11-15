import { basename, dirname, join } from '@tauri-apps/api/path'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { vaultFs } from '../vault/vaultFs'
import { listBackupRelativePaths } from './listFiles'
import { buildZipStore, defaultBackupFileName, type ZipEntry } from './zipStore'

export interface BackupResult {
  fileCount: number
  bytes: number
  savedPath: string
}

export interface BackupProgress {
  total: number
  done: number
  current?: string
}

/**
 * Build a zip of the vault and prompt for a save location.
 * This is **backup only** — not Sync and not a silent restore into another device’s live sync.
 */
export async function backupVaultToZip(
  rootPath: string,
  options?: {
    vaultName?: string
    onProgress?: (p: BackupProgress) => void
  },
): Promise<BackupResult | null> {
  const name = options?.vaultName?.trim() || (await basename(rootPath))
  const paths = await listBackupRelativePaths(rootPath)
  const entries: ZipEntry[] = []

  for (let i = 0; i < paths.length; i++) {
    const rel = paths[i]!
    options?.onProgress?.({ total: paths.length, done: i, current: rel })
    const data = await vaultFs.readBytes(rootPath, rel)
    entries.push({ path: rel, data })
  }
  options?.onProgress?.({ total: paths.length, done: paths.length })

  const zip = buildZipStore(entries)
  const suggested = defaultBackupFileName(name)
  const target = await save({
    title: '保存 Vault 备份（仅备份，非 Sync）',
    defaultPath: suggested,
    filters: [{ name: 'ZIP', extensions: ['zip'] }],
  })
  if (!target) return null

  const parent = await dirname(target)
  // Ensure parent exists when user picks a nested path (dialog usually does).
  try {
    await join(parent, '.')
  } catch {
    /* ignore */
  }
  await writeFile(target, zip)
  return { fileCount: entries.length, bytes: zip.length, savedPath: target }
}

/** Pure helper for tests: pack already-collected entries. */
export function packBackupEntries(entries: ZipEntry[]): Uint8Array {
  return buildZipStore(entries)
}
