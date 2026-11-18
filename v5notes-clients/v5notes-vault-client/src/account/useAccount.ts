import { computed, onMounted, onUnmounted, ref } from 'vue'
import { isTauri } from '@tauri-apps/api/core'
import { createAccountApi, probeServer, type UserProfile } from './api'
import { fieldErrorText, validateLoginAccount, validatePassword } from './authValidation'
import { DEFAULT_CLIENT_ID, DUAL_PRODUCT_LINE, OFFICIAL_SERVER } from './constants'
import { openExternalUrl } from './openExternal'
import type { AccountPlan } from './quota'
import { formatBytes } from './quota'
import {
  clearSocialCallbackUrl,
  clearSocialOAuthIntent,
  hasSocialOAuthPending,
  isSocialCodeConsumed,
  mapSocialLoginError,
  markSocialCodeConsumed,
  readSocialCallbackParams,
  setSocialOAuthIntent,
  SOCIAL_PROVIDERS,
} from './socialAuth'
import { clearTokens, readSession, writeSession } from './session'
import {
  normalizeServer,
  readServerSettings,
  writeServerSettings,
  type ServerSettings,
} from './serverSettings'

/** 同一 webview 生命周期内只消费一次 getCurrent()，避免 remount 重放旧 deep link。 */
let deepLinkColdStartApplied = false

