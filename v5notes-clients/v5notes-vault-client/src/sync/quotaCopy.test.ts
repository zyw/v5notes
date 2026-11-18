import { describe, expect, it } from 'vitest'
import {
  cloudQuotaHelp,
  deviceLimitMessage,
  formatVaultQuotaLine,
  overQuotaPushMessage,
  vaultSyncQuotaHelp,
} from './quotaCopy'

describe('quota copy', () => {
  it('keeps Cloud and Vault messaging distinct', () => {
    expect(cloudQuotaHelp()).toContain('Cloud')
    expect(cloudQuotaHelp()).toContain('Vault')
    expect(vaultSyncQuotaHelp()).toContain('Vault')
    expect(vaultSyncQuotaHelp()).toContain('本地编辑')
  })

  it('formats vault line with over-quota policy', () => {
    const line = formatVaultQuotaLine({
      usedBytes: 1024,
      quotaBytes: 2048,
      deviceUsed: 2,
      deviceLimit: 3,
      overQuota: true,
      maxFileBytes: 25 * 1024 * 1024,
    })
    expect(line).toContain('设备 2/3')
    expect(line).toContain('push 拒绝')
    expect(overQuotaPushMessage()).toContain('pull')
    expect(deviceLimitMessage()).toContain('踢除')
  })
})
