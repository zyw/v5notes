import { describe, expect, it, vi } from 'vitest'
import {
  assertUrlAllowed,
  hostMatchesAllowlist,
  safeNetworkRequest,
  validateAllowlist,
} from './networkSafe'

describe('networkSafe allowlist', () => {
  it('matches exact and wildcard hosts', () => {
    expect(hostMatchesAllowlist('api.example.com', ['api.example.com'])).toBe(true)
    expect(hostMatchesAllowlist('api.example.com', ['*.example.com'])).toBe(true)
    expect(hostMatchesAllowlist('example.com', ['*.example.com'])).toBe(true)
    expect(hostMatchesAllowlist('evil.com', ['*.example.com'])).toBe(false)
    expect(hostMatchesAllowlist('notexample.com', ['*.example.com'])).toBe(false)
  })

  it('requires non-empty allowlist', () => {
    expect(() => validateAllowlist([])).toThrow(/networkAllowlist/)
    expect(() => validateAllowlist(undefined)).toThrow(/networkAllowlist/)
  })

  it('rejects non-allowlisted and publish-like paths', () => {
    expect(() => assertUrlAllowed('https://evil.com/x', ['api.example.com'])).toThrow(/白名单/)
    expect(() =>
      assertUrlAllowed('https://api.example.com/wp-json/wp/v2/posts', ['api.example.com']),
    ).toThrow(/发布/)
  })
})

describe('safeNetworkRequest', () => {
  it('allows GET to allowlisted host', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('hello', { status: 200, headers: { 'content-type': 'text/plain' } }),
    )
    const res = await safeNetworkRequest('https://api.example.com/dict?q=a', ['api.example.com'], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(res.ok).toBe(true)
    expect(res.text).toBe('hello')
    expect(fetchImpl).toHaveBeenCalledOnce()
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[1].redirect).toBe('manual')
  })

  it('rejects non-allowlisted host', async () => {
    await expect(
      safeNetworkRequest('https://evil.test/x', ['api.example.com'], {
        fetchImpl: vi.fn() as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/白名单/)
  })

  it('blocks redirect escape off allowlist', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { Location: 'https://evil.test/steal' } }),
      )
    await expect(
      safeNetworkRequest('https://api.example.com/go', ['api.example.com'], {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/白名单/)
  })

  it('follows redirect within allowlist', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: 'https://cdn.example.com/data.json' },
        }),
      )
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }))
    const res = await safeNetworkRequest('https://api.example.com/go', ['*.example.com'], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(res.text).toBe('{"ok":true}')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('allows POST to allowlist with body size cap', async () => {
    const fetchImpl = vi.fn(async () => new Response('ok', { status: 200 }))
    await safeNetworkRequest('https://api.example.com/translate', ['api.example.com'], {
      method: 'POST',
      body: '{"text":"hi"}',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(fetchImpl).toHaveBeenCalledOnce()

    await expect(
      safeNetworkRequest('https://api.example.com/translate', ['api.example.com'], {
        method: 'POST',
        body: 'x'.repeat(70_000),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/POST body/)
  })

  it('enforces response size limit', async () => {
    const big = 'y'.repeat(2000)
    const fetchImpl = vi.fn(async () => new Response(big, { status: 200 }))
    await expect(
      safeNetworkRequest('https://api.example.com/x', ['api.example.com'], {
        maxResponseBytes: 100,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/响应超过/)
  })
})
