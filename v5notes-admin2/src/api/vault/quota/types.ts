import type { VaultAssetCapability } from '@/api/vault/overview/types';

export interface VaultQuotaPolicy {
  defaultQuotaBytes: number;
  defaultReplicaLimit: number;
  defaultMaxFileBytes: number;
  tombstoneRetentionDays: number;
  orphanAssetGraceDays: number;
  multipartMaxFileBytes: number;
}

export interface VaultQuotaPolicyForm {
  defaultQuotaBytes: number;
  defaultReplicaLimit: number;
  defaultMaxFileBytes: number;
  tombstoneRetentionDays: number;
  orphanAssetGraceDays: number;
}

export interface VaultUserQuotaQuery {
  pageNum?: number;
  pageSize?: number;
  keyword?: string;
}

export interface VaultAdminUserQuota {
  userId: string;
  userName?: string;
  nickName?: string;
  quotaBytes?: number | null;
  replicaLimit?: number | null;
  maxFileBytes?: number | null;
  effectiveQuotaBytes: number;
  effectiveReplicaLimit: number;
  effectiveMaxFileBytes: number;
  planName?: string | null;
  usedBytes: number;
  spaceCount: number;
  replicaCount: number;
  expireTime?: string | null;
  expired: boolean;
  remark?: string | null;
  updateTime?: string;
}

export interface VaultUserQuotaForm {
  quotaBytes: number | null;
  replicaLimit: number | null;
  maxFileBytes: number | null;
  planName: string | null;
  expireTime: string | null;
  remark: string | null;
}

export interface VaultMaintenanceStats {
  orphanAssetCount: number;
  orphanAssetBytes: number;
  expiredTombstoneCount: number;
  orphanAssetGraceDays: number;
  tombstoneRetentionDays: number;
  assetStorage: VaultAssetCapability | null;
}

export interface VaultCleanupResult {
  deletedCount: number;
  freedBytes: number;
  failedCount: number;
}
