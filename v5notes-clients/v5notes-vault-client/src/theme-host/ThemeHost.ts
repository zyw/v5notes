import type { ThemeApi, ThemeInfo } from '@v5notes/vault-plugin-api'
import {
  applyAppearance,
  BUILTIN_THEMES,
  loadAppearancePrefs,
  saveAppearancePrefs,
  type AppearancePrefs,
  type ColorMode,
} from '../appearance/themes'
import { validateThemeCss } from './cssValidate'
import { FOREST_INK_CSS, FOREST_INK_MANIFEST } from './samples/forestInk'

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
  /** Read appearance.json from vault when available. */
  readAppearanceFile?: () => Promise<Partial<AppearancePrefs> | null>
  writeAppearanceFile?: (prefs: AppearancePrefs) => Promise<void>
  /** Discover themes under `.v5notes/themes/<id>/`. */
  listVaultThemes?: () => Promise<VaultThemePackage[]>
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

function bundledSamples(): VaultThemePackage[] {
  return [
    {
      id: FOREST_INK_MANIFEST.id,
      name: FOREST_INK_MANIFEST.name,
      version: FOREST_INK_MANIFEST.version,
      description: FOREST_INK_MANIFEST.description,
      author: FOREST_INK_MANIFEST.author,
      css: FOREST_INK_CSS,
    },
  ]
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
  let vaultThemes: VaultThemePackage[] = []
  let lastError: string | null = null
  const sampleCache = new Map(bundledSamples().map((t) => [t.id, t]))

  async function refreshVaultThemes(): Promise<void> {
    vaultThemes = deps.listVaultThemes ? await deps.listVaultThemes() : []
  }

  function resolvePackage(id: string): VaultThemePackage | null {
    return vaultThemes.find((t) => t.id === id) || sampleCache.get(id) || null
  }

  function list(): ThemeInfo[] {
    const seen = new Set<string>()
    const out: ThemeInfo[] = []
    for (const b of builtinInfos()) {
      seen.add(b.id)
      out.push(b)
    }
    for (const t of [...vaultThemes, ...sampleCache.values()]) {
      if (seen.has(t.id)) continue
      seen.add(t.id)
      out.push({
        id: t.id,
        name: t.name,
        version: t.version,
        description: t.description,
        author: t.author,
        builtin: false,
        source: vaultThemes.some((v) => v.id === t.id) ? 'vault' : 'core',
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

  async function applyThemeId(themeId: string, colorMode: ColorMode): Promise<void> {
    lastError = null
    const safe = deps.isSafeMode?.() ?? false

    if (safe) {
      clearInjectedStyle()
      const next: AppearancePrefs = { schemaVersion: 1, theme: 'default', colorMode }
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
  }

  return {
    async start() {
      await refreshVaultThemes()
      if (deps.readAppearanceFile) {
        try {
          const file = await deps.readAppearanceFile()
          if (file?.theme || file?.colorMode) {
            prefs = {
              schemaVersion: 1,
              theme: (file.theme as AppearancePrefs['theme']) || prefs.theme,
              colorMode: (file.colorMode as ColorMode) || prefs.colorMode,
            }
          }
        } catch {
          /* ignore */
        }
      }
      await applyThemeId(prefs.theme, prefs.colorMode)
    },
    stop() {
      clearInjectedStyle()
    },
    list,
    getActive() {
      return prefs.theme
    },
    async setActive(id: string) {
      await refreshVaultThemes()
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
      return sampleCache.get(id) || null
    },
  }
}

export { APP_VERSION }
