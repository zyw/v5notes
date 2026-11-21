import type { ThemeApi, ThemeInfo } from '@v5notes/vault-plugin-api'
import {
  applyAppearance,
  BUILTIN_THEMES,
  isBuiltinThemeId,
  loadAppearancePrefs,
  saveAppearancePrefs,
  type AppearancePrefs,
  type BuiltinThemeId,
  type ColorMode,
} from '../appearance/themes'
import { validateThemeCss } from './cssValidate'
import { BUNDLED_THEMES } from './samples/bundled'

const STYLE_ID = 'v5-community-theme-style'

export { STYLE_ID }
const APP_VERSION = '2.1.0'

export interface VaultThemePackage {
  id: string
  name: string
  version?: string
  description?: string
  author?: string
  css: string
}

export interface ThemeHostDeps {
  /** Merge one field into the vault appearance file without dropping the others. */
  updateAppearanceFile?: (patch: { theme?: string; colorMode?: ColorMode }) => Promise<void>

  /** Theme choice and colour mode for the open vault. */
  readAppearanceFile?: () => Promise<Partial<AppearancePrefs> | null>
  writeAppearanceFile?: (prefs: AppearancePrefs) => Promise<void>
  /** Themes installed in the app; the same set for every vault. */
  listInstalledThemes?: () => Promise<VaultThemePackage[]>
  onNotice?: (message: string) => void
  isSafeMode?: () => boolean
}

export interface ThemeHost extends ThemeApi {
  start(): Promise<void>
  stop(): void
  setColorMode(mode: ColorMode): Promise<void>
  getPrefs(): AppearancePrefs
  getLastError(): string | null
  installBundledSample(id: string): VaultThemePackage | null
}

function builtinInfos(): ThemeInfo[] {
  return BUILTIN_THEMES.map((t) => ({
    id: t.id,
    name: t.label,
    description: t.description,
    builtin: true,
    source: 'builtin' as const,
  }))
}

/**
 * 随应用内置的主题（林墨 / 晚晴 / Catalog Moss 等）直接按包注入 CSS，
 * 与 builtin 一样不用先装进 extensions/themes/。
 */
function bundledThemes(): VaultThemePackage[] {
  return BUNDLED_THEMES.map((theme) => ({
    id: theme.id,
    name: theme.name,
    version: theme.version,
    description: theme.description,
    author: theme.author,
    css: theme.css,
  }))
}

function clearInjectedStyle(): void {
  if (typeof document === 'undefined') return
  document.getElementById(STYLE_ID)?.remove()
  document.documentElement.removeAttribute('data-community-theme')
}

export function injectCss(themeId: string, css: string): void {
  if (typeof document === 'undefined') return
  clearInjectedStyle()
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.setAttribute('data-theme-id', themeId)
  el.textContent = css
  document.head.appendChild(el)
  document.documentElement.dataset.communityTheme = themeId
}

