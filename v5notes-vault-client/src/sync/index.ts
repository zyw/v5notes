export { createVaultSyncApi, VaultSyncApiError, type VaultSyncApi } from './api'
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
export { normalizeContentHash, sha256Hex } from './hash'
export type {
  BootstrapPlan,
  SyncEngineStatus,
  SyncStatus,
  VaultQuota,
  VaultSpaceSummary,
} from './types'
