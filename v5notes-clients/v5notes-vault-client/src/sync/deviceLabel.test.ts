import { describe, expect, it } from 'vitest'
import { buildDeviceLabel, describeDeviceLabel, detectPlatform } from './deviceLabel'

const UA = {
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)',
  win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)',
  android: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko)',
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
}

describe('device label sent on bind', () => {
  it('names the product and the platform instead of a build stage', () => {
    expect(buildDeviceLabel(UA.mac)).toBe('V5Notes Vault · macOS')
    expect(buildDeviceLabel(UA.win)).toBe('V5Notes Vault · Windows')
    expect(buildDeviceLabel(UA.android)).toBe('V5Notes Vault · Android')
    expect(buildDeviceLabel(UA.ios)).toBe('V5Notes Vault · iOS')
  })

  it('falls back to the product name when the platform is unknown', () => {
    expect(detectPlatform(undefined)).toBeNull()
    expect(buildDeviceLabel(null)).toBe('V5Notes Vault')
  })
})

describe('fallback UA ordering', () => {
  it('reads Android before Linux, iOS before macOS', () => {
    expect(detectPlatform(UA.android)).toBe('android')
    expect(detectPlatform(UA.ios)).toBe('ios')
    expect(detectPlatform(UA.linux)).toBe('linux')
  })
})

describe('rendering a stored label', () => {
  it('splits name and platform', () => {
    expect(describeDeviceLabel('V5Notes Vault · macOS')).toEqual({
      name: 'V5Notes Vault',
      platform: 'macOS',
      recognised: true,
    })
  })

  it('flags the old build-stage literal as legacy instead of showing it as a name', () => {
    expect(describeDeviceLabel('v5notes-vault-client/phase5')).toEqual({
      name: 'v5notes-vault-client/phase5',
      platform: null,
      recognised: false,
      legacy: true,
    })
    expect(describeDeviceLabel(null)).toEqual({ name: '', platform: null, recognised: false })
  })

  it('keeps a vault name that itself contains the separator', () => {
    expect(describeDeviceLabel('随笔 · 读书')).toEqual({
      name: '随笔 · 读书',
      platform: null,
      recognised: false,
    })
  })

  it('keeps a free-form label as its name', () => {
    expect(describeDeviceLabel('我的 MacBook')).toEqual({
      name: '我的 MacBook',
      platform: null,
      recognised: false,
    })
  })
})
