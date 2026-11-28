export interface VaultSpaceQuery {
  pageNum?: number;
  pageSize?: number;
  keyword?: string;
  name?: string;
  status?: string;
}

export interface VaultAdminSpace {
  vaultId: string;
  userId: string;
  userName?: string;
  nickName?: string;
  name: string;
  usedBytes: number;
  userUsedBytes: number;
  quotaBytes: number;
  overQuota: boolean;
  fileCount: number;
  replicaCount: number;
  replicaLimit: number;
  lastSyncAt?: string;
  createTime?: string;
  updateTime?: string;
}

export interface VaultFileQuery {
  pageNum?: number;
  pageSize?: number;
  keyword?: string;
  fileType?: string;
  includeDeleted?: boolean;
}

export interface VaultAdminFile {
  fileId: string;
  vaultId: string;
  path: string;
  fileType: 'note' | 'asset' | 'config' | string;
  contentHash?: string;
  sizeBytes: number;
  rev: number;
  deleted: boolean;
  createTime?: string;
  updateTime?: string;
}

export interface VaultAdminFileContent {
  fileId: string;
  vaultId: string;
  path: string;
  fileType: string;
  contentHash?: string;
  sizeBytes: number;
  rev: number;
  deleted: boolean;
  body?: string;
  assetId?: string;
  mimeType?: string;
  storageKey?: string;
  configId?: string;
  backend?: string;
}

export interface VaultAssetQuery {
  pageNum?: number;
  pageSize?: number;
  keyword?: string;
}

export interface VaultAdminAsset {
  assetId: string;
  vaultId: string;
  sha256: string;
  sizeBytes: number;
  mimeType?: string;
  storageKey?: string;
  configId?: string;
  backend?: string;
  refCount: number;
  createTime?: string;
}

export interface VaultChangeQuery {
  pageNum?: number;
  pageSize?: number;
  op?: string;
  keyword?: string;
}

export interface VaultAdminChange {
  cursor: string;
  vaultId: string;
  fileId: string;
  op: 'upsert' | 'delete' | 'rename' | string;
  path?: string;
  fromPath?: string;
  contentHash?: string;
  sizeBytes?: number;
  remoteRev: number;
  createTime?: string;
}
