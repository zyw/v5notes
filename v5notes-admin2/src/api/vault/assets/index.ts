import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import { suffixFromMimeType } from '@/utils/filePreview';
import request from '@/utils/request';
import type { VaultAdminAsset, VaultGlobalAssetQuery } from './types';

export const listVaultGlobalAssets = (query?: VaultGlobalAssetQuery): AxiosPromise<PageResult<VaultAdminAsset>> => {
  return request({
    url: '/vault/admin/assets/list',
    method: 'get',
    params: query
  });
};

export const vaultAssetContentPath = (vaultId: string, assetId: string): string => {
  return `/vault/admin/spaces/${vaultId}/assets/${assetId}/content`;
};

export const resolveVaultAssetFileName = (
  asset: Pick<VaultAdminAsset, 'assetId' | 'fileName' | 'samplePath' | 'mimeType'>
): string => {
  const sampleLeaf = asset.samplePath
    ? asset.samplePath.slice(asset.samplePath.lastIndexOf('/') + 1).trim()
    : '';
  const base = (asset.fileName || '').trim() || sampleLeaf || asset.assetId;
  const lastDot = base.lastIndexOf('.');
  const hasExt = lastDot > 0 && lastDot < base.length - 1;
  if (hasExt) return base;
  const ext = suffixFromMimeType(asset.mimeType);
  return ext ? `${base}.${ext}` : base;
};
