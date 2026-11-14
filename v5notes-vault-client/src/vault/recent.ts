/**
 * Recent vaults — durable app-config JSON when Tauri is available, localStorage mirror always.
 */

import { isTauri } from '@tauri-apps/api/core'
import { appConfigDir, join } from '@tauri-apps/api/path'
import { exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import type { RecentVaultEntry } from './types'

const STORAGE_KEY = 'v5notes.vault.recent.v1'
const CONFIG_FILE = 'recent-vaults.json'
const MAX_RECENT = 8

let memoryCache: RecentVaultEntry[] | null = null
let diskHydrated = false

function normalizeList(parsed: unknown): RecentVaultEntry[] {
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter(
      (item): item is RecentVaultEntry =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as RecentVaultEntry).rootPath === 'string' &&
        typeof (item as RecentVaultEntry).name === 'string',
    )
    .map(item => ({
      rootPath: item.rootPath,
      name: item.name,
      openedAt: typeof item.openedAt === 'string' ? item.openedAt : new Date().toISOString(),
    }))
    .slice(0, MAX_RECENT)
}

function readLocalStorage(): RecentVaultEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return normalizeList(JSON.parse(raw))
  } catch {
    return []
  }
}

function writeLocalStorage(entries: RecentVaultEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_RECENT)))
  } catch {
    /* ignore quota / private mode */
  }
}

async function configPath(): Promise<string> {
  const dir = await appConfigDir()
  await mkdir(dir, { recursive: true })
  return join(dir, CONFIG_FILE)
}

async function readDisk(): Promise<RecentVaultEntry[]> {
  if (!isTauri()) return []
  try {
    const path = await configPath()
    if (!(await exists(path))) return []
    const raw = await readTextFile(path)
    return normalizeList(JSON.parse(raw))
  } catch {
    return []
  }
}

async function writeDisk(entries: RecentVaultEntry[]): Promise<void> {
  if (!isTauri()) return
  try {
    const path = await configPath()
    await writeTextFile(path, `${JSON.stringify(entries.slice(0, MAX_RECENT), null, 2)}\n`)
  } catch {
    /* disk unavailable — localStorage still holds mirror */
  }
}

function syncCache(entries: RecentVaultEntry[]): RecentVaultEntry[] {
  memoryCache = entries.slice(0, MAX_RECENT)
  writeLocalStorage(memoryCache)
  void writeDisk(memoryCache)
  return memoryCache
}

/** Hydrate from durable store once (call from welcome mount). */
export async function hydrateRecentVaults(): Promise<RecentVaultEntry[]> {
  if (diskHydrated && memoryCache) return memoryCache
  const disk = await readDisk()
  const local = readLocalStorage()
  // Prefer whichever has the newest openedAt top entry; merge by rootPath.
  const map = new Map<string, RecentVaultEntry>()
  for (const entry of [...local, ...disk]) {
    const prev = map.get(entry.rootPath)
    if (!prev || prev.openedAt < entry.openedAt) map.set(entry.rootPath, entry)
  }
  const merged = [...map.values()].sort((a, b) => b.openedAt.localeCompare(a.openedAt))
  diskHydrated = true
  return syncCache(merged)
}

export function listRecentVaults(): RecentVaultEntry[] {
  if (memoryCache) return memoryCache
  memoryCache = readLocalStorage()
  return memoryCache
}

export function rememberRecentVault(entry: Omit<RecentVaultEntry, 'openedAt'> & { openedAt?: string }): void {
  const next: RecentVaultEntry = {
    rootPath: entry.rootPath,
    name: entry.name,
    openedAt: entry.openedAt ?? new Date().toISOString(),
  }
  const rest = listRecentVaults().filter(item => item.rootPath !== next.rootPath)
  syncCache([next, ...rest])
}

export function removeRecentVault(rootPath: string): void {
  syncCache(listRecentVaults().filter(item => item.rootPath !== rootPath))
}
