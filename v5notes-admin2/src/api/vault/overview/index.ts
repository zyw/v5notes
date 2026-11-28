import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type { VaultAdminOverview, VaultAdminStorageRank } from './types';

export const getVaultOverview = (range = 30): AxiosPromise<VaultAdminOverview> => {
  return request({
    url: '/vault/admin/overview',
    method: 'get',
    params: { range }
  });
};

export const getVaultStorageTop = (limit = 10): AxiosPromise<VaultAdminStorageRank[]> => {
  return request({
    url: '/vault/admin/overview/storage-top',
    method: 'get',
    params: { limit }
  });
};
