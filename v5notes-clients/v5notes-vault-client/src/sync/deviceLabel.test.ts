import { describe, expect, it } from 'vitest'
import { buildDeviceLabel, buildVaultDeviceLabel, describeDeviceLabel, detectPlatform } from './deviceLabel'

const UA = {
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)',
  win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)',
  android: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko)',
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
}

const DEVICE = '3fa2c1d4-0b7e-4a55-9c1e-2f6d8a9b0c11'

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

describe('vault label sent on bind', () => {
  it('names the library, the platform, and this machine', () => {
    expect(buildVaultDeviceLabel('测试4', DEVICE, UA.mac)).toBe('测试4 · macOS · 3fa2c1')
  })

  it('keeps the device segment without a known platform', () => {
    expect(buildVaultDeviceLabel('测试4', DEVICE, null)).toBe('测试4 · 3fa2c1')
  })

  it('gives two machines with the same library name different labels', () => {
    const other = '91bb00aa-1111-4222-8333-444455556666'
    expect(buildVaultDeviceLabel('测试4', DEVICE, UA.mac))
      .not.toBe(buildVaultDeviceLabel('测试4', other, UA.mac))
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
  it('splits name, platform, and device', () => {
    expect(describeDeviceLabel('测试4 · macOS · 3fa2c1')).toEqual({
      name: '测试4',
      platform: 'macOS',
      deviceShort: '3fa2c1',
      recognised: true,
    })
  })

  it('reads a label written before device segments existed', () => {
    expect(describeDeviceLabel('V5Notes Vault · macOS')).toEqual({
      name: 'V5Notes Vault',
      platform: 'macOS',
      deviceShort: null,
      recognised: true,
    })
  })

  it('flags the old build-stage literal as legacy instead of showing it as a name', () => {
    expect(describeDeviceLabel('v5notes-vault-client/phase5')).toEqual({
      name: 'v5notes-vault-client/phase5',
      platform: null,
      deviceShort: null,
      recognised: false,
      legacy: true,
    })
    expect(describeDeviceLabel(null)).toEqual({
      name: '',
      platform: null,
      deviceShort: null,
      recognised: false,
    })
  })

  it('keeps a vault name that itself contains the separator', () => {
    expect(describeDeviceLabel('随笔 · 读书')).toEqual({
      name: '随笔 · 读书',
      platform: null,
      deviceShort: null,
      recognised: false,
    })
    expect(describeDeviceLabel('随笔 · 读书 · 3fa2c1')).toEqual({
      name: '随笔 · 读书',
      platform: null,
      deviceShort: '3fa2c1',
      recognised: true,
    })
  })

  it('keeps a free-form label as its name', () => {
    expect(describeDeviceLabel('我的 MacBook')).toEqual({
      name: '我的 MacBook',
      platform: null,
      deviceShort: null,
      recognised: false,
    })
  })
})
