/**
 * Built-in appearance themes + CSS variable contract (Phase 2 foundation for Phase 6 Theme API).
 */

export type BuiltinThemeId = 'default' | 'dusk'
export type ColorMode = 'system' | 'light' | 'dark'

export interface AppearancePrefs {
  schemaVersion: 1
  theme: BuiltinThemeId
  colorMode: ColorMode
}

export const APPEARANCE_STORAGE_KEY = 'v5notes.vault.appearance.v1'

export const BUILTIN_THEMES: { id: BuiltinThemeId; label: string; description: string }[] = [
  { id: 'default', label: '默认', description: '暖白底 + 墨绿强调' },
  { id: 'dusk', label: '暮色', description: '深橄榄底，仍属内置 fallback' },
]

export function defaultAppearance(): AppearancePrefs {
  return { schemaVersion: 1, theme: 'default', colorMode: 'system' }
}

export function loadAppearancePrefs(): AppearancePrefs {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY)
    if (!raw) return defaultAppearance()
    const parsed = JSON.parse(raw) as Partial<AppearancePrefs>
    const theme = parsed.theme === 'dusk' ? 'dusk' : 'default'
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

/** Apply data attributes consumed by `styles/tokens.css`. */
export function applyAppearance(prefs: AppearancePrefs): void {
  const root = document.documentElement
  root.dataset.theme = prefs.theme
  root.dataset.colorMode = resolveColorMode(prefs.colorMode)
  root.dataset.colorPreference = prefs.colorMode
}
