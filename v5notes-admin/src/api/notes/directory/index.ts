import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { DirectoryVO, DirectoryForm, DirectoryQuery } from '@/api/notes/directory/types';

/**
 * 查询目录列表
 * @param query
 * @returns {*}
 */

export const listDirectory = (query?: DirectoryQuery): AxiosPromise<DirectoryVO[]> => {
  return request({
    url: '/notes/directory/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询目录详细
 * @param id
 */
export const getDirectory = (id: string | number): AxiosPromise<DirectoryVO> => {
  return request({
    url: '/notes/directory/' + id,
    method: 'get'
  });
};

/**
 * 新增目录
 * @param data
 */
export const addDirectory = (data: DirectoryForm) => {
  return request({
    url: '/notes/directory',
    method: 'post',
    data: data
  });
};

/**
 * 修改目录
 * @param data
 */
export const updateDirectory = (data: DirectoryForm) => {
  return request({
    url: '/notes/directory',
    method: 'put',
    data: data
  });
};

/**
 * 删除目录
 * @param id
 */
export const delDirectory = (id: string | number | Array<string | number>) => {
  return request({
    url: '/notes/directory/' + id,
    method: 'delete'
  });
};
