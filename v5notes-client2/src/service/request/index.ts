import { normalizeIds } from '../../utils/identity'

export interface RequestConnection {
  server: string
  clientId: string
  token: string
}

interface Envelope<T> {
  code: number
  msg?: string
  data: T
}

/** Sends an API request and unwraps the backend response envelope. */
export function createRequest(
  config: () => RequestConnection,
  onUnauthorized: () => void,
  transport: typeof fetch = fetch,
) {
  return async function request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
    const { server, clientId, token } = config()
    const headers: Record<string, string> = {
      'Content-Language': 'zh_CN',
      clientid: clientId,
      ...(authenticated && token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    }
    const response = await transport(`${server.replace(/\/+$/, '')}${path}`, {
      ...init,
      headers: { ...headers, ...init.headers },
    })
    const result = normalizeIds(await response.json()) as Envelope<T> & Partial<{ rows: unknown[] }>
    if (response.status === 401 || result.code === 401) {
      onUnauthorized()
      throw new Error(result.msg || '登录已过期，请重新登录')
    }
    if (!response.ok || result.code !== 200) throw new Error(result.msg || `请求失败 (${response.status})`)
    return ('rows' in result ? result : result.data) as T
  }
}
