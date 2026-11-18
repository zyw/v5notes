/**
 * Draft types for `.v5notes/vault.json` (design §6.5).
 * Device-local fields must never sync (design §6.4).
 */

export interface VaultBinding {
  server: string | null
  cloudVaultId: string | null
  /** Local-only; never sync. */
  deviceId: string | null
  /** Local-only cursor; never sync. */
  lastCursor: string | null
}

export interface VaultJson {
  schemaVersion: 1
  localVaultId: string
  name: string
  createdAt: string
  binding: VaultBinding
}

export const VAULT_JSON_SCHEMA_VERSION = 1 as const
