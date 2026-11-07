import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type { DashboardOverview } from './types';

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
