import type { ThemeId } from '@v5md/view'

/** The app palette (light / dark) that the editor can follow. */
export type AppColorScheme = 'light' | 'dark'

/** auto follows the app theme; any v5md theme id pins the editor to it. */
export type EditorThemePreference = 'auto' | ThemeId

export const EDITOR_THEME_STORAGE_KEY = 'v5notes-editor-theme'
export const AUTO_EDITOR_THEME = 'auto' as const

/** Built-in v5md themes used while the editor follows the app palette. */
export const LIGHT_EDITOR_THEME: ThemeId = 'paper'
export const DARK_EDITOR_THEME: ThemeId = 'one-dark'

// Kept in sync with @v5md/view's THEME_IDS. Defining the list locally keeps the
// command model testable without importing the editor bundle (which pulls CSS).
export const EDITOR_THEME_IDS = [
  'paper',
  'github',
  'nord',
  'tokyo-night',
  'catppuccin',
  'one-dark',
  'dracula',
  'solarized-light',
  'solarized-dark',
  'catppuccin-latte',
  'rose-pine-dawn',
] as const satisfies readonly ThemeId[]

/** Built-in v5md themes that declare color-scheme: dark. */
export const DARK_EDITOR_THEME_IDS: readonly ThemeId[] = [
  'nord',
  'tokyo-night',
  'catppuccin',
  'one-dark',
  'dracula',
  'solarized-dark',
]

/** Theme ids are product names, so they stay the same in every UI language. */
export const EDITOR_THEME_LABELS: Record<ThemeId, string> = {
  paper: 'Paper',
  github: 'GitHub',
  nord: 'Nord',
  'tokyo-night': 'Tokyo Night',
  catppuccin: 'Catppuccin',
  'one-dark': 'One Dark',
  dracula: 'Dracula',
  'solarized-light': 'Solarized Light',
  'solarized-dark': 'Solarized Dark',
  'catppuccin-latte': 'Catppuccin Latte',
  'rose-pine-dawn': 'Rosé Pine Dawn',
}

export function isEditorThemePreference(value: unknown): value is EditorThemePreference {
  return value === AUTO_EDITOR_THEME || (typeof value === 'string' && (EDITOR_THEME_IDS as readonly string[]).includes(value))
}

export function readStoredEditorTheme(storage: Pick<Storage, 'getItem'> | null): EditorThemePreference {
  if (!storage) return AUTO_EDITOR_THEME
  try {
    const value = storage.getItem(EDITOR_THEME_STORAGE_KEY)
    return isEditorThemePreference(value) ? value : AUTO_EDITOR_THEME
  } catch {
    return AUTO_EDITOR_THEME
  }
}

/** Resolve the concrete v5md theme used by the editor right now. */
export function resolveEditorTheme(preference: EditorThemePreference, appTheme: AppColorScheme): ThemeId {
  if (preference !== AUTO_EDITOR_THEME) return preference
  return appTheme === 'dark' ? DARK_EDITOR_THEME : LIGHT_EDITOR_THEME
}

export function isDarkEditorTheme(theme: ThemeId): boolean {
  return DARK_EDITOR_THEME_IDS.includes(theme)
}
