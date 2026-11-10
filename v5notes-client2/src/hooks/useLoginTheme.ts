import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  LOGIN_THEME_STORAGE_KEY,
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

/**
 * 登录页主题状态。模式记在本机（只影响登录页），auto 时跟随系统。
 * 同时把 resolved 同步到根节点的 color-scheme，让密码框、滚动条等原生控件跟着变。
 */
export function useLoginTheme() {
  const mode = ref<ThemeMode>(readStoredThemeMode(storageOrNull()))
  const systemDark = ref(initialSystemDark())
  let query: MediaQueryList | null = null

  const resolved = computed<ResolvedTheme>(() => resolveTheme(mode.value, systemDark.value))
  const isAuto = computed(() => mode.value === 'auto')

  function onSystemChange(event: MediaQueryListEvent) {
    systemDark.value = event.matches
  }

  onMounted(() => {
    if (typeof window.matchMedia !== 'function') return
    query = window.matchMedia(DARK_QUERY)
    systemDark.value = query.matches
    query.addEventListener('change', onSystemChange)
  })

  onBeforeUnmount(() => {
    query?.removeEventListener('change', onSystemChange)
    // 登录页只是浅色工作区之前的一屏：离开时把原生控件的配色还给浅色
    if (typeof document !== 'undefined') document.documentElement.style.colorScheme = 'light'
  })

  watch(mode, value => {
    try {
      storageOrNull()?.setItem(LOGIN_THEME_STORAGE_KEY, value)
    } catch {
      /* 隐私模式等场景下写入失败，不影响本次使用 */
    }
  })

  watch(
    resolved,
    value => {
      if (typeof document !== 'undefined') document.documentElement.style.colorScheme = value
    },
    { immediate: true },
  )

  return {
    mode,
    resolved,
    isAuto,
    cycleTheme: () => {
      mode.value = nextThemeMode(mode.value)
    },
  }
}
