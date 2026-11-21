import { parseManifestJson } from '../plugin-host/manifest'
import type { VaultThemePackage } from '../theme-host/ThemeHost'
import { extensionPath, getAppStore } from './appStorage'

const THEMES_DIR = 'themes'

/**
 * Installed themes, shared by every vault.
 *
 * Only what is actually on disk counts: a theme is "installed" because the user
 * installed it from the catalog or imported it. Nothing is seeded or rewritten
 * here, so uninstalling really leaves the theme uninstalled.
 */
export async function listGlobalThemes(): Promise<VaultThemePackage[]> {
  const store = getAppStore()
  const root = await extensionPath([THEMES_DIR])
  const entries = await store.readDir(root)
  const out: VaultThemePackage[] = []
  for (const entry of entries) {
    if (!entry.isDirectory || entry.name.startsWith('.')) continue
    try {
      const dir = await extensionPath([THEMES_DIR, entry.name])
      const manifestRaw = await store.readText(dir + '/manifest.json')
      if (!manifestRaw) continue
      const manifest = parseManifestJson(manifestRaw)
      if (manifest.kind !== 'theme') continue
      if (manifest.id !== entry.name) continue
      const css = await store.readText(dir + '/' + (manifest.theme || 'theme.css'))
      if (css === null) continue
      out.push({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        css,
      })
    } catch {
      /* skip broken packages */
    }
  }
  return out
}

/** Remove one installed theme folder; built-in themes have no folder here. */
export async function removeGlobalTheme(id: string): Promise<void> {
  const store = getAppStore()
  const dir = await extensionPath([THEMES_DIR, id])
  const manifest = await store.readText(dir + '/manifest.json')
  if (manifest === null) {
    throw new Error('主题目录不存在: ' + id)
  }
  await store.remove(dir)
}
