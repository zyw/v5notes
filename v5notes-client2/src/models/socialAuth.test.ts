import { beforeEach, describe, expect, it } from 'vitest'
import {
  isSocialCodeConsumed,
  mapSocialLoginErrorKey,
  markSocialCodeConsumed,
  normalizeSocialSource,
  providerLabelKey,
  readSocialCallbackParams,
} from './socialAuth'

describe('socialAuth', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    const memoryStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
      removeItem: (key: string) => { store.delete(key) },
      clear: () => { store.clear() },
    }
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: memoryStorage,
    })
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: memoryStorage,
    })
  })

  it('reads OAuth callback query from /social-callback', () => {
    const params = readSocialCallbackParams(
      'http://127.0.0.1:1420/social-callback?source=gitee&code=abc&state=xyz',
    )
    expect(params).toEqual({ source: 'gitee', code: 'abc', state: 'xyz' })
  })

  it('reads deep link callback URLs', () => {
    expect(readSocialCallbackParams(
      'v5notes://app/social-callback?source=github&code=c1&state=s1',
    )).toEqual({ source: 'github', code: 'c1', state: 's1' })
  })

  it('ignores non-callback URLs even with code', () => {
    expect(readSocialCallbackParams('http://127.0.0.1:1420/?code=abc&state=xyz&source=gitee')).toBeNull()
  })

  it('normalizes JustAuth enum-style sources for labels', () => {
    expect(normalizeSocialSource('GITEE')).toBe('gitee')
    expect(providerLabelKey('GITEE')).toBe('login.socialGitee')
    expect(providerLabelKey('unknown_x')).toBe('login.socialUnknown')
  })

  it('tracks consumed OAuth codes to prevent refresh replay', () => {
    expect(isSocialCodeConsumed('code-1', 'state-1')).toBe(false)
    markSocialCodeConsumed('code-1', 'state-1')
    expect(isSocialCodeConsumed('code-1', 'state-1')).toBe(true)
  })

  it('maps known social login errors', () => {
    expect(mapSocialLoginErrorKey('该邮箱已注册，请使用密码登录后绑定第三方账号')).toBe('login.socialEmailOccupied')
    expect(mapSocialLoginErrorKey('当前没有开启客户端第三方登录')).toBe('login.socialOff')
    expect(mapSocialLoginErrorKey('当前没有开启客户端注册功能')).toBe('login.socialDisabled')
    expect(mapSocialLoginErrorKey('Failed to login with oauth authorization.')).toBe('login.socialCodeReuse')
    expect(mapSocialLoginErrorKey('Illegal state [GITEE]')).toBe('login.socialCodeReuse')
    expect(mapSocialLoginErrorKey('something else')).toBeNull()
  })
})
