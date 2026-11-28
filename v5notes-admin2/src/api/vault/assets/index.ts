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

const hasExtension = (name: string): boolean => {
  const lastDot = name.lastIndexOf('.');
  return lastDot > 0 && lastDot < name.length - 1;
};

export const resolveVaultAssetFileName = (
  asset: Pick<VaultAdminAsset, 'assetId' | 'fileName' | 'samplePath' | 'mimeType'>
): string => {
  const sampleLeaf = asset.samplePath
    ? asset.samplePath.slice(asset.samplePath.lastIndexOf('/') + 1).trim()
    : '';
  const storedName = (asset.fileName || '').trim();
  const base = sampleLeaf || storedName || asset.assetId;
  if (hasExtension(base)) return base;
  if (storedName && hasExtension(storedName)) {
    return `${base}${storedName.slice(storedName.lastIndexOf('.'))}`;
  }
  const ext = suffixFromMimeType(asset.mimeType);
  return ext ? `${base}.${ext}` : base;
};
