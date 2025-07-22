import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { ModelSuppliersVO, ModelSuppliersForm, ModelSuppliersQuery } from '@/api/ai-llm/modelSuppliers/types';

/**
 * 查询模型供应商列表
 * @param query
 * @returns {*}
 */

export const listModelSuppliers = (query?: ModelSuppliersQuery): AxiosPromise<ModelSuppliersVO[]> => {
  return request({
    url: '/ai-llm/model-sup/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询模型供应商详细
 * @param id
 */
export const getModelSuppliers = (id: string | number): AxiosPromise<ModelSuppliersVO> => {
  return request({
    url: '/ai-llm/model-sup/' + id,
    method: 'get'
  });
};

/**
 * 新增模型供应商
 * @param data
 */
export const addModelSuppliers = (data: ModelSuppliersForm) => {
  return request({
    url: '/ai-llm/model-sup',
    method: 'post',
    data: data
  });
};

/**
 * 修改模型供应商
 * @param data
 */
export const updateModelSuppliers = (data: ModelSuppliersForm) => {
  return request({
    url: '/ai-llm/model-sup',
    method: 'put',
    data: data
  });
};

/**
 * 删除模型供应商
 * @param id
 */
export const delModelSuppliers = (id: string | number | Array<string | number>) => {
  return request({
    url: '/ai-llm/model-sup/' + id,
    method: 'delete'
  });
};
