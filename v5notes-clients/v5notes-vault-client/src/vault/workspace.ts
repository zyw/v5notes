import { invoke } from '@tauri-apps/api/core'
import { appDataDir, join } from '@tauri-apps/api/path'
import { open } from '@tauri-apps/plugin-dialog'
import { readDir, stat } from '@tauri-apps/plugin-fs'
import { mkdir, readTextFile, remove, writeTextFile } from '@tauri-apps/plugin-fs'
import type { VaultJson } from '../models/vault'
import { DOC_KINDS, docKindOfPathIn, type DocKindSpec } from './docKinds'
import { normalizeVaultName, resolveCreateVaultRoot, VaultPathError } from '../path/identity'
import {
  listRecentVaults,
  rememberRecentVault,
  removeRecentVault,
  registerVault,
  renameVaultInRegistry,
} from './recent'
import {
  APPEARANCE_REL,
  buildAppearanceJson,
  buildEmptySyncState,
  buildVaultJson,
  buildWelcomeNoteMarkdown,
  DEFAULT_SYNCIGNORE,
  SYNC_STATE_REL,
  SYNCIGNORE_REL,
  TRASH_DIR_REL,
  V5NOTES_DIR,
  VAULT_JSON_REL,
  WELCOME_NOTE_REL,
} from './skeleton'
import type { OpenedVault, RecentVaultEntry } from './types'
import { vaultFs, vaultRootName } from './vaultFs'

async function writeJson(absPath: string, value: unknown): Promise<void> {
  await writeTextFile(absPath, `${JSON.stringify(value, null, 2)}\n`)
}

async function ensureSkeleton(rootPath: string, vaultName: string, options?: { welcomeNote?: boolean }): Promise<VaultJson> {
  const v5 = await join(rootPath, V5NOTES_DIR)
  await mkdir(v5, { recursive: true })
  await mkdir(await join(rootPath, TRASH_DIR_REL), { recursive: true })

  const config = buildVaultJson(vaultName)
  await writeJson(await join(rootPath, VAULT_JSON_REL), config)
  await writeTextFile(await join(rootPath, SYNCIGNORE_REL), DEFAULT_SYNCIGNORE)
  await writeJson(await join(rootPath, APPEARANCE_REL), buildAppearanceJson())
  await writeJson(await join(rootPath, SYNC_STATE_REL), buildEmptySyncState())

  if (options?.welcomeNote !== false) {
    await vaultFs.writeText(rootPath, WELCOME_NOTE_REL, buildWelcomeNoteMarkdown(vaultName))
  }
  return config
}

async function readVaultConfig(rootPath: string): Promise<VaultJson> {
  const raw = await readTextFile(await join(rootPath, VAULT_JSON_REL))
  const parsed = JSON.parse(raw) as VaultJson
  if (!parsed?.localVaultId || !parsed?.name) {
    throw new VaultPathError('vault.json 无效或不完整')
  }
  return parsed
}

