/** 登录页主题：自动跟随系统 / 固定浅色 / 固定深色。 */
export type ThemeMode = 'auto' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const LOGIN_THEME_STORAGE_KEY = 'v5notes-login-theme'

const THEME_MODES: readonly ThemeMode[] = ['auto', 'light', 'dark']

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value)
}

/** 单按钮循环：自动 → 浅色 → 深色 → 自动。 */
export function nextThemeMode(mode: ThemeMode): ThemeMode {
  const index = THEME_MODES.indexOf(mode)
  return THEME_MODES[(index + 1) % THEME_MODES.length]
}

export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (mode === 'light' || mode === 'dark') return mode
  return systemPrefersDark ? 'dark' : 'light'
}

export function readStoredThemeMode(storage: Pick<Storage, 'getItem'> | null): ThemeMode {
  if (!storage) return 'auto'
  try {
    const value = storage.getItem(LOGIN_THEME_STORAGE_KEY)
    return isThemeMode(value) ? value : 'auto'
  } catch {
    return 'auto'
  }
}
