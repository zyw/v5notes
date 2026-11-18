import { describe, expect, it } from 'vitest'
import {
  AUTO_EDITOR_THEME,
  DARK_EDITOR_THEME,
  DARK_EDITOR_THEME_IDS,
  LIGHT_EDITOR_THEME,
  readStoredEditorTheme,
  resolveEditorTheme,
  isEditorThemePreference,
  isDarkEditorTheme,
  EDITOR_THEME_STORAGE_KEY,
} from './editorTheme'

describe('editor theme', () => {
  it('defaults to auto and accepts stored v5md ids', () => {
    expect(readStoredEditorTheme(null)).toBe(AUTO_EDITOR_THEME)
    expect(readStoredEditorTheme({ getItem: () => null })).toBe(AUTO_EDITOR_THEME)
    expect(readStoredEditorTheme({ getItem: key => (key === EDITOR_THEME_STORAGE_KEY ? 'nord' : null) })).toBe('nord')
    expect(readStoredEditorTheme({ getItem: () => 'not-a-theme' })).toBe(AUTO_EDITOR_THEME)
  })

  it('follows the app palette in auto mode', () => {
    expect(resolveEditorTheme('auto', 'light')).toBe(LIGHT_EDITOR_THEME)
    expect(resolveEditorTheme('auto', 'dark')).toBe(DARK_EDITOR_THEME)
    expect(resolveEditorTheme('nord', 'light')).toBe('nord')
    expect(resolveEditorTheme('github', 'dark')).toBe('github')
  })

  it('validates preferences against the v5md theme list', () => {
    expect(isEditorThemePreference('auto')).toBe(true)
    expect(isEditorThemePreference('one-dark')).toBe(true)
    expect(isEditorThemePreference('paper')).toBe(true)
    expect(isEditorThemePreference('missing')).toBe(false)
    expect(isEditorThemePreference(null)).toBe(false)
  })

  it('knows which built-in themes are dark', () => {
    for (const id of DARK_EDITOR_THEME_IDS) expect(isDarkEditorTheme(id)).toBe(true)
    expect(isDarkEditorTheme('paper')).toBe(false)
    expect(isDarkEditorTheme('github')).toBe(false)
    expect(isDarkEditorTheme('solarized-light')).toBe(false)
  })
})
