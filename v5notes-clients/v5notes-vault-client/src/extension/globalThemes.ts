import { parseManifestJson } from '../plugin-host/manifest'
import type { VaultThemePackage } from '../theme-host/ThemeHost'
import { FOREST_INK_CSS, FOREST_INK_MANIFEST } from '../theme-host/samples/forestInk'
import { extensionPath, getAppStore } from './appStorage'

const THEMES_DIR = 'themes'

/** Installed themes, shared by every vault. */
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

/** Install the bundled Forest Ink sample into the app theme folder. */
export async function installGlobalForestInkSample(): Promise<void> {
  const store = getAppStore()
  const dir = await extensionPath([THEMES_DIR, FOREST_INK_MANIFEST.id])
  await store.mkdir(dir)
  await store.writeText(dir + '/manifest.json', JSON.stringify(FOREST_INK_MANIFEST, null, 2) + '\n')
  await store.writeText(
    dir + '/theme.css',
    FOREST_INK_CSS.endsWith('\n') ? FOREST_INK_CSS : FOREST_INK_CSS + '\n',
  )
  await store.writeText(
    dir + '/theme.json',
    JSON.stringify({ modes: ['light', 'dark'], accent: '#3d6b54' }, null, 2) + '\n',
  )
}
