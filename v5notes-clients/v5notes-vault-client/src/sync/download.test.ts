import { describe, expect, it, vi } from 'vitest'
import { DownloadError, downloadAttachment } from './download'

function bodyOf(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer
}

describe('downloadAttachment', () => {
  it('fetches a direct link without the bearer token or clientid', async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = []
    const transport = (async (url: string, init?: RequestInit) => {
      calls.push({ url, headers: (init?.headers as Record<string, string>) ?? {} })
      return new Response(bodyOf('hello'), { status: 200 })
    }) as unknown as typeof fetch

    const bytes = await downloadAttachment(
      { mode: 'direct', url: 'https://oss.example/a.png' },
      { transport, token: 'secret', clientId: 'cid-1' },
    )

    expect(new TextDecoder().decode(bytes)).toBe('hello')
    expect(calls[0].url).toBe('https://oss.example/a.png')
    // Direct links carry their own signature; sending our token or clientid would leak them to the bucket host.
    expect(calls[0].headers.Authorization).toBeUndefined()
    expect(calls[0].headers.clientid).toBeUndefined()
  })

  it('authenticates proxy requests with token and clientid and resolves relative paths (H4)', async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = []
    const transport = (async (url: string, init?: RequestInit) => {
      calls.push({ url, headers: (init?.headers as Record<string, string>) ?? {} })
      return new Response(bodyOf('proxied'), { status: 200 })
    }) as unknown as typeof fetch

    await downloadAttachment(
      { mode: 'proxy', url: '/vault/v1/vaults/1/assets/9/content' },
      { transport, token: 'tok', clientId: 'cid-1', baseUrl: 'https://api.example' },
    )

    expect(calls[0].url).toBe('https://api.example/vault/v1/vaults/1/assets/9/content')
    expect(calls[0].headers.Authorization).toBe('Bearer tok')
    expect(calls[0].headers.clientid).toBe('cid-1')
  })

  it('treats proxy HTTP 200 JSON 401 envelope as non-retryable auth failure', async () => {
    let attempts = 0
    const onUnauthorized = vi.fn()
    const transport = (async () => {
      attempts += 1
      return new Response(JSON.stringify({ code: 401, msg: '认证失败，无法访问系统资源', data: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as unknown as typeof fetch

    let caught: unknown
    try {
      await downloadAttachment(
        { mode: 'proxy', url: '/vault/v1/vaults/1/assets/9/content' },
        { transport, token: 'tok', clientId: 'cid-1', baseUrl: 'https://api.example', onUnauthorized },
      )
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(DownloadError)
    expect((caught as DownloadError).message).toBe('认证失败，无法访问系统资源')
    expect((caught as DownloadError).retryable).toBe(false)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(attempts).toBe(1)
  })

  it('returns genuine JSON attachment bytes when X-Content-Hash header is present', async () => {
    const payload = JSON.stringify({ code: 401 })
    const onUnauthorized = vi.fn()
    const transport = (async () => {
      return new Response(bodyOf(payload), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Content-Hash': '0'.repeat(64),
        },
      })
    }) as unknown as typeof fetch

    const bytes = await downloadAttachment(
      { mode: 'proxy', url: '/vault/v1/vaults/1/assets/9/content' },
      { transport, token: 'tok', clientId: 'cid-1', baseUrl: 'https://api.example', onUnauthorized },
    )

    expect(new TextDecoder().decode(bytes)).toBe(payload)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('resumes from the partial bytes with a Range header (H5)', async () => {
    const calls: Array<{ headers: Record<string, string> }> = []
    const transport = (async (_url: string, init?: RequestInit) => {
      const headers = (init?.headers as Record<string, string>) ?? {}
      calls.push({ headers })
      return new Response(bodyOf('world'), { status: 206 })
    }) as unknown as typeof fetch

    const bytes = await downloadAttachment(
      { mode: 'proxy', url: '/x', supportsRange: true },
      { transport, token: 't', baseUrl: 'https://api', previous: new TextEncoder().encode('hello ') },
    )

    expect(calls[0].headers.Range).toBe('bytes=6-')
    expect(new TextDecoder().decode(bytes)).toBe('hello world')
  })

  it('does not ask for a range when the descriptor forbids it', async () => {
    let sawRange = false
    const transport = (async (_url: string, init?: RequestInit) => {
      const headers = (init?.headers as Record<string, string>) ?? {}
      sawRange = Boolean(headers.Range)
      return new Response(bodyOf('full'), { status: 200 })
    }) as unknown as typeof fetch

    await downloadAttachment(
      { mode: 'proxy', url: '/x', supportsRange: false },
      { transport, token: 't', baseUrl: 'https://api', previous: new TextEncoder().encode('hello ') },
    )

    expect(sawRange).toBe(false)
  })

  it('restarts from scratch when the backend rejects the range (416)', async () => {
    let attempt = 0
    const transport = (async (_url: string, init?: RequestInit) => {
      attempt += 1
      const headers = (init?.headers as Record<string, string>) ?? {}
      if (headers.Range) return new Response('', { status: 416 })
      return new Response(bodyOf('restarted'), { status: 200 })
    }) as unknown as typeof fetch

    const bytes = await downloadAttachment(
      { mode: 'proxy', url: '/x', supportsRange: true },
      { transport, token: 't', baseUrl: 'https://api', previous: new TextEncoder().encode('stale') },
    )

    expect(attempt).toBe(2)
    expect(new TextDecoder().decode(bytes)).toBe('restarted')
  })

  it('gives up after the configured retries on server errors (H6)', async () => {
    let attempts = 0
    const transport = (async () => {
      attempts += 1
      return new Response('boom', { status: 500 })
    }) as unknown as typeof fetch

    await expect(
      downloadAttachment({ mode: 'proxy', url: '/x' }, { transport, token: 't', baseUrl: 'https://api' }),
    ).rejects.toThrow()
    expect(attempts).toBe(3)
  })

  it('does not retry a permanent client error', async () => {
    let attempts = 0
    const transport = (async () => {
      attempts += 1
      return new Response('gone', { status: 404 })
    }) as unknown as typeof fetch

    await expect(
      downloadAttachment({ mode: 'proxy', url: '/x' }, { transport, token: 't', baseUrl: 'https://api' }),
    ).rejects.toThrow()
    expect(attempts).toBe(1)
  })
})
