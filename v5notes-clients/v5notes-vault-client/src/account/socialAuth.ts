import { SOCIAL_CALLBACK_PATH, STORAGE_KEYS } from './constants'

export const SOCIAL_PROVIDERS = [
  { source: 'gitee', label: 'Gitee', tone: 'gitee' },
  { source: 'github', label: 'GitHub', tone: 'github' },
] as const

export type SocialSource = (typeof SOCIAL_PROVIDERS)[number]['source']
export type SocialOAuthIntent = 'login' | 'bind'

const SOCIAL_CONSUMED_CODES_LIMIT = 30

function oauthStorage(): Storage | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

function consumedKey(code: string, state = ''): string {
  const c = code.trim()
  const s = state.trim()
  return s ? `${c}::${s}` : c
}

function readConsumedCodes(): string[] {
  const store = oauthStorage()
  if (!store) return []
  try {
    const raw = store.getItem(STORAGE_KEYS.socialConsumed)
    const parsed = raw ? JSON.parse(raw) as unknown : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function isSocialCodeConsumed(code: string, state = ''): boolean {
  const key = consumedKey(code, state)
  if (!key) return false
  const list = readConsumedCodes()
  return list.includes(key) || list.includes(code.trim())
}

export function markSocialCodeConsumed(code: string, state = ''): void {
  const store = oauthStorage()
  if (!store) return
  const key = consumedKey(code, state)
  if (!key) return
  const next = [key, ...readConsumedCodes().filter((item) => item !== key && item !== code.trim())]
    .slice(0, SOCIAL_CONSUMED_CODES_LIMIT)
  store.setItem(STORAGE_KEYS.socialConsumed, JSON.stringify(next))
}

/** 从当前 URL 或 deep link 解析 OAuth 回调（含 v5notes-vault://app/social-callback）。 */
export function readSocialCallbackParams(
  href = typeof window !== 'undefined' ? window.location.href : '',
): { source: string; code: string; state: string } | null {
  try {
    const url = new URL(href)
    const path = url.pathname.replace(/\/+$/, '') || '/'
    const code = url.searchParams.get('code')?.trim() || ''
    const state = url.searchParams.get('state')?.trim() || ''
    const source = url.searchParams.get('source')?.trim() || ''
    if (!code || !state || !source) return null
    if (path.endsWith(SOCIAL_CALLBACK_PATH)) return { source, code, state }
    return null
  } catch {
    return null
  }
}

export function clearSocialCallbackUrl(): void {
  if (typeof window === 'undefined') return
  if (window.location.protocol.startsWith('v5notes')) return
  const url = new URL(window.location.href)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  if (path.endsWith(SOCIAL_CALLBACK_PATH)) {
    window.history.replaceState({}, '', `${url.origin}/`)
    return
  }
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  url.searchParams.delete('source')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

export function setSocialOAuthIntent(intent: SocialOAuthIntent, source: string): void {
  sessionStorage.setItem(STORAGE_KEYS.socialIntent, intent)
  sessionStorage.setItem(STORAGE_KEYS.socialPending, source)
}

export function clearSocialOAuthIntent(): void {
  sessionStorage.removeItem(STORAGE_KEYS.socialIntent)
  sessionStorage.removeItem(STORAGE_KEYS.socialPending)
}

export function hasSocialOAuthPending(): boolean {
  return Boolean(sessionStorage.getItem(STORAGE_KEYS.socialPending))
}

export function mapSocialLoginError(message: string): string {
  const text = message.trim()
  if (!text) return '第三方登录失败'
  if (/没有开启.*第三方|未开启.*第三方|third-party sign-in is disabled|client\.thirdPartyLogin\.disabled/i.test(text)) {
    return '服务器未开启第三方登录'
  }
  if (/Failed to login with oauth|AuthException|invalid_grant|code.*(expired|invalid|used)|授权码|非法的state/i.test(text)) {
    return '授权码已失效，请重新发起第三方登录'
  }
  if (/user\.type\.mismatch|无法登录此端|cannot sign in/i.test(text)) {
    return '该账号无法登录 Vault 客户端'
  }
  return text
}
