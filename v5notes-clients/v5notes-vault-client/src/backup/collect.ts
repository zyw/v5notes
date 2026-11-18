import { SYNC_STATE_REL, TRASH_DIR_REL, V5NOTES_DIR } from '../vault/skeleton'

/** Relative paths under the vault root that must never enter a backup zip. */
export function isExcludedFromBackup(relativePath: string): boolean {
  const path = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!path) return true
  if (path === TRASH_DIR_REL || path.startsWith(`${TRASH_DIR_REL}/`)) return true
  if (path === SYNC_STATE_REL || path.startsWith(`${SYNC_STATE_REL}.`)) return true
  if (path === `${V5NOTES_DIR}/index.sqlite` || path.startsWith(`${V5NOTES_DIR}/index.sqlite`)) return true
  if (path === `${V5NOTES_DIR}/.tmp` || path.startsWith(`${V5NOTES_DIR}/.tmp/`)) return true
  if (path.endsWith('.tmp') || /\.tmp-[^/]+$/.test(path)) return true
  if (path === '.DS_Store' || path.endsWith('/.DS_Store')) return true
  if (path === 'Thumbs.db' || path.endsWith('/Thumbs.db')) return true
  return false
}

/** Flatten a recursive dir listing into relative file paths (dirs omitted). */
export function flattenFilePaths(
  nodes: Array<{ path: string; kind: string; children?: unknown[] }>,
  out: string[] = [],
): string[] {
  for (const node of nodes) {
    if (node.kind === 'dir' && Array.isArray(node.children)) {
      flattenFilePaths(node.children as typeof nodes, out)
      continue
    }
    if (node.kind === 'dir') continue
    if (!isExcludedFromBackup(node.path)) out.push(node.path)
  }
  return out
}

/**
 * Extra metadata files to try including even when the note tree skips `.v5notes`.
 * Missing files are ignored by the backup runner.
 */
export const BACKUP_META_CANDIDATES = [
  `${V5NOTES_DIR}/vault.json`,
  `${V5NOTES_DIR}/syncignore`,
  `${V5NOTES_DIR}/appearance.json`,
  `${V5NOTES_DIR}/plugins/community-plugins.json`,
  `${V5NOTES_DIR}/themes/community-themes.json`,
] as const
