import type { RecentVaultEntry } from './types'

const STORAGE_KEY = 'v5notes.vault.recent.v1'
const MAX_RECENT = 8

function readRaw(): RecentVaultEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentVaultEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRaw(entries: RecentVaultEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_RECENT)))
  } catch {
    /* ignore quota / private mode */
  }
}

/** Phase 1 stub: recent list in localStorage. Phase 2 may move to durable app store + bookmarks. */
export function listRecentVaults(): RecentVaultEntry[] {
  return readRaw()
}

export function rememberRecentVault(entry: Omit<RecentVaultEntry, 'openedAt'> & { openedAt?: string }): void {
  const next: RecentVaultEntry = {
    rootPath: entry.rootPath,
    name: entry.name,
    openedAt: entry.openedAt ?? new Date().toISOString(),
  }
  const rest = readRaw().filter(item => item.rootPath !== next.rootPath)
  writeRaw([next, ...rest])
}

export function removeRecentVault(rootPath: string): void {
  writeRaw(readRaw().filter(item => item.rootPath !== rootPath))
}
