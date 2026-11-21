import { parseManifestJson } from '../plugin-host/manifest'
import type { VaultThemePackage } from '../theme-host/ThemeHost'
import { validateThemeCss } from '../theme-host/cssValidate'
import { FOREST_INK_CSS, FOREST_INK_MANIFEST } from '../theme-host/samples/forestInk'
import { WANQING_CSS, WANQING_MANIFEST } from '../theme-host/samples/wanqing'
import { bundledCatalogList, bundledCatalogPackage } from '../catalog/bundled'
import { extensionPath, getAppStore } from './appStorage'

const THEMES_DIR = 'themes'
const BUNDLED_THEME_IDS = new Set(bundledCatalogList('theme').items.map((item) => item.id))

/**
 * 官方 catalog 主题的旧安装副本可能仍带着不合规的 CSS（例如裸 :root），
 * 点选时会被 ThemeHost 拒绝并回退内置。升级后用随应用发布的种子覆盖它，
 * 让已安装副本自愈；只替换校验失败的官方主题，用户自己写的主题不动。
 */
async function repairBundledThemeCss(
  store: ReturnType<typeof getAppStore>,
  id: string,
  file: string,
  css: string,
): Promise<string> {
  if (!BUNDLED_THEME_IDS.has(id) || validateThemeCss(css).ok) return css
  const seed = bundledCatalogPackage(id).files['theme.css']
  if (!seed || !validateThemeCss(seed).ok) return css
  await store.writeText(file, seed.endsWith('\n') ? seed : seed + '\n')
  return seed
}

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
      const cssFile = dir + '/' + (manifest.theme || 'theme.css')
      const rawCss = await store.readText(cssFile)
      if (rawCss === null) continue
      const css = await repairBundledThemeCss(store, manifest.id, cssFile, rawCss)
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
