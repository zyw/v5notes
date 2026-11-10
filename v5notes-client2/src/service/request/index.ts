import { contentLanguage, t } from '../../i18n'
import { normalizeIds } from '../../utils/identity'

export interface RequestConnection {
  server: string
  clientId: string
  token: string
  refreshToken?: string
}

interface Envelope<T> {
  code: number
  msg?: string
  data: T
}

export class ConflictError extends Error {
  readonly contentHash?: string
  readonly updateTime?: string

  constructor(message: string, data: { contentHash?: string; updateTime?: string } = {}) {
    super(message)
    this.name = 'ConflictError'
    this.contentHash = data.contentHash
    this.updateTime = data.updateTime
  }
}

/** Sends an API request and unwraps the backend response envelope. */
export function createRequest(
  config: () => RequestConnection,
  onUnauthorized: () => void,
  transport: typeof fetch = fetch,
  refresh?: () => Promise<boolean>,
) {
  return async function request<T>(
    path: string,
    init: RequestInit = {},
    authenticated = true,
    retried = false,
  ): Promise<T> {
    const { server, clientId, token } = config()
    const headers: Record<string, string> = {
      'Content-Language': contentLanguage(),
      clientid: clientId,
      ...(authenticated && token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    }
    const response = await transport(`${server.replace(/\/+$/, '')}${path}`, {
      ...init,
      headers: { ...headers, ...init.headers },
    })
    const result = normalizeIds(await response.json()) as Envelope<T> & Partial<{ rows: unknown[] }>
    if (result.code === 409) {
      const data = (result.data ?? {}) as { contentHash?: string; updateTime?: string }
      throw new ConflictError(result.msg || t('conflict.fallback'), data)
    }
    if (response.status === 401 || result.code === 401) {
      // 已认证请求在首次 401 时尝试用刷新令牌续期，成功后重放一次原请求
      if (authenticated && !retried && refresh) {
        const refreshed = await refresh()
        if (refreshed) {
          return request<T>(path, init, authenticated, true)
        }
      }
      onUnauthorized()
      throw new Error(result.msg || t('session.expired'))
    }
    if (!response.ok || result.code !== 200) throw new Error(result.msg || t('common.requestFailedStatus', { status: response.status }))
    return ('rows' in result ? result : result.data) as T
  }
}
