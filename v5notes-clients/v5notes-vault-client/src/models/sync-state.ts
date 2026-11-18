/**
 * Draft types for `.v5notes/sync-state.json` (design §6.5).
 * The whole file is never synced (design §6.4).
 */

export type SyncFileStatus = 'clean' | 'dirty' | 'conflict' | 'error'

export interface SyncFileEntry {
  fileId: string | null
  identityKey: string
  localHash: string | null
  remoteRev: number | null
  status: SyncFileStatus
  size: number | null
  mtimeMs: number | null
}

export interface SyncStateJson {
  schemaVersion: 1
  /** Keys are display paths; identityKey is case-folded NFC form. */
  files: Record<string, SyncFileEntry>
}

export const SYNC_STATE_SCHEMA_VERSION = 1 as const
