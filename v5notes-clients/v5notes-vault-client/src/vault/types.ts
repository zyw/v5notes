import type { VaultJson } from '../models/vault'

export type VaultTreeKind = 'dir' | 'note' | 'file'

export interface VaultTreeNode {
  /** Display path relative to vault root (§6.2). */
  path: string
  /** Identity key (§6.2). */
  identityKey: string
  name: string
  kind: VaultTreeKind
  children?: VaultTreeNode[]
}

export interface OpenedVault {
  rootPath: string
  name: string
  config: VaultJson
}

export interface RecentVaultEntry {
  rootPath: string
  name: string
  openedAt: string
}
