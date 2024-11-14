import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { FileConfigVO, FileConfigForm, FileConfigQuery } from '@/api/basics/fileConfig/types';

const fileBaseUrl = '/basics/admin/file-config';

/**
 * 查询文件配置列表
 * @param query
 * @returns {*}
 */

export const listFileConfig = (query?: FileConfigQuery): AxiosPromise<FileConfigVO[]> => {
  return request({
    url: fileBaseUrl + '/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询文件配置详细
 * @param id
 */
export const getFileConfig = (id: string | number): AxiosPromise<FileConfigVO> => {
  return request({
    url: fileBaseUrl + '/' + id,
    method: 'get'
  });
};

/**
 * 新增文件配置
 * @param data
 */
export const addFileConfig = (data: FileConfigForm) => {
  return request({
    url: fileBaseUrl,
    method: 'post',
    data: data
  });
};

/**
 * 修改文件配置
 * @param data
 */
export const updateFileConfig = (data: FileConfigForm) => {
  return request({
    url: fileBaseUrl,
    method: 'put',
    data: data
  });
};

/**
 * 修改文件配置主配置
 * @param data
 */
export const updateMasterConfig = (id: string | number) => {
  return request({
    url: fileBaseUrl + '/master/' + id,
    method: 'put'
  });
};

/**
 * 删除文件配置
 * @param id
 */
export const delFileConfig = (id: string | number | Array<string | number>) => {
  return request({
    url: fileBaseUrl + '/' + id,
    method: 'delete'
  });
};