export function useAccount() {
  const clientId = import.meta.env.VITE_CLIENT_ID || DEFAULT_CLIENT_ID
  const stored = readServerSettings()
  const server = ref(stored.server)
  const useOfficialServer = ref(stored.official)
  const customServer = ref(stored.official ? '' : stored.server)

  const session = readSession()
  const username = ref(session.username)
  const password = ref('')
  const token = ref(session.token)
  const refreshToken = ref(session.refreshToken)

  const busy = ref(false)
  const error = ref('')
  const fieldAccountError = ref('')
  const fieldPasswordError = ref('')
  const sessionExpired = ref(false)
  const socialLoginEnabled = ref(false)
  const profile = ref<UserProfile | null>(null)
  const plan = ref<AccountPlan | null>(null)
  const loggedIn = computed(() => Boolean(token.value))

  let unlistenDeepLink: (() => void) | undefined

  const api = createAccountApi(
    () => ({
      server: server.value,
      clientId,
      token: token.value,
      refreshToken: refreshToken.value,
    }),
    () => {
      // 401：清 token，保留未保存草稿（Vault 本地编辑不依赖登录）
      sessionExpired.value = true
      token.value = ''
      refreshToken.value = ''
      clearTokens()
      profile.value = null
      plan.value = null
    },
    fetch,
    (accessToken, newRefreshToken) => {
      token.value = accessToken
      refreshToken.value = newRefreshToken
      writeSession({ token: accessToken, refreshToken: newRefreshToken })
    },
  )

  function applyLoginResult(result: { access_token: string; refresh_token?: string }, account: string) {
    token.value = result.access_token
    refreshToken.value = result.refresh_token || ''
    username.value = account.trim()
    password.value = ''
    sessionExpired.value = false
    error.value = ''
    writeSession({
      token: result.access_token,
      refreshToken: result.refresh_token,
      username: account.trim(),
    })
  }

  async function refreshProfileAndPlan() {
    if (!token.value) {
      profile.value = null
      plan.value = null
      return
    }
    try {
      profile.value = await api.userInfo()
    } catch {
      profile.value = null
    }
    try {
      plan.value = await api.plan()
    } catch {
      plan.value = null
    }
  }

  async function probeAuthFeatures() {
    try {
      socialLoginEnabled.value = await api.thirdPartyLoginEnabled()
    } catch {
      socialLoginEnabled.value = false
    }
  }

  async function saveServer(next: ServerSettings) {
    const normalized = next.official
      ? { server: OFFICIAL_SERVER, official: true }
      : { server: normalizeServer(next.server), official: false }
    await probeServerSafe(normalized.server)
    server.value = normalized.server
    useOfficialServer.value = normalized.official
    customServer.value = normalized.official ? '' : normalized.server
    writeServerSettings(normalized)
  }

  async function probeServerSafe(address: string) {
    await probeServer(address, { clientId })
  }

  async function login(): Promise<boolean> {
    fieldAccountError.value = fieldErrorText(validateLoginAccount(username.value))
    fieldPasswordError.value = fieldErrorText(validatePassword(password.value, 'login'))
    if (fieldAccountError.value || fieldPasswordError.value) return false
    busy.value = true
    error.value = ''
    try {
      await probeServerSafe(server.value)
      const result = await api.login(username.value.trim(), password.value)
      applyLoginResult(result, username.value)
      await refreshProfileAndPlan()
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '登录失败'
      return false
    } finally {
      busy.value = false
    }
  }

  async function logout() {
    token.value = ''
    refreshToken.value = ''
    password.value = ''
    sessionExpired.value = false
    profile.value = null
    plan.value = null
    clearTokens()
  }

  async function startSocialLogin(source: string) {
    busy.value = true
    error.value = ''
    try {
      await probeServerSafe(server.value)
      setSocialOAuthIntent('login', source)
      const authUrl = await api.socialAuthUrl(source)
      await openExternalUrl(authUrl)
    } catch (cause) {
      clearSocialOAuthIntent()
      error.value = cause instanceof Error ? cause.message : '无法发起第三方登录'
    } finally {
      busy.value = false
    }
  }

  async function completeSocialLogin(params: { source: string; code: string; state: string }) {
    if (isSocialCodeConsumed(params.code, params.state)) {
      clearSocialCallbackUrl()
      return
    }
    markSocialCodeConsumed(params.code, params.state)
    busy.value = true
    error.value = ''
    try {
      const result = await api.loginSocial({
        source: params.source,
        socialCode: params.code,
        socialState: params.state,
      })
      applyLoginResult(result, username.value || params.source)
      clearSocialOAuthIntent()
      clearSocialCallbackUrl()
      await refreshProfileAndPlan()
    } catch (cause) {
      clearSocialOAuthIntent()
      clearSocialCallbackUrl()
      error.value = mapSocialLoginError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      busy.value = false
    }
  }

  async function applyDeepLink(urls: string[] | null | undefined) {
    if (!urls?.length) return
    for (const href of urls) {
      const params = readSocialCallbackParams(href)
      if (params) {
        await completeSocialLogin(params)
        return
      }
    }
  }

  async function bootstrap() {
    await probeAuthFeatures()
    if (token.value) {
      try {
        await api.ping()
        await refreshProfileAndPlan()
      } catch {
        // ping/profile 失败时，若已 401 会走 onUnauthorized；其它错误保留本地编辑
      }
    }

    if (!isTauri()) {
      const params = readSocialCallbackParams()
      if (params && (hasSocialOAuthPending() || !token.value)) {
        await completeSocialLogin(params)
      }
      return
    }

    try {
      const { getCurrent, onOpenUrl } = await import('@tauri-apps/plugin-deep-link')
      if (!deepLinkColdStartApplied) {
        deepLinkColdStartApplied = true
        const coldStart = await getCurrent().catch(() => null)
        await applyDeepLink(coldStart)
      }
      unlistenDeepLink = await onOpenUrl((urls) => { void applyDeepLink(urls) })
    } catch {
      // deep link 插件不可用时仍可密码登录
    }
  }

  onMounted(() => { void bootstrap() })
  onUnmounted(() => { unlistenDeepLink?.() })

  return {
    dualProductLine: DUAL_PRODUCT_LINE,
    clientId,
    server,
    useOfficialServer,
    customServer,
    username,
    password,
    token,
    loggedIn,
    busy,
    error,
    fieldAccountError,
    fieldPasswordError,
    sessionExpired,
    socialLoginEnabled,
    socialProviders: SOCIAL_PROVIDERS,
    profile,
    plan,
    formatBytes,
    login,
    logout,
    startSocialLogin,
    saveServer,
    refreshProfileAndPlan,
    dismissSessionExpired: () => { sessionExpired.value = false },
  }
}

export type AccountState = ReturnType<typeof useAccount>
