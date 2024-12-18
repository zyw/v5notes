import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { getServerUrl } from '@/utils/commons';
import { DirectoryVO, DirectoryForm, DirectoryQuery, NotesTreeVo } from '@/api/dir/types';


/**
 * 目录Tree列表
 */
export const dirTree = (): AxiosPromise<NotesTreeVo[]> => {
  return request({
    url: getServerUrl() + '/client/notes/dir/tree-dir',
    method: 'get'
  });
}

/**
 * 云笔记Tree目录列表
 */
export const dirNotesTree = (): AxiosPromise<NotesTreeVo[]> => {
  return request({
    url: getServerUrl() + '/client/notes/dir/tree',
    method: 'get'
  });
}

/**
 * 新增目录
 * @param data
 */
export const addDirectory = (data: DirectoryForm) => {
  return request({
    url: getServerUrl() + '/client/notes/dir',
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
    url: getServerUrl() + '/client/notes/dir',
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
    url: getServerUrl() + '/client/notes/dir/' + id,
    method: 'delete'
  });
};

/**
 * 查询目录详细
 * @param id
 */
export const getDirectory = (id: string | number): AxiosPromise<DirectoryVO> => {
  return request({
    url: getServerUrl() + '/client/notes/dir/' + id,
    method: 'get'
  });
};








//==========================================================================

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
