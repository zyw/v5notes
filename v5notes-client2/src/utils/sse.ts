/** fetch + Header 鉴权的 SSE，避免 EventSource 把 token 放进 URL。 */

export interface FetchSseOptions {
  url: string
  headers?: Record<string, string>
  onMessage: (data: string) => void
  onError?: (error: unknown) => void
  retries?: number
  retryDelayMs?: number
}

export function openFetchSse(options: FetchSseOptions): { close: () => void } {
  const retries = options.retries ?? 5
  const retryDelayMs = options.retryDelayMs ?? 5000
  let closed = false
  let attempt = 0
  let controller: AbortController | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = undefined
    }
  }

  const scheduleReconnect = () => {
    if (closed || attempt >= retries) return
    attempt += 1
    clearRetry()
    retryTimer = setTimeout(() => {
      retryTimer = undefined
      void connect()
    }, retryDelayMs)
  }

  const connect = async () => {
    if (closed) return
    controller?.abort()
    controller = new AbortController()
    try {
      const response = await fetch(options.url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          ...options.headers,
        },
        signal: controller.signal,
      })
      if (!response.ok || !response.body) throw new Error(`SSE ${response.status}`)
      attempt = 0
      await readSseStream(response.body, options.onMessage, controller.signal)
      if (!closed) scheduleReconnect()
    } catch (error) {
      if (closed || (error instanceof DOMException && error.name === 'AbortError')) return
      options.onError?.(error)
      scheduleReconnect()
    }
  }

  void connect()
  return {
    close() {
      closed = true
      clearRetry()
      controller?.abort()
      controller = undefined
    },
  }
}

async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onMessage: (data: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let eventName = 'message'
  let dataLines: string[] = []

  const dispatch = () => {
    if (dataLines.length > 0 && eventName === 'message') onMessage(dataLines.join('\n'))
    eventName = 'message'
    dataLines = []
  }

  try {
    while (true) {
      if (signal.aborted) {
        await reader.cancel()
        return
      }
      const { done, value } = await reader.read()
      if (done) {
        dispatch()
        return
      }
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line === '') {
          dispatch()
          continue
        }
        if (line.startsWith(':')) continue
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim() || 'message'
          continue
        }
        if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''))
      }
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // ignore
    }
  }
}
