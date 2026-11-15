import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';
import type { MessageBoxVO } from './types';

export function getMessageBox(): AxiosPromise<MessageBoxVO> {
  return request({
    url: '/resource/message/box',
    method: 'get'
  });
}

/** 签发 WebSocket 一次性连接票据（短时、单次），避免 JWT 出现在 URL。 */
export function createMessageTicket(): AxiosPromise<{ ticket: string }> {
  return request({
    url: '/resource/message/ticket',
    method: 'post'
  });
}
