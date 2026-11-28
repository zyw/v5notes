/**
 * Attachment download with resume and integrity check (design §5.4).
 *
 * <p>The server hands back a descriptor, never bytes: {@code direct} URLs point at object storage,
 * {@code proxy} URLs point back at our own streaming endpoint. Only the auth header differs, so the
 * resume/verify logic is shared.</p>
 */

export interface DownloadDescriptor {
  mode: 'direct' | 'proxy' | string
  url: string
  expiresIn?: number
  supportsRange?: boolean
}

export interface DownloadOptions {
  /** Resolves relative proxy paths against the configured server. */
  baseUrl?: string
  /** Bearer token, required for proxy mode. */
  token?: string
  /** Client id paired with the token, required by Sa-Token on proxy endpoints. */
  clientId?: string
  /** Invoked when the proxy endpoint rejects the session (HTTP 401 or 200 JSON code 401). */
  onUnauthorized?: () => void
  /** Bytes already on disk for resuming; range requests start here. */
  previous?: Uint8Array
  transport?: typeof fetch
  /** Attempts after a transient failure; resumable downloads retry twice (H6). */
  retries?: number
}

export class DownloadError extends Error {
  readonly retryable: boolean

  constructor(message: string, retryable = true) {
    super(message)
    this.name = 'DownloadError'
    this.retryable = retryable
  }
}

function absoluteUrl(descriptor: DownloadDescriptor, baseUrl?: string): string {
  if (/^https?:\/\//i.test(descriptor.url)) return descriptor.url
  const base = (baseUrl ?? '').replace(/\/+$/, '')
  return `${base}${descriptor.url.startsWith('/') ? '' : '/'}${descriptor.url}`
}

/**
 * Fetches an attachment body.
 *
 * <p>Resumes from {@code previous} when the descriptor advertises range support: the request asks
 * for {@code bytes=<n>-} and the result is concatenated. A full sha-256 check runs upstream in the
 * engine; this module only guarantees "as much as was asked for, no more".</p>
 */
function isSameOriginAsBase(resolvedUrl: string, baseUrl?: string): boolean {
  if (!baseUrl) return !/^https?:\/\//i.test(resolvedUrl)
  try {
    return new URL(resolvedUrl).origin === new URL(baseUrl).origin
  } catch {
    return false
  }
}

const MAX_PROXY_ERROR_ENVELOPE_BYTES = 16 * 1024

/**
 * SaTokenExceptionHandler and global advices return HTTP 200 with a JSON `R` envelope
 * (`{"code":401,"msg":"..."}`) instead of raw bytes. Genuine `.json` attachments streamed
 * by VaultAssetController always carry `X-Content-Hash`, so they are never treated as errors.
 */
function parseProxyErrorEnvelope(
  response: Response,
  bytes: Uint8Array,
): { code: number; msg: string } | null {
  if (response.headers?.get('X-Content-Hash')) return null
  const contentType = (response.headers?.get('Content-Type') ?? '').toLowerCase()
  if (!contentType.includes('application/json')) return null
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PROXY_ERROR_ENVELOPE_BYTES) return null
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as {
      code?: unknown
      msg?: unknown
    }
    if (parsed && typeof parsed === 'object' && typeof parsed.code === 'number' && parsed.code !== 200) {
      return {
        code: parsed.code,
        msg: typeof parsed.msg === 'string' ? parsed.msg : '',
      }
    }
  } catch {
    return null
  }
  return null
}

export async function downloadAttachment(
  descriptor: DownloadDescriptor,
  options: DownloadOptions = {},
): Promise<Uint8Array> {
  const transport = options.transport ?? fetch
  const url = absoluteUrl(descriptor, options.baseUrl)
  const previous = options.previous && options.previous.byteLength > 0 ? options.previous : undefined
  const canResume = Boolean(descriptor.supportsRange) && Boolean(previous)
  const retries = options.retries ?? 2

  const isProxyAuthTarget =
    descriptor.mode !== 'direct'
    && (!/^https?:\/\//i.test(descriptor.url) || isSameOriginAsBase(url, options.baseUrl))

  const headers: Record<string, string> = {}
  // Proxy mode talks to our own endpoint; never send bearer token or clientid to third-party origins.
  if (isProxyAuthTarget) {
    if (options.token) headers.Authorization = `Bearer ${options.token}`
    if (options.clientId) headers.clientid = options.clientId
  }
  if (canResume) {
    headers.Range = `bytes=${previous!.byteLength}-`
  }

  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await transport(url, { method: 'GET', headers })
      if (response.status === 206 && canResume) {
        const tail = new Uint8Array(await response.arrayBuffer())
        const merged = new Uint8Array(previous!.byteLength + tail.byteLength)
        merged.set(previous!, 0)
        merged.set(tail, previous!.byteLength)
        return merged
      }
      if (response.status === 200) {
        const bytes = new Uint8Array(await response.arrayBuffer())
        if (isProxyAuthTarget) {
          const envelope = parseProxyErrorEnvelope(response, bytes)
          if (envelope) {
            if (envelope.code === 401) {
              options.onUnauthorized?.()
              throw new DownloadError(envelope.msg || '登录已过期', false)
            }
            const retryable = envelope.code >= 500 || envelope.code === 429
            throw new DownloadError(envelope.msg || `下载失败（${envelope.code}）`, retryable)
          }
        }
        return bytes
      }
      // A resume that the backend refuses (416) is not worth retrying: start over instead.
      if (response.status === 416 && canResume) {
        return downloadAttachment(descriptor, { ...options, previous: undefined })
      }
      if (response.status === 401 && isProxyAuthTarget) {
        options.onUnauthorized?.()
      }
      const body = await response.text().catch(() => '')
      const retryable = response.status >= 500 || response.status === 429
      throw new DownloadError(body || `下载失败（HTTP ${response.status}）`, retryable)
    } catch (err) {
      lastError = err
      if (err instanceof DownloadError && !err.retryable) throw err
      if (attempt === retries) break
    }
  }
  throw lastError instanceof Error ? lastError : new DownloadError('下载失败')
}
