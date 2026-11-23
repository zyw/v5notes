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
export async function downloadAttachment(
  descriptor: DownloadDescriptor,
  options: DownloadOptions = {},
): Promise<Uint8Array> {
  const transport = options.transport ?? fetch
  const url = absoluteUrl(descriptor, options.baseUrl)
  const previous = options.previous && options.previous.byteLength > 0 ? options.previous : undefined
  const canResume = Boolean(descriptor.supportsRange) && Boolean(previous)
  const retries = options.retries ?? 2

  const headers: Record<string, string> = {}
  // Proxy mode talks to our own endpoint, which authenticates like every other vault call.
  if (options.token && descriptor.mode !== 'direct') {
    headers.Authorization = `Bearer ${options.token}`
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
        return new Uint8Array(await response.arrayBuffer())
      }
      // A resume that the backend refuses (416) is not worth retrying: start over instead.
      if (response.status === 416 && canResume) {
        return downloadAttachment(descriptor, { ...options, previous: undefined })
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
