import { describe, expect, it } from 'vitest'
import { formatBytes, mapCloudQuotaToPlan, mapVaultQuota } from './quota'

describe('account plan shape B', () => {
  it('maps cloud quota and stubs vault_sync when missing', () => {
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

  it('maps /vault/v1/quota into vault_sync bucket', () => {
    const plan = mapCloudQuotaToPlan(null, mapVaultQuota({
      available: true,
      usedBytes: 100,
      quotaBytes: 1024,
      deviceLimit: 3,
      deviceUsed: 1,
      overQuota: false,
      planName: 'vault-default',
    }))
    expect(plan.vaultSync.available).toBe(true)
    expect(plan.vaultSync.deviceLimit).toBe(3)
    expect(plan.vaultSync.planName).toBe('vault-default')
  })

  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
  })
})
