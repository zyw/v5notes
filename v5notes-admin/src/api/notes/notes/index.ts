import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { NotesVO, NotesForm, NotesQuery } from '@/api/notes/notes/types';

/**
 * 查询笔记列表
 * @param query
 * @returns {*}
 */

export const listNotes = (query?: NotesQuery): AxiosPromise<NotesVO[]> => {
  return request({
    url: '/notes/notes/list',
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
    url: '/notes/notes/' + id,
    method: 'get'
  });
};

/**
 * 新增笔记
 * @param data
 */
export const addNotes = (data: NotesForm) => {
  return request({
    url: '/notes/notes',
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
    url: '/notes/notes',
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
    url: '/notes/notes/' + id,
    method: 'delete'
  });
};
