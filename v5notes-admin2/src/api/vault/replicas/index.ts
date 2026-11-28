import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type { VaultAdminReplica, VaultReplicaQuery } from './types';

export const listVaultReplicas = (query?: VaultReplicaQuery): AxiosPromise<PageResult<VaultAdminReplica>> => {
  return request({
    url: '/vault/admin/replicas/list',
    method: 'get',
    params: query
  });
};

export const kickVaultReplica = (id: string) => {
  return request({
    url: `/vault/admin/replicas/${id}`,
    method: 'delete'
  });
};

export const kickVaultReplicasBatch = (ids: string[]) => {
  return request({
    url: `/vault/admin/replicas/batch/${ids.join(',')}`,
    method: 'delete'
  });
};
