import request from '@/utils/request';
import { LoginData, LoginResult } from './types';
import { getServerUrl } from '@/utils/commons';
import { AxiosPromise } from 'axios';


// pc端固定客户端授权id
const clientId = import.meta.env.VITE_APP_CLIENT_ID;

export const ping = (serverUrl: string) => {
    return request({
        url: serverUrl + '/client/ping',
        method: 'get',
    });
}

/**
 * @param data {LoginData}
 * @returns
 */
export function login(data: LoginData): AxiosPromise<LoginResult> {
    const params = {
      ...data,
      clientId: data.clientId || clientId,
      grantType: data.grantType || 'clientPassword',
      deviceType: data.deviceType || 'pc_client'
    };
    return request({
      url: getServerUrl() + '/auth/login',
      headers: {
        isToken: false,
        isEncrypt: true,
        repeatSubmit: false
      },
      method: 'post',
      data: params
    });
}

/**
 * 注销
 */
export function logout() {
  return request({
    url: getServerUrl() + '/auth/logout',
    method: 'post'
  });
}