/** 笔记客户端启用的第三方登录（顺序：国内优先）。 */
export const SOCIAL_PROVIDERS = [
  { source: 'gitee', labelKey: 'login.socialGitee', tone: 'gitee' },
  { source: 'github', labelKey: 'login.socialGitHub', tone: 'github' },
] as const

export type SocialSource = (typeof SOCIAL_PROVIDERS)[number]['source']

/** JustAuth 可能返回 GITEE 等枚举名，统一小写再匹配配置。 */
export function normalizeSocialSource(source: string): string {
  return source.trim().toLowerCase()
}

export function providerTone(source: string): string {
  const hit = SOCIAL_PROVIDERS.find((item) => item.source === normalizeSocialSource(source))
  return hit?.tone || 'default'
}

export type SocialOAuthIntent = 'login' | 'bind'

const SOCIAL_CALLBACK_PATH = '/social-callback'
const SOCIAL_INTENT_KEY = 'v5notes-social-intent'
const SOCIAL_PENDING_KEY = 'v5notes-social-pending'
/**
 * 已换票的 OAuth code（localStorage，跨刷新保留）。
 * Tauri getCurrent() 在退出后刷新仍会返回旧 deep link，必须能识别已消费的一次性 code/state。
 */
const SOCIAL_CONSUMED_CODES_KEY = 'v5notes-social-consumed-codes'
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
  const storage = oauthStorage()
  if (!storage) return []
  try {
    const raw = storage.getItem(SOCIAL_CONSUMED_CODES_KEY)
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
  // 兼容旧版只存 code 的记录
  return list.includes(key) || list.includes(code.trim())
}

/** 标记 code/state 已使用；在发起换票前调用，防止并发/刷新重复请求。 */
export function markSocialCodeConsumed(code: string, state = ''): void {
  const storage = oauthStorage()
  if (!storage) return
  const key = consumedKey(code, state)
  if (!key) return
  const next = [key, ...readConsumedCodes().filter((item) => item !== key && item !== code.trim())]
    .slice(0, SOCIAL_CONSUMED_CODES_LIMIT)
  storage.setItem(SOCIAL_CONSUMED_CODES_KEY, JSON.stringify(next))
}

/** 从当前 URL 或 deep link 解析 OAuth 回调参数。 */
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
    // http(s) 落地页，或 v5notes://app/social-callback
    if (path.endsWith(SOCIAL_CALLBACK_PATH)) return { source, code, state }
    return null
  } catch {
    return null
  }
}

/** 清除地址栏中的 OAuth 回调参数，避免刷新重复换票。 */
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
  sessionStorage.setItem(SOCIAL_INTENT_KEY, intent)
  sessionStorage.setItem(SOCIAL_PENDING_KEY, source)
}

export function peekSocialOAuthIntent(): SocialOAuthIntent {
  return sessionStorage.getItem(SOCIAL_INTENT_KEY) === 'bind' ? 'bind' : 'login'
}

export function clearSocialOAuthIntent(): void {
  sessionStorage.removeItem(SOCIAL_INTENT_KEY)
  sessionStorage.removeItem(SOCIAL_PENDING_KEY)
}

export function hasSocialOAuthPending(): boolean {
  return Boolean(sessionStorage.getItem(SOCIAL_PENDING_KEY))
}

export function providerLabelKey(source: string): string {
  const hit = SOCIAL_PROVIDERS.find((item) => item.source === normalizeSocialSource(source))
  return hit?.labelKey || 'login.socialUnknown'
}

/** 将后端社交登录错误映射为登录页文案 key；无法识别时返回 null。 */
export function mapSocialLoginErrorKey(message: string): string | null {
  const text = message.trim()
  if (!text) return null
  if (text.includes('client.thirdPartyLogin.disabled') || /没有开启.*第三方|未开启.*第三方|第三方登录.*关闭|third-party sign-in is disabled|沒有開啟.*第三方/i.test(text)) {
    return 'login.socialOff'
  }
  if (text.includes('client.register.disabled') || /未开放.*注册|没有开启.*注册|registration is disabled|沒有開啟.*註冊/i.test(text)) {
    return 'login.socialDisabled'
  }
  if (text.includes('auth.social.email.occupied') || /邮箱已注册|email is already|電子郵件已註冊/i.test(text)) {
    return 'login.socialEmailOccupied'
  }
  if (text.includes('auth.social.bound') || /已经被绑定|already linked|已經被綁定/i.test(text)) {
    return 'profile.socialAlreadyBound'
  }
  if (text.includes('auth.social.unsupported') || /暂不支持|not supported|暫不支援/i.test(text)) {
    return 'login.socialUnsupported'
  }
  if (text.includes('user.type.mismatch') || /无法登录此端|cannot sign in|無法登入此端/i.test(text)) {
    return 'login.socialMismatch'
  }
  if (text.includes('auth.grant.type') || /认证权限类型|grant type/i.test(text)) {
    return 'login.socialUnsupported'
  }
  // JustAuth 换票失败：code/state 已用、过期，或刷新重放 deep link
  if (
    /Failed to login with oauth|AuthException|Illegal state|invalid_grant|code.*(expired|invalid|used)|授权码|authorization code|非法的state|state.*(invalid|expire)/i.test(text)
  ) {
    return 'login.socialCodeReuse'
  }
  return null
}
