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

/** 将响应中疑似雪花 ID 的 number 转 string，避免精度丢失。 */
function normalizeIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeIds)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (typeof item === 'number' && Number.isSafeInteger(item) === false) {
        out[key] = String(item)
      } else {
        out[key] = normalizeIds(item)
      }
    }
    return out
  }
  return value
}

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
      'Content-Language': 'zh_CN',
      clientid: clientId,
      ...(authenticated && token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    }
    const response = await transport(`${server.replace(/\/+$/, '')}${path}`, {
      ...init,
      headers: { ...headers, ...init.headers },
    })
    const result = normalizeIds(await response.json()) as Envelope<T>
    if (response.status === 401 || result.code === 401) {
      if (authenticated && !retried && refresh) {
        const refreshed = await refresh()
        if (refreshed) return request<T>(path, init, authenticated, true)
      }
      onUnauthorized()
      throw new Error(result.msg || '登录已过期，请重新登录')
    }
    if (!response.ok || result.code !== 200) {
      throw new Error(result.msg || `请求失败（${response.status}）`)
    }
    return result.data as T
  }
}
