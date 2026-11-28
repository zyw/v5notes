import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type {
  VaultAdminCatalogDetail,
  VaultAdminCatalogItem,
  VaultCatalogQuery,
  VaultCatalogSavePayload,
  VaultCatalogZipPreview
} from './types';

export const listVaultCatalog = (query?: VaultCatalogQuery): AxiosPromise<PageResult<VaultAdminCatalogItem>> => {
  return request({
    url: '/vault/admin/catalog/list',
    method: 'get',
    params: query
  });
};

export const getVaultCatalogDetail = (id: string): AxiosPromise<VaultAdminCatalogDetail> => {
  return request({
    url: `/vault/admin/catalog/${encodeURIComponent(id)}`,
    method: 'get'
  });
};

export const parseVaultCatalogZip = (file: File): AxiosPromise<VaultCatalogZipPreview> => {
  const formData = new FormData();
  formData.append('file', file);
  return request({
    url: '/vault/admin/catalog/parse-zip',
    method: 'post',
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    data: formData
  });
};

export const createVaultCatalog = (data: VaultCatalogSavePayload): AxiosPromise<VaultAdminCatalogDetail> => {
  return request({
    url: '/vault/admin/catalog',
    method: 'post',
    data
  });
};

export const updateVaultCatalog = (id: string, data: VaultCatalogSavePayload): AxiosPromise<VaultAdminCatalogDetail> => {
  return request({
    url: `/vault/admin/catalog/${encodeURIComponent(id)}`,
    method: 'put',
    data
  });
};

export const updateVaultCatalogStatus = (id: string, status: '1' | '2') => {
  return request({
    url: `/vault/admin/catalog/${encodeURIComponent(id)}/status`,
    method: 'put',
    data: { status }
  });
};

export const removeVaultCatalog = (id: string) => {
  return request({
    url: `/vault/admin/catalog/${encodeURIComponent(id)}`,
    method: 'delete'
  });
};
