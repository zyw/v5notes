/**
 * Quota / plan copy that keeps Cloud vs Vault buckets distinct (Phase 5).
 */

import { formatBytes } from '../account/quota'
import type { NumericByteSize } from './api'
import type { VaultQuota } from './types'
import { VaultQuotaRules } from './limits'
import { toNumericBytes } from './api'

export function cloudQuotaHelp(): string {
  return 'Cloud 笔记额度仅用于云端目录树客户端（v5notes-client2），与本机 Vault 库无关。'
}

export function vaultSyncQuotaHelp(): string {
  return 'Vault 同步额度仅统计本机库通过官方 Sync 上传的体积与绑定设备数；本地编辑不消耗、也不受此额度阻断。'
}

export function formatVaultQuotaLine(quota: {
  usedBytes: NumericByteSize
  quotaBytes: NumericByteSize
  deviceUsed: number
  deviceLimit: number
  overQuota?: boolean
  maxFileBytes?: NumericByteSize
}): string {
  const capacity = `${formatBytes(toNumericBytes(quota.usedBytes))} / ${formatBytes(toNumericBytes(quota.quotaBytes))}`
  const devices = `设备 ${quota.deviceUsed}/${quota.deviceLimit}`
  const maxFile = formatBytes(toNumericBytes(quota.maxFileBytes) || VaultQuotaRules.DEFAULT_MAX_FILE_BYTES)
  const over = quota.overQuota ? ' · 已超额（push 拒绝，pull 只读，本地可继续编辑）' : ''
  return `${capacity} · ${devices} · 单文件上限 ${maxFile}${over}`
}

export function overQuotaPushMessage(): string {
  return 'Vault 同步容量已超额：已跳过 push；仍可 pull 与本地编辑。可删除云端文件、踢除闲置设备或升级套餐。'
}

export function deviceLimitMessage(): string {
  return '同步设备数已达上限。请在下方设备列表踢除旧设备后再绑定，或升级套餐。'
}

export function summarizeQuotaForStatus(quota: VaultQuota | null | undefined): string | null {
  if (!quota?.available) return null
  return formatVaultQuotaLine(quota)
}
