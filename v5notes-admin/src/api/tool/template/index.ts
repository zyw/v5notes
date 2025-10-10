import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { TemplateVO, TemplateForm, TemplateQuery } from '@/api/tool/template/types';

/**
 * 查询代码模版列表
 * @param query
 * @returns {*}
 */

export const listTemplate = (query?: TemplateQuery): AxiosPromise<TemplateVO[]> => {
  return request({
    url: '/tool/gen/template/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询代码模版详细
 * @param id
 */
export const getTemplate = (id: string | number): AxiosPromise<TemplateVO> => {
  return request({
    url: '/tool/gen/template/' + id,
    method: 'get'
  });
};

/**
 * 新增代码模版
 * @param data
 */
export const addTemplate = (data: TemplateForm) => {
  return request({
    url: '/tool/gen/template',
    method: 'post',
    data: data
  });
};

/**
 * 修改代码模版
 * @param data
 */
export const updateTemplate = (data: TemplateForm) => {
  return request({
    url: '/tool/gen/template',
    method: 'put',
    data: data
  });
};

/**
 * 修改代码模版
 * @param data
 */
export const editTemplate = (data: TemplateForm) => {
  return request({
    url: '/tool/gen/template/edit/template',
    method: 'put',
    data: data
  });
};

/**
 * 删除代码模版
 * @param id
 */
export const delTemplate = (id: string | number | Array<string | number>) => {
  return request({
    url: '/tool/gen/template/' + id,
    method: 'delete'
  });
};

/**
 * 查询所有模版路径
 * @param id
 */
export const getAllFilePaths = (filePath: string): AxiosPromise<string[]> => {
  console.log(filePath, '<===========filePath==============>');
  return request({
    url: '/tool/gen/template/query-file-paths',
    method: 'get',
    params: { filePath }
  });
};
