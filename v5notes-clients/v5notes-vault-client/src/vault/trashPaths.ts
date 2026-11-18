/**
 * Pure trash path helpers (no Tauri) — safe for unit tests.
 * Local trash is never synced (§6.4).
 */

import { normalizeVaultPath } from '../path/identity'
import { TRASH_DIR_REL, V5NOTES_DIR } from './skeleton'

export function stampFolder(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-').replace(/Z$/, 'Z')
}

/** Build trash relative path: `.v5notes/trash/<stamp>/<originalPath>`. */
export function buildTrashRel(originalPath: string, deletedAt = new Date()): string {
  const { displayPath } = normalizeVaultPath(originalPath)
  return `${TRASH_DIR_REL}/${stampFolder(deletedAt)}/${displayPath}`
}

/** True when path is under `.v5notes/` (metadata / trash — not user note tree). */
export function isMetaOrTrashPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  return normalized === V5NOTES_DIR || normalized.startsWith(`${V5NOTES_DIR}/`)
}

export function isUnderTrash(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  return normalized === TRASH_DIR_REL || normalized.startsWith(`${TRASH_DIR_REL}/`)
}