export function createThemeHost(deps: ThemeHostDeps = {}): ThemeHost {
  let prefs = loadAppearancePrefs()
  let installedThemes: VaultThemePackage[] = []
  let lastError: string | null = null
  const bundledCache = new Map(bundledThemes().map((t) => [t.id, t]))

  async function refreshInstalledThemes(): Promise<void> {
    installedThemes = deps.listInstalledThemes ? await deps.listInstalledThemes() : []
  }

  function resolvePackage(id: string): VaultThemePackage | null {
    return bundledCache.get(id) || installedThemes.find((t) => t.id === id) || null
  }

  function list(): ThemeInfo[] {
    const seen = new Set<string>()
    const out: ThemeInfo[] = []
    for (const b of builtinInfos()) {
      seen.add(b.id)
      out.push(b)
    }
    // 随应用内置的主题（林墨 / 晚晴 / Catalog Moss）固定排在默认主题之后。
    // 即使磁盘上还留着同名目录（旧版本装过种子），它们仍属内置，只显示一次、不可卸载。
    for (const bundled of bundledCache.values()) {
      seen.add(bundled.id)
      out.push({
        id: bundled.id,
        name: bundled.name,
        version: bundled.version,
        description: bundled.description,
        author: bundled.author,
        builtin: false,
        source: 'core',
      })
    }
    // 其余在磁盘上的主题才是用户安装的，排在最后。
    for (const t of installedThemes) {
      if (seen.has(t.id)) continue
      seen.add(t.id)
      out.push({
        id: t.id,
        name: t.name,
        version: t.version,
        description: t.description,
        author: t.author,
        builtin: false,
        source: 'vault',
      })
    }
    return out
  }

  async function persist(next: AppearancePrefs): Promise<void> {
    prefs = next
    saveAppearancePrefs(next)
    if (deps.writeAppearanceFile) {
      try {
        await deps.writeAppearanceFile(next)
      } catch {
        /* best-effort */
      }
    }
  }

  /**
   * Write only the theme fields, leaving the vault colour (and anything else the
   * appearance file carries) where it is. Always a patch, never a replace.
   */
  async function persistPatch(patch: { theme?: string; colorMode?: ColorMode }): Promise<void> {
    if (!deps.updateAppearanceFile) return
    // The appearance file owns its own schemaVersion; a theme write must not carry one.
    const body: { theme?: string; colorMode?: ColorMode } = {}
    if (patch.theme !== undefined) body.theme = patch.theme
    if (patch.colorMode !== undefined) body.colorMode = patch.colorMode
    try {
      await deps.updateAppearanceFile(body)
    } catch {
      /* best-effort: local prefs still hold the choice */
    }
  }

  async function applyThemeId(themeId: string, colorMode: ColorMode): Promise<void> {
    lastError = null

    if (deps.isSafeMode?.() ?? false) {
      // Safe Mode only skips community code. The builtin theme (默认 / 暮色) and
      // 明暗 are shell settings, not plugin code, so both stay as chosen; only
      // community CSS is withheld. Nothing is persisted here, so the stored
      // theme is still the user's own choice when Safe Mode goes off.
      const next: AppearancePrefs = {
        schemaVersion: 1,
        theme: isBuiltinThemeId(themeId) ? themeId : 'default',
        colorMode,
      }
      clearInjectedStyle()
      applyAppearance(next)
      prefs = next
      return
    }

    const isBuiltin = BUILTIN_THEMES.some((t) => t.id === themeId)
    if (isBuiltin) {
      clearInjectedStyle()
      const next: AppearancePrefs = { schemaVersion: 1, theme: themeId, colorMode }
      applyAppearance(next)
      await persist(next)
      await persistPatch(next)
      return
    }

    const pkg = resolvePackage(themeId)
    if (!pkg) {
      lastError = `主题不存在: ${themeId}`
      deps.onNotice?.(lastError)
      clearInjectedStyle()
      const next: AppearancePrefs = { schemaVersion: 1, theme: 'default', colorMode }
      applyAppearance(next)
      await persist(next)
      await persistPatch(next)
      return
    }

    const check = validateThemeCss(pkg.css)
    if (!check.ok) {
      lastError = `主题 ${themeId} CSS 校验失败，已回退内置: ${check.errors.join('; ')}`
      deps.onNotice?.(lastError)
      clearInjectedStyle()
      const next: AppearancePrefs = { schemaVersion: 1, theme: 'default', colorMode }
      applyAppearance(next)
      await persist(next)
      return
    }

    // Apply builtin shell vars first, then overlay community CSS.
    applyAppearance({ schemaVersion: 1, theme: 'default', colorMode })
    injectCss(themeId, pkg.css)
    await persist({ schemaVersion: 1, theme: themeId, colorMode })
    await persistPatch({ theme: themeId, colorMode })
  }

  return {
    async start() {
      await refreshInstalledThemes()
      // readAppearanceFile returns BOTH fields or neither, so it can never tell
      // us "no preference yet". Fill each missing field from the stored choice
      // (localStorage) — otherwise restarting the host (e.g. leaving Safe Mode)
      // silently resets 明暗 to 跟随系统 and the blocked theme to 默认.
      const stored = loadAppearancePrefs()
      let theme = stored.theme
      let colorMode = stored.colorMode
      if (deps.readAppearanceFile) {
        try {
          const file = await deps.readAppearanceFile()
          if (file && file.theme) theme = file.theme as AppearancePrefs['theme']
          if (file && file.colorMode) colorMode = file.colorMode
        } catch {
          /* ignore */
        }
      }
      prefs = { schemaVersion: 1, theme, colorMode }
      await applyThemeId(theme, colorMode)
    },
    stop() {
      clearInjectedStyle()
    },
    list,
    getActive() {
      return prefs.theme
    },
    async setActive(id: string) {
      await refreshInstalledThemes()
      await applyThemeId(id, prefs.colorMode)
    },
    async setColorMode(mode: ColorMode) {
      await applyThemeId(prefs.theme, mode)
    },
    getCssVariables() {
      if (typeof document === 'undefined' || !document.documentElement) return {}
      const style = getComputedStyle(document.documentElement)
      const out: Record<string, string> = {}
      for (const key of [
        '--bg',
        '--panel',
        '--ink',
        '--muted',
        '--line',
        '--accent',
        '--accent-hover',
        '--surface',
        '--danger',
        '--danger-bg',
      ]) {
        out[key] = style.getPropertyValue(key).trim()
      }
      return out
    },
    getPrefs() {
      return { ...prefs }
    },
    getLastError() {
      return lastError
    },
    installBundledSample(id: string) {
      return bundledCache.get(id) ?? null
    },
  }
}

export { APP_VERSION }