async function scopeVaultRoot(
  rootPath: string,
  options?: { required?: boolean; errorPrefix?: string },
): Promise<void> {
  try {
    await invoke('allow_vault_directory', { path: rootPath })
  } catch (error) {
    if (options?.required) {
      const prefix = options.errorPrefix ?? '无法授权访问该目录'
      throw new VaultPathError(
        `${prefix}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    // Dialog-picked folders are already scoped; soft invoke is for recent/default reopen.
  }
}

async function openExistingRoot(rootPath: string): Promise<OpenedVault> {
  const opened = await readVaultForSettings(rootPath)
  rememberRecentVault({ rootPath: opened.rootPath, name: opened.name })
  // Durable registry: every open refreshes the record and clears "hidden".
  registerVault(
    { rootPath: opened.rootPath, name: opened.name, createdAt: opened.config.createdAt },
    'opened',
  )
  return opened
}

/**
 * Read a vault's settings without treating it as "worked on": the settings page
 * uses this to show another vault's page. Recency and registry order are left
 * untouched, so the list does not reshuffle every time someone looks at it.
 */
async function readVaultForSettings(rootPath: string): Promise<OpenedVault> {
  await scopeVaultRoot(rootPath, {
    required: true,
    errorPrefix: '无法授权访问该目录（可能已移盘或权限失效）',
  })
  if (!(await vaultFs.exists(rootPath))) {
    throw new VaultPathError('库路径不存在或不可访问（可能已移动）')
  }
  if (!(await vaultFs.exists(rootPath, VAULT_JSON_REL))) {
    throw new VaultPathError('所选文件夹不是 Vault（缺少 .v5notes/vault.json）')
  }
  const config = await readVaultConfig(rootPath)
  return {
    rootPath,
    name: config.name || (await vaultRootName(rootPath)),
    config,
  }
}

/** Verify a registry entry's folder still holds a readable vault.json. */
export interface VaultProbeResult {
  ok: boolean
  name?: string
}


const NOTE_MTIME_SKIP = new Set(['.git', 'node_modules'])
const NOTE_MTIME_MAX_DEPTH = 6
const NOTE_MTIME_MAX_FILES = 400

/**
 * When did this vault's notes last change? Walks note files (newest first per
 * directory) instead of the whole tree, so the settings list can order vaults
 * by real activity without a heavy scan of large folders.
 */
async function newestNoteMtime(
  rootPath: string,
  kinds: readonly DocKindSpec[] = DOC_KINDS,
): Promise<number | null> {
  let newest: number | null = null
  let visited = 0

  async function walk(dirAbs: string, depth: number): Promise<void> {
    if (depth > NOTE_MTIME_MAX_DEPTH || visited >= NOTE_MTIME_MAX_FILES) return
    let entries: Awaited<ReturnType<typeof readDir>>
    try {
      entries = await readDir(dirAbs)
    } catch {
      return
    }
    const candidates: { name: string; isDirectory: boolean; abs: string }[] = []
    for (const entry of entries) {
      if (!entry.name || NOTE_MTIME_SKIP.has(entry.name)) continue
      if (depth === 0 && entry.name === V5NOTES_DIR) continue
      if (entry.isSymlink) continue
      candidates.push({ name: entry.name, isDirectory: entry.isDirectory, abs: `${dirAbs}/${entry.name}` })
    }
    for (const item of candidates) {
      if (visited >= NOTE_MTIME_MAX_FILES) return
      if (item.isDirectory) {
        await walk(item.abs, depth + 1)
        continue
      }
      if (!docKindOfPathIn(kinds, item.name)) continue
      visited += 1
      try {
        const info = await stat(item.abs)
        const mtime = info.mtime ? new Date(info.mtime).getTime() : Number.NaN
        if (Number.isFinite(mtime) && (newest === null || mtime > newest)) newest = mtime
      } catch {
        /* unreadable file: skip */
      }
    }
  }

  await scopeVaultRoot(rootPath)
  if (!(await vaultFs.exists(rootPath))) return null
  await walk(rootPath, 0)
  return newest
}

async function probeVaultRoot(rootPath: string): Promise<VaultProbeResult> {
  try {
    await scopeVaultRoot(rootPath)
    if (!(await vaultFs.exists(rootPath)) || !(await vaultFs.exists(rootPath, VAULT_JSON_REL))) {
      return { ok: false }
    }
    const config = await readVaultConfig(rootPath)
    return { ok: true, name: config.name }
  } catch {
    return { ok: false }
  }
}

export interface VaultWorkspace {
  pickAndCreateVault(name: string): Promise<OpenedVault | null>
  pickAndOpenVault(): Promise<OpenedVault | null>
  openDefaultVault(): Promise<OpenedVault>
  openRecent(rootPath: string): Promise<OpenedVault>
  /** Open a vault's settings page without touching recency or registry order. */
  openForSettings(rootPath: string): Promise<OpenedVault>
  /** Newest note change time (epoch ms), or null when the folder is gone. */
  /** `kinds` adds plugin-declared kinds to the activity scan. */
  lastNoteChange(rootPath: string, kinds?: readonly DocKindSpec[]): Promise<number | null>
  listRecent(): RecentVaultEntry[]
  forgetRecent(rootPath: string): void
  /** Check whether a registered root still holds a valid vault on disk. */
  probeVaultRoot(rootPath: string): Promise<VaultProbeResult>
  /** Add a scanner-found vault to the registry without opening it. */
  registerScannedVault(scanned: { rootPath: string; name: string; createdAt?: string }): Promise<void>
  /** Keep the registry name in sync after an in-app rename. */
  renameRegisteredVault(rootPath: string, name: string): void
}

export const vaultWorkspace: VaultWorkspace = {
  async pickAndCreateVault(rawName: string) {
    const name = normalizeVaultName(rawName)
    const parent = await open({
      directory: true,
      multiple: false,
      recursive: true,
      title: '选择新库的父目录',
    })
    if (!parent || Array.isArray(parent)) return null

    // Dialog already granted recursive scope on `parent`; reinforce before mkdir so
    // vault folder + `.v5notes` are covered even when glob skips leading-dot names.
    await scopeVaultRoot(parent, { required: true })

    const rootPath = resolveCreateVaultRoot(parent, name)
    if (await vaultFs.exists(rootPath, VAULT_JSON_REL)) {
      throw new VaultPathError(`目标已存在 Vault: ${rootPath}`)
    }

    // Reuse an empty/partial folder left by a previous failed create (no vault.json yet).
    const rootExisted = await vaultFs.exists(rootPath)
    let createdRoot = false
    try {
      if (!rootExisted) {
        await mkdir(rootPath, { recursive: true })
        createdRoot = true
      }
      await scopeVaultRoot(rootPath, { required: true })
      const config = await ensureSkeleton(rootPath, name)
      const opened: OpenedVault = { rootPath, name: config.name, config }
      rememberRecentVault({ rootPath, name: opened.name })
      registerVault({ rootPath, name: opened.name, createdAt: config.createdAt }, 'created')
      return opened
    } catch (error) {
      if (createdRoot) {
        try {
          await remove(rootPath, { recursive: true })
        } catch {
          // Best-effort cleanup of the empty partial vault folder.
        }
      }
      throw error
    }
  },

  async pickAndOpenVault() {
    const selected = await open({
      directory: true,
      multiple: false,
      recursive: true,
      title: '打开已有 Vault 文件夹',
    })
    if (!selected || Array.isArray(selected)) return null
    return openExistingRoot(selected)
  },

  async openDefaultVault() {
    const base = await appDataDir()
    const rootPath = await join(base, 'default-vault')
    await mkdir(rootPath, { recursive: true })
    await scopeVaultRoot(rootPath, { required: true })
    const hasMeta = await vaultFs.exists(rootPath, VAULT_JSON_REL)
    const config = hasMeta
      ? await readVaultConfig(rootPath)
      : await ensureSkeleton(rootPath, '默认库')
    const opened: OpenedVault = { rootPath, name: config.name, config }
    rememberRecentVault({ rootPath, name: opened.name })
    registerVault({ rootPath, name: opened.name, createdAt: config.createdAt }, 'opened')
    return opened
  },

  async openRecent(rootPath: string) {
    return openExistingRoot(rootPath)
  },

  async openForSettings(rootPath: string) {
    return readVaultForSettings(rootPath)
  },

  lastNoteChange(rootPath: string, kinds: readonly DocKindSpec[] = DOC_KINDS) {
    return newestNoteMtime(rootPath, kinds)
  },

  listRecent() {
    return listRecentVaults()
  },

  forgetRecent(rootPath: string) {
    removeRecentVault(rootPath)
  },

  probeVaultRoot,

  /** Register a folder the scanner confirmed as a vault (no UI flow of its own). */
  async registerScannedVault(scanned: { rootPath: string; name: string; createdAt?: string }) {
    await scopeVaultRoot(scanned.rootPath)
    registerVault(
      { rootPath: scanned.rootPath, name: scanned.name, createdAt: scanned.createdAt },
      'scanned',
    )
  },

  renameRegisteredVault(rootPath: string, name: string) {
    renameVaultInRegistry(rootPath, normalizeVaultName(name))
  },
}
