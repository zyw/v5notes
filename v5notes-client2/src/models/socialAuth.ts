/** 笔记客户端启用的第三方登录（顺序：国内优先）。 */
export const SOCIAL_PROVIDERS = [
  { source: 'wechat_open', labelKey: 'login.socialWechat', tone: 'wechat' },
  { source: 'gitee', labelKey: 'login.socialGitee', tone: 'gitee' },
  { source: 'github', labelKey: 'login.socialGitHub', tone: 'github' },
  { source: 'google', labelKey: 'login.socialGoogle', tone: 'google' },
] as const

export type SocialSource = (typeof SOCIAL_PROVIDERS)[number]['source']

export function providerTone(source: string): string {
  const hit = SOCIAL_PROVIDERS.find((item) => item.source === source)
  return hit?.tone || 'default'
}

export type SocialOAuthIntent = 'login' | 'bind'

const SOCIAL_CALLBACK_PATH = '/social-callback'
const SOCIAL_INTENT_KEY = 'v5notes-social-intent'
const SOCIAL_PENDING_KEY = 'v5notes-social-pending'

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
  const hit = SOCIAL_PROVIDERS.find((item) => item.source === source)
  return hit?.labelKey || 'login.socialOther'
}

/**
 * 非 Tauri 浏览器若打开了回调页，尝试唤起桌面客户端（生产 HTTPS 中转用）。
 * 已在 Tauri 内则不做跳转。
 */
export function maybeHandOffSocialCallbackToDesktop(): boolean {
  if (typeof window === 'undefined') return false
  if ('__TAURI_INTERNALS__' in window) return false
  const params = readSocialCallbackParams()
  if (!params) return false
  const target = `v5notes://app/social-callback?${new URLSearchParams({
    source: params.source,
    code: params.code,
    state: params.state,
  })}`
  window.location.replace(target)
  return true
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
  return null
}
