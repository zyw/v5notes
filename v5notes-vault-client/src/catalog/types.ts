/** Catalog protocol — independent of file-sync (plan default A). */
export const CATALOG_PROTOCOL_VERSION = '1'
export const CATALOG_HEADER_VERSION = 'X-Vault-Catalog-Version'
export const CATALOG_HEADER_KIND = 'X-Vault-Resource-Kind'
export const CATALOG_RESOURCE_KIND = 'catalog-non-file-sync'

export type CatalogKind = 'plugin' | 'theme'

export interface CatalogItem {
  id: string
  name: string
  kind: CatalogKind
  version: string
  description?: string
  author?: string
  minAppVersion?: string
  permissions?: string[]
  tags?: string[]
  networkAllowlist?: string[]
  packagePath?: string
}

export interface CatalogListResponse {
  catalogProtocolVersion: string
  fileSyncResource: boolean
  items: CatalogItem[]
}

export interface CatalogPackage {
  catalogProtocolVersion: string
  fileSyncResource: boolean
  id: string
  kind: CatalogKind
  version: string
  files: Record<string, string>
}
