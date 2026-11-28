export interface VaultReplicaQuery {
  pageNum?: number;
  pageSize?: number;
  vaultId?: string;
  keyword?: string;
  deviceId?: string;
  inactiveDays?: number;
}

export interface VaultAdminReplica {
  id: string;
  vaultId: string;
  vaultName?: string;
  userId: string;
  userName?: string;
  nickName?: string;
  replicaId: string;
  deviceId: string;
  clientInfo?: string;
  lastSeenAt?: string;
  boundAt?: string;
}
