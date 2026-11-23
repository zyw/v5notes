import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type { FileConfigForm, FileConfigPurpose, FileConfigQuery, FileConfigVO } from '@/api/basics/fileConfig/types';

const fileBaseUrl = '/basics/admin/file-config';

/**
 * 查询文件配置列表
 * @param query
 */
export const listFileConfig = (query?: FileConfigQuery): AxiosPromise<PageResult<FileConfigVO>> => {
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
 * @param id
 */
export const updateMasterConfig = (id: string | number) => {
  return request({
    url: fileBaseUrl + '/master/' + id,
    method: 'put'
  });
};

/**
 * 切换文件配置用途：目标接管用途，原持有者退回 GENERIC
 * @param id
 * @param purpose
 */
export const updateFileConfigPurpose = (id: string | number, purpose: FileConfigPurpose) => {
  return request({
    url: fileBaseUrl + '/purpose/' + id + '/' + purpose,
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
