import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type {
  VaultAdminUserQuota,
  VaultCleanupResult,
  VaultMaintenanceStats,
  VaultQuotaPolicy,
  VaultQuotaPolicyForm,
  VaultUserQuotaForm,
  VaultUserQuotaQuery
} from './types';

export const getVaultQuotaPolicy = (): AxiosPromise<VaultQuotaPolicy> => {
  return request({
    url: '/vault/admin/quota/policy',
    method: 'get'
  });
};

export const updateVaultQuotaPolicy = (data: VaultQuotaPolicyForm): AxiosPromise<VaultQuotaPolicy> => {
  return request({
    url: '/vault/admin/quota/policy',
    method: 'put',
    data
  });
};

export const listVaultUserQuotas = (query?: VaultUserQuotaQuery): AxiosPromise<PageResult<VaultAdminUserQuota>> => {
  return request({
    url: '/vault/admin/quota/users',
    method: 'get',
    params: query
  });
};

export const saveVaultUserQuota = (userId: string, data: VaultUserQuotaForm) => {
  return request({
    url: `/vault/admin/quota/users/${userId}`,
    method: 'put',
    data
  });
};

export const removeVaultUserQuota = (userId: string) => {
  return request({
    url: `/vault/admin/quota/users/${userId}`,
    method: 'delete'
  });
};

export const getVaultMaintenanceStats = (): AxiosPromise<VaultMaintenanceStats> => {
  return request({
    url: '/vault/admin/maintenance/stats',
    method: 'get'
  });
};

export const cleanupVaultOrphanAssets = (): AxiosPromise<VaultCleanupResult> => {
  return request({
    url: '/vault/admin/maintenance/cleanup-orphan-assets',
    method: 'post'
  });
};

export const cleanupVaultTombstones = (): AxiosPromise<VaultCleanupResult> => {
  return request({
    url: '/vault/admin/maintenance/cleanup-tombstones',
    method: 'post'
  });
};
