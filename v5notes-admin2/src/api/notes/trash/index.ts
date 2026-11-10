import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type { TrashEmptyResult, TrashQuery, TrashVO } from '@/api/notes/trash/types';

export interface TrashRestoreResult {
  relocated?: boolean;
  parentId?: string | number;
}

export const listTrash = (query?: TrashQuery): AxiosPromise<PageResult<TrashVO>> => {
  return request({
    url: '/notes/trash/list',
    method: 'get',
    params: query
  });
};

export const restoreTrash = (id: string | number): AxiosPromise<TrashRestoreResult> => {
  return request({
    url: '/notes/trash/' + id + '/restore',
    method: 'post'
  });
};

export const purgeTrash = (id: string | number | Array<string | number>) => {
  return request({
    url: '/notes/trash/' + id,
    method: 'delete'
  });
};

export const emptyTrash = (): AxiosPromise<TrashEmptyResult> => {
  return request({
    url: '/notes/trash/empty',
    method: 'delete'
  });
};
