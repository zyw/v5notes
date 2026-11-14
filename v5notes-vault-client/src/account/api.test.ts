import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAccountApi } from './api'
import { DEVICE_TYPE } from './constants'

vi.mock('./loginCrypto', () => ({
  encryptLogin: (body: string) => ({ body, key: 'k' }),
}))

describe('createAccountApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends deviceType=vault_client on password login', async () => {
    const transport = vi.fn(async (_url: string, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body ?? '{}')) as { deviceType?: string; grantType?: string }
      expect(payload.deviceType).toBe(DEVICE_TYPE)
      expect(payload.grantType).toBe('clientPassword')
      return new Response(JSON.stringify({ code: 200, data: { access_token: 'tok', refresh_token: 'ref' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })

    const api = createAccountApi(
      () => ({ server: 'https://example.test', clientId: 'vault-client', token: '', refreshToken: '' }),
      () => {},
      transport as unknown as typeof fetch,
    )
    const result = await api.login('alice', 'Secret1!')
    expect(result.access_token).toBe('tok')
    expect(transport).toHaveBeenCalled()
  })

  it('requests social authorize with app=vault', async () => {
    const transport = vi.fn(async (url: string) => {
      expect(String(url)).toContain('/auth/binding/gitee?')
      expect(String(url)).toContain('app=vault')
      return new Response(JSON.stringify({ code: 200, data: 'https://gitee.com/oauth/authorize' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    const api = createAccountApi(
      () => ({ server: 'https://example.test', clientId: 'vault-client', token: '', refreshToken: '' }),
      () => {},
      transport as unknown as typeof fetch,
    )
    await expect(api.socialAuthUrl('gitee')).resolves.toContain('gitee.com')
  })
})
