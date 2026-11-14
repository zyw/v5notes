import type { VaultJson } from '../models/vault'
import { VAULT_JSON_SCHEMA_VERSION } from '../models/vault'

export const V5NOTES_DIR = '.v5notes'
export const VAULT_JSON_REL = `${V5NOTES_DIR}/vault.json`
export const SYNCIGNORE_REL = `${V5NOTES_DIR}/syncignore`
export const APPEARANCE_REL = `${V5NOTES_DIR}/appearance.json`
export const SYNC_STATE_REL = `${V5NOTES_DIR}/sync-state.json`
export const TRASH_DIR_REL = `${V5NOTES_DIR}/trash`
export const PLUGINS_DIR_REL = `${V5NOTES_DIR}/plugins`
export const THEMES_DIR_REL = `${V5NOTES_DIR}/themes`
export const COMMUNITY_PLUGINS_REL = `${PLUGINS_DIR_REL}/community-plugins.json`
export const COMMUNITY_THEMES_REL = `${THEMES_DIR_REL}/community-themes.json`
export const WELCOME_NOTE_REL = '欢迎.md'

export const DEFAULT_SYNCIGNORE = `# V5Notes Vault default syncignore (user content only; §6.4 hard table still wins)
.git/
.DS_Store
Thumbs.db
*~
.*.swp
`

export function newLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function buildVaultJson(name: string, localVaultId = newLocalId()): VaultJson {
  return {
    schemaVersion: VAULT_JSON_SCHEMA_VERSION,
    localVaultId,
    name,
    createdAt: new Date().toISOString(),
    binding: {
      server: null,
      cloudVaultId: null,
      deviceId: newLocalId(),
      lastCursor: null,
    },
  }
}

export function buildAppearanceJson(): { schemaVersion: 1; theme: string; colorMode: string } {
  return {
    schemaVersion: 1,
    theme: 'default',
    colorMode: 'system',
  }
}

export function buildEmptySyncState(): { schemaVersion: 1; files: Record<string, never> } {
  return { schemaVersion: 1, files: {} }
}

export function buildCommunityPluginsJson(): { schemaVersion: 1; plugins: unknown[] } {
  return { schemaVersion: 1, plugins: [] }
}

export function buildCommunityThemesJson(): { schemaVersion: 1; themes: unknown[] } {
  return { schemaVersion: 1, themes: [] }
}

export function buildWelcomeNoteMarkdown(vaultName: string): string {
  return `# 欢迎使用 ${vaultName}

这是你的本地 Vault。笔记正文就是库里的 \`.md\` 文件。

- 左侧树浏览目录与笔记
- 打开笔记后默认为预览；点「编辑」可改，再点「完成」回到预览
- 尚未登录、尚未同步——本阶段零网络

请勿把库放进网盘同步目录后再开官方 Sync。
`
}
