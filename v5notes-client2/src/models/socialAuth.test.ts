import { describe, expect, it } from 'vitest'
import { mapSocialLoginErrorKey, readSocialCallbackParams } from './socialAuth'

describe('socialAuth', () => {
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

  it('maps known social login errors', () => {
    expect(mapSocialLoginErrorKey('该邮箱已注册，请使用密码登录后绑定第三方账号')).toBe('login.socialEmailOccupied')
    expect(mapSocialLoginErrorKey('当前没有开启客户端第三方登录')).toBe('login.socialOff')
    expect(mapSocialLoginErrorKey('当前没有开启客户端注册功能')).toBe('login.socialDisabled')
    expect(mapSocialLoginErrorKey('something else')).toBeNull()
  })
})
