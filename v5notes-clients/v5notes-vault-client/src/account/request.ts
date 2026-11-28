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

/** Quote unquoted 16+ digit integer tokens before JSON.parse so 64-bit snowflake IDs never lose precision. */
function quoteLargeIntegers(raw: string): string {
  return raw.replace(
    /("(?:\\.|[^"\\])*")|(:[\s]*)(-?\d{16,})(?=[,\s}\]])/g,
    (match, str: string | undefined, colon: string | undefined, num: string | undefined) => {
      if (str !== undefined) return str
      return `${colon}"${num}"`
    },
  )
}

async function parseJsonPreservingIds(response: Response): Promise<unknown> {
  if (typeof response.text === 'function') {
    const raw = await response.text()
    try {
      return normalizeIds(JSON.parse(quoteLargeIntegers(raw)))
    } catch {
      throw new Error(`服务端返回非 JSON 响应（HTTP ${response.status}）`)
    }
  }
  return normalizeIds(await response.json())
}
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
    const result = await parseJsonPreservingIds(response) as Envelope<T>
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
