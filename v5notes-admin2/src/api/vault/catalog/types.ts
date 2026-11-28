export type CatalogKind = 'plugin' | 'theme';
export type CatalogStatus = '0' | '1' | '2';

export interface VaultCatalogQuery {
  pageNum?: number;
  pageSize?: number;
  kind?: string;
  status?: string;
  keyword?: string;
}

export interface VaultAdminCatalogItem {
  id: string;
  name: string;
  kind: CatalogKind | string;
  version: string;
  minAppVersion?: string;
  description?: string;
  author?: string;
  authorUrl?: string;
  permissions: string[];
  networkAllowlist: string[];
  tags: string[];
  status: CatalogStatus | string;
  sortOrder: number;
  fileCount: number;
  packagePath: string;
  createTime?: string;
  updateTime?: string;
}

export interface VaultAdminCatalogDetail extends VaultAdminCatalogItem {
  files: Record<string, string>;
  warnings: string[];
}

export interface VaultCatalogZipPreview {
  id: string;
  name: string;
  kind: CatalogKind | string;
  version: string;
  minAppVersion?: string;
  description?: string;
  author?: string;
  authorUrl?: string;
  permissions: string[];
  networkAllowlist: string[];
  tags: string[];
  files: Record<string, string>;
  warnings: string[];
}

export interface VaultCatalogSavePayload {
  id: string;
  name: string;
  kind: CatalogKind | string;
  version: string;
  minAppVersion?: string;
  description?: string;
  author?: string;
  authorUrl?: string;
  permissions: string[];
  networkAllowlist: string[];
  tags: string[];
  files: Record<string, string>;
  sortOrder: number;
}
