import request from '@/utils/request';
import { FileQuery, FileVO } from './types';
import { AxiosPromise } from 'axios';

const baseUrl = '/basics/admin/file';

// 查询文件对象存储列表
export function listFile(query: FileQuery): AxiosPromise<FileVO[]> {
  return request({
    url: baseUrl + '/list',
    method: 'get',
    params: query
  });
}

// 查询文件对象基于id串
export function listByIds(fileId: string | number): AxiosPromise<FileVO[]> {
  return request({
    url: baseUrl + '/listByIds/' + fileId,
    method: 'get'
  });
}

// 删除文件对象存储
export function delFile(fileId: string | number | Array<string | number>) {
  return request({
    url: baseUrl + '/' + fileId,
    method: 'delete'
  });
}
