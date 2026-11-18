/**
 * Phase 7 `network:safe` proxy — allowlist hosts, method limits, size caps, no redirect escape.
 * Not a process sandbox: policy + proxy only (design §7.4).
 */

export const DEFAULT_MAX_RESPONSE_BYTES = 1_048_576 // 1 MiB
export const DEFAULT_MAX_POST_BODY_BYTES = 65_536 // 64 KiB
export const MAX_REDIRECTS = 5

/** Path patterns that look like publish / CMS push pipelines. */
const PUBLISH_PATH_RE =
  /\/(publish|deploy|wp-json\/wp\/v2\/posts|ghost\/api|notion\.com\/v1\/pages|blogs?\/(create|post)|static-?site)/i

export type SafeMethod = 'GET' | 'HEAD' | 'POST'

export interface NetworkSafeRequestInit {
  method?: SafeMethod
  headers?: Record<string, string>
  body?: string
  maxResponseBytes?: number
  maxPostBodyBytes?: number
  /** Injected for tests. */
  fetchImpl?: typeof fetch
}

export interface NetworkSafeResponse {
  ok: boolean
  status: number
  headers: Record<string, string>
  text: string
}

export function hostMatchesAllowlist(hostname: string, allowlist: string[]): boolean {
  const host = hostname.toLowerCase()
  for (const entry of allowlist) {
    const rule = entry.trim().toLowerCase()
    if (!rule) continue
    if (rule.startsWith('*.')) {
      const suffix = rule.slice(2)
      if (!suffix) continue
      if (host === suffix || host.endsWith(`.${suffix}`)) return true
      continue
    }
    if (host === rule) return true
  }
  return false
}

export function validateAllowlist(allowlist: string[] | undefined): string[] {
  if (!allowlist || allowlist.length === 0) {
    throw new Error('network:safe 需要非空 networkAllowlist')
  }
  const cleaned = allowlist.map((h) => h.trim()).filter(Boolean)
  if (!cleaned.length) {
    throw new Error('network:safe 需要非空 networkAllowlist')
  }
  for (const h of cleaned) {
    if (h.includes('/') || h.includes(':') || h.includes(' ')) {
      throw new Error(`networkAllowlist 项无效（仅 host 或 *.domain）: ${h}`)
    }
  }
  return cleaned
}

export function assertUrlAllowed(urlString: string, allowlist: string[]): URL {
  let url: URL
  try {
    url = new URL(urlString)
  } catch {
    throw new Error(`非法 URL: ${urlString}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`仅允许 http/https: ${url.protocol}`)
  }
  if (!hostMatchesAllowlist(url.hostname, allowlist)) {
    throw new Error(`host 不在白名单: ${url.hostname}`)
  }
  if (PUBLISH_PATH_RE.test(url.pathname)) {
    throw new Error('拒绝疑似发布类 endpoint（第三方无 publish）')
  }
  return url
}

function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value
  })
  return out
}

async function readBodyCapped(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) {
    const text = await response.text()
    if (utf8ByteLength(text) > maxBytes) {
      throw new Error(`响应超过大小上限 ${maxBytes} 字节`)
    }
    return text
  }
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      total += value.byteLength
      if (total > maxBytes) {
        reader.cancel().catch(() => undefined)
        throw new Error(`响应超过大小上限 ${maxBytes} 字节`)
      }
      chunks.push(value)
    }
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    merged.set(c, offset)
    offset += c.byteLength
  }
  return new TextDecoder().decode(merged)
}

/**
 * Proxied request for plugins with `network:safe`.
 * - Host must be on allowlist (exact or `*.domain`)
 * - Methods: GET/HEAD default; POST allowed only to allowlisted hosts with body size cap
 * - Redirects: manual follow; each hop re-checked against allowlist
 * - No unrestricted network; publish-like paths rejected
 */
export async function safeNetworkRequest(
  urlString: string,
  allowlist: string[],
  init: NetworkSafeRequestInit = {},
): Promise<NetworkSafeResponse> {
  const hosts = validateAllowlist(allowlist)
  const method = (init.method || 'GET').toUpperCase() as SafeMethod
  if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') {
    throw new Error(`不允许的方法: ${method}`)
  }

  const maxResponse = init.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES
  const maxPost = init.maxPostBodyBytes ?? DEFAULT_MAX_POST_BODY_BYTES
  const fetchImpl = init.fetchImpl ?? fetch

  let body = init.body
  if (method === 'POST') {
    if (body == null) body = ''
    if (utf8ByteLength(body) > maxPost) {
      throw new Error(`POST body 超过上限 ${maxPost} 字节`)
    }
    // Soft guard against silent full-vault exfil shapes in a single request body.
    if (/"path"\s*:\s*"[\s\S]{0,40}\.md"/i.test(body) && body.split('.md').length > 20) {
      throw new Error('拒绝疑似整库批量外传的 POST 载荷')
    }
  } else if (body != null && body.length > 0) {
    throw new Error(`${method} 不得携带 body`)
  }

  let current = assertUrlAllowed(urlString, hosts)
  let redirects = 0

  for (;;) {
    const response = await fetchImpl(current.toString(), {
      method,
      headers: init.headers,
      body: method === 'POST' ? body : undefined,
      redirect: 'manual',
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location') || response.headers.get('location')
      if (!location) {
        throw new Error(`重定向缺少 Location (${response.status})`)
      }
      redirects += 1
      if (redirects > MAX_REDIRECTS) {
        throw new Error('重定向次数过多')
      }
      const next = new URL(location, current)
      current = assertUrlAllowed(next.toString(), hosts)
      continue
    }

    const text =
      method === 'HEAD' ? '' : await readBodyCapped(response, maxResponse)

    return {
      ok: response.ok,
      status: response.status,
      headers: headersToRecord(response.headers),
      text,
    }
  }
}
