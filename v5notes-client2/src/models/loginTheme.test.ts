import { describe, expect, it } from 'vitest'
import {
  LEGACY_LOGIN_THEME_STORAGE_KEY,
  THEME_STORAGE_KEY,
  isThemeMode,
  nextThemeMode,
  readStoredThemeMode,
  resolveTheme,
} from './loginTheme'

describe('app theme', () => {
  it('cycles auto → light → dark → auto', () => {
    expect(nextThemeMode('auto')).toBe('light')
    expect(nextThemeMode('light')).toBe('dark')
    expect(nextThemeMode('dark')).toBe('auto')
  })

  it('follows the system only in auto mode', () => {
    expect(resolveTheme('auto', true)).toBe('dark')
    expect(resolveTheme('auto', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('accepts only known modes', () => {
    expect(isThemeMode('auto')).toBe(true)
    expect(isThemeMode('system')).toBe(false)
    expect(isThemeMode(null)).toBe(false)
  })

  it('falls back to auto for missing or broken storage', () => {
    expect(readStoredThemeMode(null)).toBe('auto')
    expect(readStoredThemeMode({ getItem: () => null })).toBe('auto')
    expect(readStoredThemeMode({ getItem: key => (key === THEME_STORAGE_KEY ? 'dark' : null) })).toBe('dark')
    expect(readStoredThemeMode({ getItem: () => ({}) as unknown as string })).toBe('auto')
    expect(readStoredThemeMode({ getItem: () => { throw new Error('blocked') } })).toBe('auto')
  })

  it('migrates the early login-only key', () => {
    expect(readStoredThemeMode({
      getItem: key => (key === LEGACY_LOGIN_THEME_STORAGE_KEY ? 'light' : null),
    })).toBe('light')
    expect(THEME_STORAGE_KEY).toBe('v5notes-theme')
  })
})
