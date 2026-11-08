import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { TrashQuery, TrashVO } from '@/api/notes/trash/types';

export const listTrash = (query?: TrashQuery): AxiosPromise<TrashVO[]> => {
  return request({
    url: '/notes/trash/list',
    method: 'get',
    params: query
  });
};

export const restoreTrash = (id: string | number) => {
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

export const emptyTrash = () => {
  return request({
    url: '/notes/trash/empty',
    method: 'delete'
  });
};
