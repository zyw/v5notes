export { createVaultSyncApi, VaultSyncApiError, type VaultSyncApi } from './api'
export {
  attachmentBadgeLabel,
  classifyFileKind,
  isAttachmentTooLarge,
  prefersTextBody,
} from './attachments'
export { planBootstrap, bootstrapModeLabel } from './bootstrap'
export { buildConflictCopyPath, deviceShort, formatConflictStamp } from './conflict'
export {
  applySyncIgnore,
  classifySyncPath,
  matchSyncIgnore,
  parseSyncIgnore,
  shouldSyncPath,
} from './exclude'
export { createSyncEngine, type SyncEngine, type SyncEngineDeps } from './engine'
export { useSyncCoordinator, type SyncCoordinatorHandles } from './coordinator'
export {
  buildDeviceLabel,
  buildVaultDeviceLabel,
  describeDeviceLabel,
  detectPlatform,
  LABEL_SEPARATOR,
  type DeviceLabelParts,
  type DevicePlatform,
} from './deviceLabel'
export {
  bindLabelForVault,
  localDeviceNames,
  rememberLocalDeviceName,
  type LocalDeviceName,
} from './localDeviceNames'
export { describeFileHash, formatHashReport, type FileHashReport } from './diagnostics'
export { normalizeContentHash, sha256Hex } from './hash'
export {
  CLOUD_DEVICE_LIMIT,
  DEVICE_IDLE_WINDOW_MS,
  kickBlockedLabel,
  kickBlockedReason,
  type KickBlockedReason,
} from './kickable'
export { VaultQuotaRules } from './limits'
export {
  cloudQuotaHelp,
  deviceLimitMessage,
  formatVaultQuotaLine,
  overQuotaPushMessage,
  vaultSyncQuotaHelp,
} from './quotaCopy'
export {
  createRetryQueue,
  isRetryableError,
  RETRY_QUEUE_REL,
  type RetryQueue,
  type RetryQueueItem,
} from './retryQueue'
export type {
  BootstrapPlan,
  SyncEngineStatus,
  SyncStatus,
  VaultDeviceInfo,
  VaultFileVersion,
  VaultQuota,
  VaultSpaceSummary,
} from './types'
