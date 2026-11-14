import type { SyncFileEntry, SyncStateJson } from '../models/sync-state'
import type { VaultJson } from '../models/vault'

export type SyncStatus =
  | 'idle'
  | 'binding'
  | 'syncing'
  | 'over-quota'
  | 'conflict'
  | 'error'
  | 'offline'

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

export interface VaultManifest {
  cursor: string
  changes: VaultChange[]
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
  usedBytes: number
  quotaBytes: number
  deviceLimit: number
  deviceUsed: number
  planName?: string | null
  overQuota?: boolean
  maxFileBytes?: number
}

export interface VaultSpaceSummary {
  vaultId: string
  name: string
  usedBytes: number
  empty?: boolean
}

export interface VaultBindResult {
  vaultId: string
  deviceId: string
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
}

export interface LocalScanFile {
  displayPath: string
  identityKey: string
  content: string
  hash: string
  size: number
  mtimeMs: number
}

export type { SyncFileEntry, SyncStateJson, VaultJson }

export interface BootstrapPlan {
  mode: 'upload-local' | 'pull-cloud' | 'merge-cloud-baseline'
  cloudHasContent: boolean
  localFileCount: number
}
