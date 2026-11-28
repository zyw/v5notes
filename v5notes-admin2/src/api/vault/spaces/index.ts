import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type {
  VaultAdminAsset,
  VaultAdminChange,
  VaultAdminFile,
  VaultAdminFileContent,
  VaultAdminSpace,
  VaultAssetQuery,
  VaultChangeQuery,
  VaultFileQuery,
  VaultSpaceQuery
} from './types';

export const listVaultSpaces = (query?: VaultSpaceQuery): AxiosPromise<PageResult<VaultAdminSpace>> => {
  return request({
    url: '/vault/admin/spaces/list',
    method: 'get',
    params: query
  });
};

export const getVaultSpace = (vaultId: string): AxiosPromise<VaultAdminSpace> => {
  return request({
    url: `/vault/admin/spaces/${vaultId}`,
    method: 'get'
  });
};

export const removeVaultSpace = (vaultId: string) => {
  return request({
    url: `/vault/admin/spaces/${vaultId}`,
    method: 'delete'
  });
};

export const listVaultFiles = (vaultId: string, query?: VaultFileQuery): AxiosPromise<PageResult<VaultAdminFile>> => {
  return request({
    url: `/vault/admin/spaces/${vaultId}/files`,
    method: 'get',
    params: query
  });
};

export const getVaultFileContent = (vaultId: string, fileId: string): AxiosPromise<VaultAdminFileContent> => {
  return request({
    url: `/vault/admin/spaces/${vaultId}/files/${fileId}/content`,
    method: 'get'
  });
};

export const downloadVaultAssetBlob = (vaultId: string, assetId: string) => {
  return request({
    url: `/vault/admin/spaces/${vaultId}/assets/${assetId}/content`,
    method: 'get',
    responseType: 'blob'
  });
};

export const removeVaultFile = (vaultId: string, fileId: string) => {
  return request({
    url: `/vault/admin/spaces/${vaultId}/files/${fileId}`,
    method: 'delete'
  });
};

export const listVaultAssets = (vaultId: string, query?: VaultAssetQuery): AxiosPromise<PageResult<VaultAdminAsset>> => {
  return request({
    url: `/vault/admin/spaces/${vaultId}/assets`,
    method: 'get',
    params: query
  });
};

export const listVaultChanges = (vaultId: string, query?: VaultChangeQuery): AxiosPromise<PageResult<VaultAdminChange>> => {
  return request({
    url: `/vault/admin/spaces/${vaultId}/changes`,
    method: 'get',
    params: query
  });
};
