import { computed, ref } from 'vue'
import type { ThemeId } from '@v5md/view'

/**
 * The editor theme preference, ported from v5notes-client2's `useEditorTheme`.
 *
 * `auto` follows the vault shell's own appearance (its data-color-mode
 * attribute), so a pinned v5md theme never fights the app chrome. The chosen
 * theme also styles the export, so a note exports the way it reads on screen.
 */
export type AppColorScheme = 'light' | 'dark'
/** auto follows the app appearance; any v5md theme id pins the editor to it. */
export type EditorThemePreference = 'auto' | ThemeId | (string & {})
export type EditorTheme = ThemeId | (string & {})

export const EDITOR_THEME_STORAGE_KEY = 'v5notes.vault.editor-theme.v1'
export const AUTO_EDITOR_THEME = 'auto' as const

/** Built-in v5md themes used while the editor follows the app appearance. */
export const LIGHT_EDITOR_THEME: ThemeId = 'paper'
export const DARK_EDITOR_THEME: ThemeId = 'one-dark'

// Kept in sync with @v5md/view's THEME_IDS. Defining the list locally keeps the
// palette testable without importing the editor bundle (which pulls CSS).
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
] as const satisfies readonly ThemeId[]

/** Built-in v5md themes that declare a dark color scheme. */
export const DARK_EDITOR_THEME_IDS: readonly ThemeId[] = [
  'nord',
  'tokyo-night',
  'catppuccin',
  'one-dark',
  'dracula',
  'solarized-dark',
]

export function isEditorThemePreference(value: unknown): value is EditorThemePreference {
  return value === AUTO_EDITOR_THEME
    || (typeof value === 'string' && (EDITOR_THEME_IDS as readonly string[]).includes(value))
}

export function isDarkEditorTheme(theme: string): boolean {
  return (DARK_EDITOR_THEME_IDS as readonly string[]).includes(theme)
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

export function resolveEditorTheme(preference: EditorThemePreference, appScheme: AppColorScheme): EditorTheme {
  if (preference !== AUTO_EDITOR_THEME) return preference
  return appScheme === 'dark' ? DARK_EDITOR_THEME : LIGHT_EDITOR_THEME
}

/** Reads the shell's resolved appearance from `<html data-color-mode>`. */
export function readAppColorScheme(root: { dataset?: DOMStringMap } | null = typeof document === 'undefined' ? null : document.documentElement): AppColorScheme {
  return root?.dataset?.colorMode === 'dark' ? 'dark' : 'light'
}

function storageOrNull(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

// Module-scoped so every editor mount agrees on the preference.
const preference = ref<EditorThemePreference>(readStoredEditorTheme(storageOrNull()))
const appScheme = ref<AppColorScheme>(readAppColorScheme())

export function useEditorTheme() {
  /** Re-reads the shell appearance; call after a theme switch. */
  function syncAppScheme(): void {
    appScheme.value = readAppColorScheme()
  }

  const theme = computed<EditorTheme>(() => resolveEditorTheme(preference.value, appScheme.value))

  function setPreference(next: EditorThemePreference): void {
    if (!isEditorThemePreference(next)) return
    preference.value = next
    try {
      storageOrNull()?.setItem(EDITOR_THEME_STORAGE_KEY, next)
    } catch {
      /* Private mode: the choice still applies for this session. */
    }
  }

  return { preference, theme, setPreference, syncAppScheme }
}
