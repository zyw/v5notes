import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type { NoteRestoreVO, NoteRevisionDetailVO, NoteRevisionVO, NotesForm, NotesQuery, NotesVO } from '@/api/notes/notes/types';

/**
 * 查询笔记列表
 * @param query
 */
export const listNotes = (query?: NotesQuery): AxiosPromise<PageResult<NotesVO>> => {
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

/**
 * 历史版本列表，不含正文
 */
export const listNoteRevisions = (
  id: string | number,
  query?: { pageNum?: number; pageSize?: number }
): AxiosPromise<PageResult<NoteRevisionVO>> => {
  return request({
    url: '/notes/notes/' + id + '/revisions',
    method: 'get',
    params: query
  });
};

/**
 * 某一版的全文
 */
export const getNoteRevision = (id: string | number, revisionId: string | number): AxiosPromise<NoteRevisionDetailVO> => {
  return request({
    url: '/notes/notes/' + id + '/revisions/' + revisionId,
    method: 'get'
  });
};

/**
 * 把选中版本恢复为当前正文
 */
export const restoreNoteRevision = (id: string | number, revisionId: string | number): AxiosPromise<NoteRestoreVO> => {
  return request({
    url: '/notes/notes/' + id + '/revisions/' + revisionId + '/restore',
    method: 'post'
  });
};
