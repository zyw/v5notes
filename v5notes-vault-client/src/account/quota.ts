/**
 * 套餐售卖形态 B：一账号、双配额字段（cloud_* / vault_sync_*）。
 * Phase 3 仅类型 + stub；完整计费 UI / `/vault/v1/quota` 在后续阶段。
 */

export interface CloudQuotaBucket {
  limited: boolean
  expired: boolean
  usedBytes: number
  quotaBytes: number
  planName?: string | null
  expireAt?: string | null
}

export interface VaultSyncQuotaBucket {
  /** false 表示后端尚未下发 Vault 同步额度（Phase 4 stub）。 */
  available: boolean
  usedBytes: number
  quotaBytes: number
  deviceLimit: number
  deviceUsed: number
  planName?: string | null
}

export interface AccountPlan {
  shape: 'B'
  cloud: CloudQuotaBucket | null
  vaultSync: VaultSyncQuotaBucket
}

export function stubVaultSyncQuota(): VaultSyncQuotaBucket {
  return {
    available: false,
    usedBytes: 0,
    quotaBytes: 0,
    deviceLimit: 0,
    deviceUsed: 0,
    planName: null,
  }
}

export function mapCloudQuotaToPlan(cloud: {
  limited: boolean
  expired: boolean
  usedBytes: number
  quotaBytes: number
  expireAt?: string | null
  planName?: string | null
} | null): AccountPlan {
  return {
    shape: 'B',
    cloud: cloud
      ? {
          limited: cloud.limited,
          expired: cloud.expired,
          usedBytes: cloud.usedBytes,
          quotaBytes: cloud.quotaBytes,
          planName: cloud.planName ?? null,
          expireAt: cloud.expireAt ?? null,
        }
      : null,
    vaultSync: stubVaultSyncQuota(),
  }
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`
}
