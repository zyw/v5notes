import { describe, expect, it } from 'vitest'
import { formatBytes, mapCloudQuotaToPlan } from './quota'

describe('account plan shape B', () => {
  it('maps cloud quota and stubs vault_sync bucket', () => {
    const plan = mapCloudQuotaToPlan({
      limited: true,
      expired: false,
      usedBytes: 1024,
      quotaBytes: 2048,
      planName: 'trial',
      expireAt: null,
    })
    expect(plan.shape).toBe('B')
    expect(plan.cloud?.usedBytes).toBe(1024)
    expect(plan.vaultSync.available).toBe(false)
  })

  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
  })
})
