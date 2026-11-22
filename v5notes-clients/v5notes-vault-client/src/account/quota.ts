/**
 * 套餐售卖形态 B：一账号、双配额字段（cloud_* / vault_sync_*）。
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
  /** false 表示后端尚未下发 Vault 同步额度。 */
  available: boolean
  usedBytes: number
  quotaBytes: number
  replicaLimit: number
  replicaUsed: number
  planName?: string | null
  overQuota?: boolean
  maxFileBytes?: number
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
    replicaLimit: 0,
    replicaUsed: 0,
    planName: null,
    overQuota: false,
  }
}

export function mapVaultQuota(raw: {
  available?: boolean
  usedBytes?: number
  quotaBytes?: number
  replicaLimit?: number
  replicaUsed?: number
  planName?: string | null
  overQuota?: boolean
  maxFileBytes?: number
} | null | undefined): VaultSyncQuotaBucket {
  if (!raw) return stubVaultSyncQuota()
  return {
    available: raw.available !== false,
    usedBytes: raw.usedBytes ?? 0,
    quotaBytes: raw.quotaBytes ?? 0,
    replicaLimit: raw.replicaLimit ?? 0,
    replicaUsed: raw.replicaUsed ?? 0,
    planName: raw.planName ?? null,
    overQuota: Boolean(raw.overQuota),
    maxFileBytes: raw.maxFileBytes,
  }
}

export function mapCloudQuotaToPlan(
  cloud: {
    limited: boolean
    expired: boolean
    usedBytes: number
    quotaBytes: number
    expireAt?: string | null
    planName?: string | null
  } | null,
  vaultSync?: VaultSyncQuotaBucket | null,
): AccountPlan {
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
    vaultSync: vaultSync ?? stubVaultSyncQuota(),
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
