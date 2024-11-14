import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { getServerUrl } from '@/utils/commons';
import { NotesVO, NotesForm, NotesQuery, NotesSearch } from '@/api/notes/types';

/**
 * 查询笔记列表
 * @param query
 * @returns {*}
 */
export const listNotes = (query?: NotesQuery): AxiosPromise<NotesVO[]> => {
  return request({
    url: getServerUrl() + '/client/notes/list',
    method: 'get',
    params: query
  });
};

/**
 * 搜索笔记列表
 * @param search
 * @returns {*}
 */
export const searchNotes = (search?: NotesSearch): AxiosPromise<NotesVO[]> => {
  return request({
    url: getServerUrl() + '/client/notes/search',
    method: 'get',
    params: search
  });
};

/**
 * 查询笔记列表
 * @param query
 * @returns {*}
 */
export const listNewNotes = (query?: PageQuery): AxiosPromise<NotesVO[]> => {
  return request({
    url: getServerUrl() + '/client/notes/new-notes',
    method: 'get',
    params: query
  });
};

/**
 * 查询笔记详细
 * @param id
 */
export const getNotes = (id: string | number): AxiosPromise<NotesVO> => {
  return request({
    url: getServerUrl() + '/client/notes/' + id,
    method: 'get'
  });
};

/**
 * 新增笔记
 * @param data
 */
export const addNotes = (data: NotesForm): AxiosPromise<number> => {
  return request({
    url: getServerUrl() + '/client/notes',
    method: 'post',
    data: data
  });
};

/**
 * 修改笔记
 * @param data
 */
export const updateNotes = (data: NotesForm) => {
  return request({
    url: getServerUrl() + '/client/notes',
    method: 'put',
    data: data
  });
};

/**
 * 删除笔记
 * @param id
 */
export const delNotes = (id: string | number | Array<string | number>) => {
  return request({
    url: getServerUrl() + '/client/notes/' + id,
    method: 'delete'
  });
};
