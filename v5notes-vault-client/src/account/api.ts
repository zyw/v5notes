import { DEFAULT_CLIENT_ID, DEFAULT_LOGIN_PUBLIC_KEY, DEVICE_TYPE } from './constants'
import { encryptLogin } from './loginCrypto'
import { createRequest, type RequestConnection } from './request'
import type { AccountPlan } from './quota'
import { mapCloudQuotaToPlan } from './quota'

export interface UserProfile {
  userId: string
  userName: string
  nickName: string
  email?: string
  avatar?: string
}

export interface LoginResult {
  access_token: string
  refresh_token?: string
  expire_in?: number
}

export interface Connection extends RequestConnection {}

export async function probeServer(
  server: string,
  options: { transport?: typeof fetch; timeoutMs?: number; clientId?: string } = {},
): Promise<void> {
  const transport = options.transport ?? fetch
  const timeoutMs = options.timeoutMs ?? 8000
  const clientId = options.clientId || import.meta.env.VITE_CLIENT_ID || DEFAULT_CLIENT_ID
  const base = server.replace(/\/+$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await transport(`${base}/client/ping`, {
      method: 'GET',
      headers: { 'Content-Language': 'zh_CN', clientid: clientId },
      signal: controller.signal,
    })
    let envelope: { code?: number }
    try {
      envelope = await response.json() as { code?: number }
    } catch {
      throw new Error('无法连接服务器')
    }
    if (!response.ok || envelope.code !== 200) throw new Error('无法连接服务器')
  } catch (cause) {
    if (cause instanceof Error && cause.message === '无法连接服务器') throw cause
    throw new Error('无法连接服务器')
  } finally {
    clearTimeout(timer)
  }
}

function publicKey(): string {
  return import.meta.env.VITE_API_PUBLIC_KEY || DEFAULT_LOGIN_PUBLIC_KEY
}

/**
 * Vault Account 客户端：登录 / 资料 / 套餐查询。
 * 不包含笔记 CRUD；Sync 走 Phase 4 `/vault/v1`。
 */
export function createAccountApi(
  config: () => Connection,
  onUnauthorized: () => void,
  transport: typeof fetch = fetch,
  onTokensRefreshed?: (accessToken: string, refreshToken: string) => void,
) {
  const rawCall = createRequest(config, onUnauthorized, transport)

  const performRefresh = async (): Promise<boolean> => {
    const refreshToken = config().refreshToken
    if (!refreshToken) return false
    try {
      const encrypted = encryptLogin(JSON.stringify({ refreshToken }), publicKey())
      const pair = await rawCall<{ access_token: string; refresh_token?: string }>(
        '/auth/refresh',
        { method: 'POST', body: encrypted.body, headers: { 'encrypt-key': encrypted.key } },
        false,
      )
      if (!pair?.access_token || !pair.refresh_token) return false
      onTokensRefreshed?.(pair.access_token, pair.refresh_token)
      return true
    } catch {
      return false
    }
  }

  const call = createRequest(config, onUnauthorized, transport, performRefresh)

  return {
    ping: () => call<unknown>('/client/ping', {}, false),
    userInfo: async () => (await call<{ user: UserProfile }>('/system/user/getInfo')).user,
    login: (username: string, password: string) => {
      const encrypted = encryptLogin(JSON.stringify({
        tenantId: '000000',
        username,
        password,
        clientId: config().clientId,
        grantType: 'clientPassword',
        deviceType: DEVICE_TYPE,
      }), publicKey())
      return call<LoginResult>(
        '/auth/login',
        { method: 'POST', body: encrypted.body, headers: { 'encrypt-key': encrypted.key } },
        false,
      )
    },
    /** app=vault → justauth.vault-client-address → v5notes-vault:// */
    socialAuthUrl: (source: string) =>
      call<string>(`/auth/binding/${encodeURIComponent(source)}?${new URLSearchParams({ app: 'vault' })}`, {}, false),
    loginSocial: (body: { source: string; socialCode: string; socialState: string }) => {
      const encrypted = encryptLogin(JSON.stringify({
        tenantId: '000000',
        clientId: config().clientId,
        grantType: 'social',
        deviceType: DEVICE_TYPE,
        source: body.source,
        socialCode: body.socialCode,
        socialState: body.socialState,
      }), publicKey())
      return call<LoginResult>(
        '/auth/login',
        { method: 'POST', body: encrypted.body, headers: { 'encrypt-key': encrypted.key } },
        false,
      )
    },
    thirdPartyLoginEnabled: async () => Boolean(await call<boolean>('/auth/client/third-party-login-enabled', {}, false)),
    registerEnabled: async () => Boolean(await call<boolean>('/auth/client/register-enabled', {}, false)),
    /**
     * 套餐形态 B：一账号双配额字段。
     * 现网仅有 Cloud 试用配额 API；Vault sync 桶先 stub，待 Phase 4/5 接 `/vault/v1/quota`。
     */
    plan: async (): Promise<AccountPlan> => {
      try {
        const cloud = await call<{
          limited: boolean
          expired: boolean
          usedBytes: number
          noteBytes?: number
          fileBytes?: number
          quotaBytes: number
          expireAt?: string | null
          planName?: string | null
          planExpireAt?: string | null
        }>('/client/account/quota')
        return mapCloudQuotaToPlan(cloud)
      } catch {
        return mapCloudQuotaToPlan(null)
      }
    },
  }
}

export type AccountApi = ReturnType<typeof createAccountApi>
