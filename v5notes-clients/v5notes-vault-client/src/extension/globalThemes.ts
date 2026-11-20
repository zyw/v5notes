import { parseManifestJson } from '../plugin-host/manifest'
import type { VaultThemePackage } from '../theme-host/ThemeHost'
import { FOREST_INK_CSS, FOREST_INK_MANIFEST } from '../theme-host/samples/forestInk'
import { WANQING_CSS, WANQING_MANIFEST } from '../theme-host/samples/wanqing'
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

/** Write one bundled sample package into the app theme folder. */
async function installSampleTheme(
  manifest: {
    id: string
    name: string
    version: string
    description?: string
    author?: string
    kind: string
    minAppVersion?: string
    permissions?: readonly string[]
    theme?: string
    themeMeta?: string
  },
  css: string,
  accent: string,
): Promise<void> {
  const store = getAppStore()
  const dir = await extensionPath([THEMES_DIR, manifest.id])
  await store.mkdir(dir)
  await store.writeText(dir + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n')
  await store.writeText(dir + '/theme.css', css.endsWith('\n') ? css : css + '\n')
  await store.writeText(
    dir + '/theme.json',
    JSON.stringify({ modes: ['light', 'dark'], accent }, null, 2) + '\n',
  )
}

/** Install the bundled sample themes into the app theme folder. */
export async function installGlobalSampleThemes(): Promise<void> {
  await installSampleTheme(FOREST_INK_MANIFEST, FOREST_INK_CSS, '#3d6b54')
  await installSampleTheme(WANQING_MANIFEST, WANQING_CSS, '#4a5a86')
}

/** @deprecated kept for callers that only install Forest Ink. */
export async function installGlobalForestInkSample(): Promise<void> {
  await installSampleTheme(FOREST_INK_MANIFEST, FOREST_INK_CSS, '#3d6b54')
}
