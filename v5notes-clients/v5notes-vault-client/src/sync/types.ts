import type { SyncFileEntry, SyncStateJson } from '../models/sync-state'
import type { VaultJson } from '../models/vault'
import type { NumericByteSize } from './api'

export type SyncStatus =
  | 'idle'
  | 'binding'
  | 'syncing'
  | 'over-quota'
  | 'conflict'
  | 'error'
  | 'offline'
  | 'retrying'

export interface VaultChange {
  op: 'upsert' | 'delete' | 'rename' | string
  path?: string
  from?: string
  fileId: string
  remoteRev: number
  contentHash?: string
  size?: number
  type?: string
}

/** One bound copy of a cloud library (a row of vault_replica). */
export interface VaultReplicaInfo {
  id: string
  vaultId: string
  /** This copy's replica id, taken from its own vault.json. */
  replicaId: string
  /** Machine that bound it; shared by every replica on that machine. */
  deviceId?: string | null
  clientInfo?: string | null
  lastSeenAt?: string | null
  boundAt?: string | null
}

export interface VaultFileVersion {
  fileId: string
  rev: number
  contentHash: string
  size: number
  capturedAt?: string | null
}

export interface VaultManifest {
  cursor: string
  changes: VaultChange[]
  /** True when more pages remain; client must keep paging via cursor (design §8.2). */
  hasMore?: boolean
  empty?: boolean
}

export interface VaultFileMeta {
  fileId: string
  path: string
  remoteRev: number
  contentHash: string
  size: number
  type?: string
  cursor?: string
}

export interface VaultFileContent {
  fileId: string
  path: string
  remoteRev: number
  contentHash: string
  size: number
  type?: string
  body?: string | null
  base64Body?: string | null
}

export interface VaultQuota {
  available: boolean
  usedBytes: NumericByteSize
  quotaBytes: NumericByteSize
  replicaLimit: number
  replicaUsed: number
  planName?: string | null
  overQuota?: boolean
  /** May arrive stringified by normalizeIds; always read via toNumericBytes. */
  maxFileBytes?: NumericByteSize
}

export interface VaultSpaceSummary {
  vaultId: string
  name: string
  usedBytes: number
  empty?: boolean
}

export interface VaultBindResult {
  vaultId: string
  replicaId: string
  cloudHasContent: boolean
  quota?: VaultQuota
}

export interface SyncEngineStatus {
  status: SyncStatus
  message: string
  lastCursor: string | null
  cloudVaultId: string | null
  overQuota: boolean
  lastErrorCode: string | null
  conflictPaths: string[]
  skippedTooLarge: string[]
  retryQueueSize: number
  online: boolean
}

export interface LocalScanFile {
  displayPath: string
  identityKey: string
  /** UTF-8 text body when prefersTextBody. */
  content?: string
  /** Binary payload for attachments. */
  base64Body?: string
  hash: string
  size: number
  mtimeMs: number
  kind: 'note' | 'asset' | 'config'
  tooLarge?: boolean
}

export type { SyncFileEntry, SyncStateJson, VaultJson }

export interface BootstrapPlan {
  mode: 'upload-local' | 'pull-cloud' | 'merge-cloud-baseline'
  cloudHasContent: boolean
  localFileCount: number
}
