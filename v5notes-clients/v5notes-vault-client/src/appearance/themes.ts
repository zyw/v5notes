/**
 * Built-in appearance themes + CSS variable contract (Phase 2 foundation for Phase 6 Theme API).
 * `theme` may be a builtin id or a community/vault theme id.
 */

export type BuiltinThemeId = 'default' | 'dusk' | 'forest-ink' | 'wanqing'
export type ColorMode = 'system' | 'light' | 'dark'

export interface AppearancePrefs {
  schemaVersion: 1
  /** Builtin id or community theme id (e.g. catalog-moss). */
  theme: string
  colorMode: ColorMode
}

export const APPEARANCE_STORAGE_KEY = 'v5notes.vault.appearance.v1'

export const BUILTIN_THEMES: { id: BuiltinThemeId; label: string; description: string }[] = [
  { id: 'default', label: '默认', description: '节气暖纸底 + 墨绿强调 + 库色条' },
  { id: 'dusk', label: '暮色', description: '深橄榄底，仍属内置 fallback' },
  { id: 'forest-ink', label: '林墨', description: '冷绿纸底 + 墨绿强调，深色为林间夜色' },
  { id: 'wanqing', label: '晚晴', description: '暖纸底 + 靛蓝强调，深色为夜蓝' },
]

const BUILTIN_THEME_IDS = new Set<string>(BUILTIN_THEMES.map((t) => t.id))

export function isBuiltinThemeId(id: string): id is BuiltinThemeId {
  return BUILTIN_THEME_IDS.has(id)
}

export function defaultAppearance(): AppearancePrefs {
  return { schemaVersion: 1, theme: 'default', colorMode: 'system' }
}

export function loadAppearancePrefs(): AppearancePrefs {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY)
    if (!raw) return defaultAppearance()
    const parsed = JSON.parse(raw) as Partial<AppearancePrefs>
    const theme =
      typeof parsed.theme === 'string' && parsed.theme.trim() ? parsed.theme.trim() : 'default'
    const colorMode =
      parsed.colorMode === 'light' || parsed.colorMode === 'dark' || parsed.colorMode === 'system'
        ? parsed.colorMode
        : 'system'
    return { schemaVersion: 1, theme, colorMode }
  } catch {
    return defaultAppearance()
  }
}

export function saveAppearancePrefs(prefs: AppearancePrefs): void {
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

function resolveColorMode(mode: ColorMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

/**
 * Apply data attributes consumed by `styles/tokens.css`.
 * Community themes set `data-community-theme` via ThemeHost and keep shell on default tokens.
 */
export function applyAppearance(prefs: AppearancePrefs): void {
  const root = document.documentElement
  if (isBuiltinThemeId(prefs.theme)) {
    root.dataset.theme = prefs.theme
  } else {
    // Community overlay sits on default shell variables.
    root.dataset.theme = 'default'
  }
  root.dataset.colorMode = resolveColorMode(prefs.colorMode)
  root.dataset.colorPreference = prefs.colorMode
}
