import { createI18n } from 'vue-i18n'
import { en } from './en'
import { zhCN } from './zh-CN'
import { zhTW } from './zh-TW'

export const LOCALE_STORAGE_KEY = 'v5notes-locale'
export const APP_LOCALES = ['zh-CN', 'zh-TW', 'en'] as const
export type AppLocale = (typeof APP_LOCALES)[number]

export const LOCALE_OPTIONS: ReadonlyArray<{ value: AppLocale; label: string }> = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
]

export const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    en,
  },
})

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === 'zh-CN' || value === 'zh-TW' || value === 'en'
}

export function detectLocale(language = ''): AppLocale {
  const lang = language.toLowerCase()
  if (lang.startsWith('zh')) {
    return /(tw|hk|mo|hant)/.test(lang) ? 'zh-TW' : 'zh-CN'
  }
  if (lang.startsWith('en')) return 'en'
  return 'zh-CN'
}

export function resolveLocale(stored: string | null | undefined, language = ''): AppLocale {
  if (isAppLocale(stored)) return stored
  return detectLocale(language)
}

export function currentLocale(): AppLocale {
  const value = i18n.global.locale.value
  return isAppLocale(value) ? value : 'zh-CN'
}

export function t(key: string, values?: Record<string, unknown>): string {
  return i18n.global.t(key, values ?? {})
}

export function contentLanguage(): string {
  switch (currentLocale()) {
    case 'zh-TW': return 'zh_TW'
    case 'en': return 'en_US'
    default: return 'zh_CN'
  }
}

/** Map app locale onto @v5md/view's built-in UI languages (`zh-CN` | `en`). */
export function editorLocale(locale: string = currentLocale()): 'zh-CN' | 'en' {
  return locale === 'en' ? 'en' : 'zh-CN'
}

export function readStoredLocale(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): string | null {
  try {
    return storage?.getItem(LOCALE_STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

export function applyLocale(locale: AppLocale, storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): void {
  i18n.global.locale.value = locale
  try {
    storage?.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // The choice still applies for this session.
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale
    document.title = t('app.title')
  }
  void syncNativeLocale(locale)
}

export function installLocale(): void {
  const language = typeof navigator === 'undefined' ? '' : navigator.language
  applyLocale(resolveLocale(readStoredLocale(), language))
}

async function syncNativeLocale(locale: AppLocale): Promise<void> {
  try {
    const { invoke, isTauri } = await import('@tauri-apps/api/core')
    if (!isTauri()) return
    await invoke('set_app_locale', { locale })
  } catch {
    // Browser dev and shells that have not picked up the command keep their built-in copy.
  }
}
