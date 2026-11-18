import { computed, ref, watch } from 'vue'
import {
  THEME_STORAGE_KEY,
  nextThemeMode,
  readStoredThemeMode,
  resolveTheme,
  type ResolvedTheme,
  type ThemeMode,
} from '../models/loginTheme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function storageOrNull(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function initialSystemDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(DARK_QUERY).matches
    : false
}

const mode = ref<ThemeMode>(readStoredThemeMode(storageOrNull()))
const systemDark = ref(initialSystemDark())
const resolved = computed<ResolvedTheme>(() => resolveTheme(mode.value, systemDark.value))

let started = false

function applyTheme(theme: ResolvedTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

/**
 * 启动一次：把 data-theme 挂到 <html>，auto 模式跟随系统，
 * 选择写在 v5notes-theme（同时兼容旧的登录页键）。
 */
export function startAppTheme() {
  if (started || typeof window === 'undefined') return
  started = true
  applyTheme(resolved.value)
  watch(resolved, applyTheme)
  watch(mode, value => {
    try {
      storageOrNull()?.setItem(THEME_STORAGE_KEY, value)
    } catch {
      /* 隐私模式等场景下写入失败，不影响本次使用 */
    }
  })
  if (typeof window.matchMedia === 'function') {
    const query = window.matchMedia(DARK_QUERY)
    systemDark.value = query.matches
    query.addEventListener('change', event => { systemDark.value = event.matches })
  }
}

export function useAppTheme() {
  startAppTheme()
  return {
    mode,
    resolved,
    setMode: (value: ThemeMode) => { mode.value = value },
    cycleTheme: () => { mode.value = nextThemeMode(mode.value) },
  }
}
