/**
 * Debounced recursive vault watcher (Phase 2).
 * Ignores `.v5notes` noise where practical and local write guards from vaultFs.
 */

import { watch, type UnwatchFn, type WatchEvent } from '@tauri-apps/plugin-fs'
import { V5NOTES_DIR } from './skeleton'
import { isLocalWrite } from './vaultFs'

export type VaultChangeHandler = (info: {
  paths: string[]
  raw: WatchEvent
}) => void

function pathsFromEvent(event: WatchEvent): string[] {
  const paths = (event.paths ?? []).map(p => String(p))
  return paths
}

function shouldIgnoreAbs(rootPath: string, absPath: string): boolean {
  const unified = absPath.replace(/\\/g, '/')
  const root = rootPath.replace(/\\/g, '/').replace(/\/+$/, '')
  if (!unified.startsWith(root)) return false
  const rel = unified.slice(root.length).replace(/^\/+/, '')
  if (!rel) return false
  // Ignore metadata / trash / temp churn (user tree still refreshes on other changes).
  if (rel === V5NOTES_DIR || rel.startsWith(`${V5NOTES_DIR}/`)) return true
  if (rel.endsWith('.tmp') || /\.tmp-[^/]+$/.test(rel)) return true
  if (isLocalWrite(rootPath, rel) || isLocalWrite(rootPath, '.')) return true
  return false
}

/**
 * Start watching a vault root. Returns an unwatch function.
 * `delayMs` defaults to 400ms for snappy tree refresh without hammering listTree.
 */
export async function watchVaultRoot(
  rootPath: string,
  onChange: VaultChangeHandler,
  options?: { delayMs?: number },
): Promise<UnwatchFn> {
  return watch(
    rootPath,
    event => {
      const paths = pathsFromEvent(event).filter(p => !shouldIgnoreAbs(rootPath, p))
      if (paths.length === 0 && pathsFromEvent(event).every(p => shouldIgnoreAbs(rootPath, p))) {
        return
      }
      // Even if all paths filtered, some platforms omit paths — still notify for safety
      // when at least one non-ignored path exists OR event has empty paths.
      const rawPaths = pathsFromEvent(event)
      if (rawPaths.length > 0 && paths.length === 0) return
      onChange({ paths: paths.length ? paths : rawPaths, raw: event })
    },
    {
      recursive: true,
      delayMs: options?.delayMs ?? 400,
    },
  )
}
