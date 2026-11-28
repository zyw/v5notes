export interface VaultAssetCapability {
  backend: string;
  directDownload: boolean;
  maxFileBytes: number;
  maxConcurrentUploads: number;
}

export interface VaultAdminTrendPoint {
  day: string;
  upsertCount: number;
  deleteCount: number;
  renameCount: number;
}

export interface VaultAdminOverview {
  totalSpaces: number;
  activeUsers: number;
  totalReplicas: number;
  uniqueDevices: number;
  totalFiles: number;
  noteFiles: number;
  assetFiles: number;
  configFiles: number;
  totalUsedBytes: number;
  assetBytes: number;
  overQuotaUsers: number;
  defaultQuotaBytes: number;
  defaultReplicaLimit: number;
  defaultMaxFileBytes: number;
  assetStorage: VaultAssetCapability | null;
  trend: VaultAdminTrendPoint[];
}

export interface VaultAdminStorageRank {
  userId: string;
  userName?: string;
  nickName?: string;
  spaceCount: number;
  replicaCount: number;
  usedBytes: number;
  quotaBytes: number;
  overQuota: boolean;
}
