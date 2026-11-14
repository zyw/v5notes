import { invoke } from '@tauri-apps/api/core'
import { appDataDir, join } from '@tauri-apps/api/path'
import { open } from '@tauri-apps/plugin-dialog'
import { mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import type { VaultJson } from '../models/vault'
import { normalizeVaultName, VaultPathError } from '../path/identity'
import { listRecentVaults, rememberRecentVault, removeRecentVault } from './recent'
import {
  APPEARANCE_REL,
  buildAppearanceJson,
  buildCommunityPluginsJson,
  buildCommunityThemesJson,
  buildEmptySyncState,
  buildVaultJson,
  buildWelcomeNoteMarkdown,
  COMMUNITY_PLUGINS_REL,
  COMMUNITY_THEMES_REL,
  DEFAULT_SYNCIGNORE,
  PLUGINS_DIR_REL,
  SYNC_STATE_REL,
  SYNCIGNORE_REL,
  THEMES_DIR_REL,
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
  await mkdir(await join(rootPath, PLUGINS_DIR_REL), { recursive: true })
  await mkdir(await join(rootPath, THEMES_DIR_REL), { recursive: true })

  const config = buildVaultJson(vaultName)
  await writeJson(await join(rootPath, VAULT_JSON_REL), config)
  await writeTextFile(await join(rootPath, SYNCIGNORE_REL), DEFAULT_SYNCIGNORE)
  await writeJson(await join(rootPath, APPEARANCE_REL), buildAppearanceJson())
  await writeJson(await join(rootPath, SYNC_STATE_REL), buildEmptySyncState())
  await writeJson(await join(rootPath, COMMUNITY_PLUGINS_REL), buildCommunityPluginsJson())
  await writeJson(await join(rootPath, COMMUNITY_THEMES_REL), buildCommunityThemesJson())

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

async function scopeVaultRoot(rootPath: string): Promise<void> {
  try {
    await invoke('allow_vault_directory', { path: rootPath })
  } catch {
    // Dialog-picked folders are already scoped; invoke is for recent/default reopen.
  }
}

async function openExistingRoot(rootPath: string): Promise<OpenedVault> {
  try {
    await scopeVaultRoot(rootPath)
  } catch (error) {
    throw new VaultPathError(
      `无法授权访问该目录（可能已移盘或权限失效）: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  const rootOk = await vaultFs.exists(rootPath)
  if (!rootOk) {
    throw new VaultPathError('库路径不存在或不可访问（可能已移动）')
  }
  const hasMeta = await vaultFs.exists(rootPath, VAULT_JSON_REL)
  if (!hasMeta) {
    throw new VaultPathError('所选文件夹不是 Vault（缺少 .v5notes/vault.json）')
  }
  const config = await readVaultConfig(rootPath)
  const opened: OpenedVault = {
    rootPath,
    name: config.name || (await vaultRootName(rootPath)),
    config,
  }
  rememberRecentVault({ rootPath: opened.rootPath, name: opened.name })
  return opened
}

export interface VaultWorkspace {
  pickAndCreateVault(name: string): Promise<OpenedVault | null>
  pickAndOpenVault(): Promise<OpenedVault | null>
  openDefaultVault(): Promise<OpenedVault>
  openRecent(rootPath: string): Promise<OpenedVault>
  listRecent(): RecentVaultEntry[]
  forgetRecent(rootPath: string): void
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

    const rootPath = await join(parent, name)
    if (await vaultFs.exists(rootPath)) {
      throw new VaultPathError(`目标已存在: ${rootPath}`)
    }
    await mkdir(rootPath, { recursive: true })
    await scopeVaultRoot(rootPath)
    const config = await ensureSkeleton(rootPath, name)
    const opened: OpenedVault = { rootPath, name: config.name, config }
    rememberRecentVault({ rootPath, name: opened.name })
    return opened
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
    await scopeVaultRoot(rootPath)
    const hasMeta = await vaultFs.exists(rootPath, VAULT_JSON_REL)
    const config = hasMeta
      ? await readVaultConfig(rootPath)
      : await ensureSkeleton(rootPath, '默认库')
    const opened: OpenedVault = { rootPath, name: config.name, config }
    rememberRecentVault({ rootPath, name: opened.name })
    return opened
  },

  async openRecent(rootPath: string) {
    return openExistingRoot(rootPath)
  },

  listRecent() {
    return listRecentVaults()
  },

  forgetRecent(rootPath: string) {
    removeRecentVault(rootPath)
  },
}
