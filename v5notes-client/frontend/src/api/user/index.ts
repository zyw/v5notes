import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { UserInfo, UserForm } from './types';
import useGlobalStore from "@/stores/modules/global";

// 获取用户详细信息
export function getInfo(): AxiosPromise<UserInfo> {
    return request({
      url: useGlobalStore().serverUrl + '/system/user/getInfo',
      method: 'get'
    });
}

/**
 * 修改用户
 */
export const updateUser = (data: UserForm) => {
  return request({
    url: useGlobalStore().serverUrl + '/system/user',
    method: 'put',
    data: data
  });
};