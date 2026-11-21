import { parseManifestJson } from '../plugin-host/manifest'
import type { VaultThemePackage } from '../theme-host/ThemeHost'
import { validateThemeCss } from '../theme-host/cssValidate'
import { BUNDLED_THEMES, type BundledTheme } from '../theme-host/samples/bundled'
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

/**
 * 随应用内置的主题不再需要装进应用目录：ThemeHost 直接按包注入。
 * 旧版本留下的同名目录反而会让同一主题在「已安装」里多出一条，删掉它们。
 */
async function removeLegacyInstalledCopies(): Promise<void> {
  const store = getAppStore()
  for (const theme of BUNDLED_THEMES) {
    const dir = await extensionPath([THEMES_DIR, theme.id])
    if ((await store.readText(dir + '/manifest.json')) !== null) await store.remove(dir)
  }
}

/** Write one bundled theme package into the app theme folder. */
async function installBundledTheme(theme: BundledTheme): Promise<void> {
  const store = getAppStore()
  const dir = await extensionPath([THEMES_DIR, theme.id])
  await store.mkdir(dir)
  await store.writeText(dir + '/manifest.json', JSON.stringify(theme.manifest, null, 2) + '\n')
  await store.writeText(dir + '/theme.css', theme.css.endsWith('\n') ? theme.css : theme.css + '\n')
  await store.writeText(dir + '/theme.json', JSON.stringify(theme.meta, null, 2) + '\n')
}

/** Install the bundled themes into the app theme folder. */
export async function installGlobalSampleThemes(): Promise<void> {
  await removeLegacyInstalledCopies()
  for (const theme of BUNDLED_THEMES) await installBundledTheme(theme)
}

/** @deprecated kept for callers that only install Forest Ink. */
export async function installGlobalForestInkSample(): Promise<void> {
  const forestInk = BUNDLED_THEMES.find((theme) => theme.id === 'forest-ink')
  if (forestInk) await installBundledTheme(forestInk)
}
