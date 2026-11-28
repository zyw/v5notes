import type { VaultAdminAsset } from '@/api/vault/spaces/types';

export type { VaultAdminAsset };

export interface VaultGlobalAssetQuery {
  pageNum?: number;
  pageSize?: number;
  vaultId?: string;
  keyword?: string;
  backend?: string;
  mimePrefix?: string;
}
