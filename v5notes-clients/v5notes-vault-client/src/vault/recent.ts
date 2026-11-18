/**
 * Recent vaults — durable app-config JSON when Tauri is available, localStorage mirror always.
 */

import { isTauri } from '@tauri-apps/api/core'
import { appConfigDir, join } from '@tauri-apps/api/path'
import { exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import type { RecentVaultEntry, VaultRegistryEntry, VaultRegistrySource } from './types'

const STORAGE_KEY = 'v5notes.vault.recent.v1'
const REGISTRY_STORAGE_KEY = 'v5notes.vault.registry.v1'
const CONFIG_FILE = 'recent-vaults.json'
const REGISTRY_CONFIG_FILE = 'vault-registry.json'
const MAX_RECENT = 8
const MAX_REGISTRY = 64

let memoryCache: RecentVaultEntry[] | null = null
let diskHydrated = false
let registryCache: VaultRegistryEntry[] | null = null
let registryHydrated = false

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

async function configPath(file: string): Promise<string> {
  const dir = await appConfigDir()
  await mkdir(dir, { recursive: true })
  return join(dir, file)
}

async function readDisk(): Promise<RecentVaultEntry[]> {
  if (!isTauri()) return []
  try {
    const path = await configPath(CONFIG_FILE)
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
    const path = await configPath(CONFIG_FILE)
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

/* ------------------------------------------------------------------ */
/* Vault registry — durable "all vaults ever created/opened" record.   */
/* Hiding a chip from the welcome row never deletes registry entries.  */
/* ------------------------------------------------------------------ */

function normalizeRegistry(parsed: unknown): VaultRegistryEntry[] {
  if (!Array.isArray(parsed)) return []
  const now = new Date().toISOString()
  return parsed
    .filter(
      (item): item is VaultRegistryEntry =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as VaultRegistryEntry).rootPath === 'string' &&
        typeof (item as VaultRegistryEntry).name === 'string',
    )
    .map(item => {
      const source: VaultRegistrySource['kind'] =
        item.source === 'created' || item.source === 'scanned' ? item.source : 'opened'
      return {
        rootPath: item.rootPath,
        name: item.name,
        openedAt: typeof item.openedAt === 'string' ? item.openedAt : now,
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : now,
        source,
        hidden: item.hidden === true,
      }
    })
    .slice(0, MAX_REGISTRY)
}

function readRegistryLocalStorage(): VaultRegistryEntry[] {
  try {
    const raw = localStorage.getItem(REGISTRY_STORAGE_KEY)
    if (!raw) return []
    return normalizeRegistry(JSON.parse(raw))
  } catch {
    return []
  }
}

function writeRegistryLocalStorage(entries: VaultRegistryEntry[]): void {
  try {
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_REGISTRY)))
  } catch {
    /* ignore quota / private mode */
  }
}

async function readRegistryDisk(): Promise<VaultRegistryEntry[]> {
  if (!isTauri()) return []
  try {
    const path = await configPath(REGISTRY_CONFIG_FILE)
    if (!(await exists(path))) return []
    const raw = await readTextFile(path)
    return normalizeRegistry(JSON.parse(raw))
  } catch {
    return []
  }
}

async function writeRegistryDisk(entries: VaultRegistryEntry[]): Promise<void> {
  if (!isTauri()) return
  try {
    const path = await configPath(REGISTRY_CONFIG_FILE)
    await writeTextFile(path, `${JSON.stringify(entries.slice(0, MAX_REGISTRY), null, 2)}\n`)
  } catch {
    /* disk unavailable — localStorage still holds mirror */
  }
}

function syncRegistryCache(entries: VaultRegistryEntry[]): VaultRegistryEntry[] {
  registryCache = entries.slice(0, MAX_REGISTRY)
  writeRegistryLocalStorage(registryCache)
  void writeRegistryDisk(registryCache)
  return registryCache
}

/** Hydrate the registry once (call alongside hydrateRecentVaults on welcome mount). */
export async function hydrateVaultRegistry(): Promise<VaultRegistryEntry[]> {
  if (registryHydrated && registryCache) return registryCache
  const [disk, local] = await Promise.all([readRegistryDisk(), Promise.resolve(readRegistryLocalStorage())])
  // Merge by rootPath; the newer openedAt wins, creation facts are sticky.
  const map = new Map<string, VaultRegistryEntry>()
  for (const entry of [...local, ...disk]) {
    const prev = map.get(entry.rootPath)
    if (!prev) map.set(entry.rootPath, entry)
    else {
      map.set(entry.rootPath, {
        ...entry,
        createdAt: prev.createdAt < entry.createdAt ? prev.createdAt : entry.createdAt,
        source: prev.source === 'created' || entry.source === 'created' ? 'created' : entry.source,
        hidden: prev.hidden && entry.hidden,
        openedAt: prev.openedAt > entry.openedAt ? prev.openedAt : entry.openedAt,
      })
    }
  }
  const merged = [...map.values()].sort((a, b) => b.openedAt.localeCompare(a.openedAt))
  registryHydrated = true
  return syncRegistryCache(merged)
}

export function listVaultRegistry(): VaultRegistryEntry[] {
  if (registryCache) return registryCache
  registryCache = readRegistryLocalStorage()
  return registryCache
}

/**
 * Record that this app created or opened a vault. Idempotent per rootPath:
 * an existing entry keeps its createdAt/source unless `source` upgrades to
 * 'created'; opening always clears the hidden flag (the vault is active again).
 */
export function registerVault(
  entry: { rootPath: string; name: string; createdAt?: string },
  source: VaultRegistrySource['kind'],
): void {
  const now = new Date().toISOString()
  const keepHidden = source === 'scanned'
  const existing = listVaultRegistry().find(item => item.rootPath === entry.rootPath)
  const next: VaultRegistryEntry = existing
    ? {
        ...existing,
        name: entry.name,
        openedAt: now,
        hidden: keepHidden ? existing.hidden : false,
        source: source === 'created' ? 'created' : existing.source === 'created' ? 'created' : source,
      }
    : {
        rootPath: entry.rootPath,
        name: entry.name,
        openedAt: now,
        createdAt: entry.createdAt ?? now,
        source,
        hidden: false,
      }
  const rest = listVaultRegistry().filter(item => item.rootPath !== entry.rootPath)
  syncRegistryCache([next, ...rest])
}

export function setVaultHidden(rootPath: string, hidden: boolean): void {
  syncRegistryCache(
    listVaultRegistry().map(item => (item.rootPath === rootPath ? { ...item, hidden } : item)),
  )
}

/** Permanently forget the registry record (only from the 所有库 panel). */
export function unregisterVault(rootPath: string): void {
  syncRegistryCache(listVaultRegistry().filter(item => item.rootPath !== rootPath))
}

export function renameVaultInRegistry(rootPath: string, name: string): void {
  syncRegistryCache(
    listVaultRegistry().map(item => (item.rootPath === rootPath ? { ...item, name } : item)),
  )
}
