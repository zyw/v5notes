import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { ModelsVO, ModelsForm, ModelsQuery } from '@/api/ai-llm/models/types';

/**
 * 查询模型列表
 * @param query
 * @returns {*}
 */

export const listModels = (query?: ModelsQuery): AxiosPromise<ModelsVO[]> => {
  return request({
    url: '/ai-llm/models/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询模型详细
 * @param id
 */
export const getModels = (id: string | number): AxiosPromise<ModelsVO> => {
  return request({
    url: '/ai-llm/models/' + id,
    method: 'get'
  });
};

/**
 * 新增模型
 * @param data
 */
export const addModels = (data: ModelsForm) => {
  return request({
    url: '/ai-llm/models',
    method: 'post',
    data: data
  });
};

/**
 * 修改模型
 * @param data
 */
export const updateModels = (data: ModelsForm) => {
  return request({
    url: '/ai-llm/models',
    method: 'put',
    data: data
  });
};

/**
 * 删除模型
 * @param id
 */
export const delModels = (id: string | number | Array<string | number>) => {
  return request({
    url: '/ai-llm/models/' + id,
    method: 'delete'
  });
};
