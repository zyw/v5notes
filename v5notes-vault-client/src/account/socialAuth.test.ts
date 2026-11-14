import { describe, expect, it } from 'vitest'
import { readSocialCallbackParams } from './socialAuth'

describe('vault social callback', () => {
  it('reads OAuth params from v5notes-vault deep link', () => {
    expect(
      readSocialCallbackParams(
        'v5notes-vault://app/social-callback?source=gitee&code=abc&state=xyz',
      ),
    ).toEqual({ source: 'gitee', code: 'abc', state: 'xyz' })
  })

  it('reads OAuth params from http landing path', () => {
    expect(
      readSocialCallbackParams(
        'http://127.0.0.1:8088/social-callback?source=github&code=c1&state=s1',
      ),
    ).toEqual({ source: 'github', code: 'c1', state: 's1' })
  })

  it('rejects incomplete callbacks', () => {
    expect(readSocialCallbackParams('v5notes-vault://app/social-callback?source=gitee')).toBeNull()
  })
})
