import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type { ClientStorageQuery, ClientStorageRank, DashboardOverview } from './types';
import type { PageResult } from '@/api/types';

/**
 * 查询首页工作台聚合数据
 * @param range 统计区间（7 / 30 / 90），默认 30
 */
export const getDashboardOverview = (range = 30): AxiosPromise<DashboardOverview> => {
  return request({
    url: '/notes/dashboard/overview',
    method: 'get',
    params: { range }
  });
};

/** 客户端用户占用空间前几名 */
export const getClientStorageTop = (limit = 8): AxiosPromise<ClientStorageRank[]> => {
  return request({
    url: '/notes/dashboard/storage-top',
    method: 'get',
    params: { limit }
  });
};

/** 全部客户端用户占用空间，按大小倒序 */
export const listClientStorage = (query: ClientStorageQuery): AxiosPromise<PageResult<ClientStorageRank>> => {
  return request({
    url: '/notes/dashboard/storage',
    method: 'get',
    params: query
  });
};
