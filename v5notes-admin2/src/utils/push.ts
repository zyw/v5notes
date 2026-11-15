import { useIntervalFn } from '@vueuse/core';
import { ElNotification } from 'element-plus';
import type { MessageVO } from '@/api/system/message/types';
import { createMessageTicket, getMessageBox } from '@/api/system/message';
import { useNoticeStore } from '@/store/modules/notice';
import { useUserStore } from '@/store/modules/user';
import { getToken } from '@/utils/auth';
import { isMessageRead } from '@/utils/message-read';
import { parsePushMessage, resolveNoticeGroup, resolveNoticeTitle, shouldAppendNotice } from '@/utils/push-message';
import { openFetchSse } from '@/utils/sse';

let closePushConnection: (() => void) | undefined;
const KICKED_MESSAGE = 'kicked';
let pushKicked = false;
let resumePushTimer: ReturnType<typeof setTimeout> | undefined;

const formatNoticeTime = (timestamp?: number | string) => {
  const time = timestamp ? new Date(timestamp) : new Date();
  return time.toLocaleString();
};

const appendNotice = (raw: string) => {
  const payload = parsePushMessage(raw);
  if (!shouldAppendNotice(payload)) {
    return;
  }
  const userId = useUserStore().userId;
  const title = resolveNoticeTitle(payload);
  useNoticeStore().addNotice({
    messageId: payload.messageId,
    title,
    category: resolveNoticeGroup(payload),
    type: payload.type,
    source: payload.source,
    message: payload.message ?? '',
    content: payload.data?.noticeContent,
    data: payload.data,
    path: payload.path,
    read: isMessageRead(userId, payload.messageId),
    timestamp: payload.timestamp ?? Date.now(),
    time: formatNoticeTime(payload.timestamp)
  });
  ElNotification({
    title,
    message: payload.message ?? '',
    type: 'success',
    duration: 3000
  });
};

const handlePushMessage = (raw: string) => {
  if (raw === KICKED_MESSAGE) {
    pushKicked = true;
    closePush();
    return;
  }
  appendNotice(raw);
};

const toNoticeItem = (item: MessageVO) => {
  const userId = useUserStore().userId;
  const timestamp = item.createTime ? new Date(item.createTime).getTime() : Date.now();
  return {
    messageId: item.messageId,
    title: item.title,
    category: resolveNoticeGroup(item),
    type: item.type,
    source: item.source,
    message: item.message ?? '',
    content: item.content,
    data: item.data ?? null,
    path: item.path,
    read: isMessageRead(userId, item.messageId),
    timestamp,
    time: formatNoticeTime(timestamp)
  };
};

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  clientid: import.meta.env.VITE_APP_CLIENT_ID
});

const buildSseUrl = (path: string) => `${import.meta.env.VITE_APP_BASE_API}${path}`;

const initSsePush = (path: string) => {
  const { close } = openFetchSse({
    url: buildSseUrl(path),
    headers: authHeaders(),
    onMessage: handlePushMessage,
    onError: error => {
      console.warn('SSE connection error:', error);
    },
    retries: 5,
    retryDelayMs: 5000,
    onFailed() {
      console.warn('SSE connection failed after 5 retries');
    }
  });
  closePushConnection = close;
};

const initWsPush = async (path: string) => {
  const { data } = await createMessageTicket();
  const ticket = data?.ticket;
  if (!ticket) {
    console.warn('websocket ticket missing');
    return;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  const clientId = import.meta.env.VITE_APP_CLIENT_ID;
  const url = `${protocol}${window.location.host}${import.meta.env.VITE_APP_BASE_API}${path}?ticket=${encodeURIComponent(ticket)}&clientid=${encodeURIComponent(clientId)}`;
  const { close } = useWebSocket(url, {
    autoReconnect: {
      retries: 3,
      delay: 1000,
      onFailed() {
        console.warn('websocket重连失败');
      }
    },
    heartbeat: {
      message: 'ping',
      responseMessage: 'pong',
      scheduler: callback => useIntervalFn(callback, 10000, { immediate: false }),
      pongTimeout: 2000
    },
    onMessage: (_, e) => {
      if (String(e.data) === 'pong') {
        return;
      }
      handlePushMessage(String(e.data));
    }
  });
  closePushConnection = close;
};

export const initPush = () => {
  closePush();
  if (import.meta.env.VITE_APP_MESSAGE_ENABLED === 'false') {
    return;
  }
  pushKicked = false;
  const path = import.meta.env.VITE_APP_MESSAGE_PATH || '/resource/message';
  const transport = import.meta.env.VITE_APP_MESSAGE_TRANSPORT || 'sse';
  if (transport.toLowerCase() === 'websocket') {
    void initWsPush(path);
    return;
  }
  initSsePush(path);
};

export const initMessageBox = async () => {
  if (import.meta.env.VITE_APP_MESSAGE_ENABLED === 'false') {
    useNoticeStore().clearNotice();
    return;
  }
  const { data } = await getMessageBox();
  const notices = [...(data?.systemList ?? []), ...(data?.noticeList ?? []), ...(data?.workflowList ?? [])].map(
    toNoticeItem
  );
  useNoticeStore().setNotices(notices);
};

export const closePush = () => {
  closePushConnection?.();
  closePushConnection = undefined;
};

const resumePushIfNeeded = () => {
  if (!pushKicked || !getToken() || document.visibilityState !== 'visible') {
    return;
  }
  if (resumePushTimer) {
    clearTimeout(resumePushTimer);
  }
  resumePushTimer = setTimeout(async () => {
    resumePushTimer = undefined;
    if (!pushKicked || !getToken() || document.visibilityState !== 'visible') {
      return;
    }
    try {
      await initMessageBox();
    } finally {
      initPush();
    }
  }, 300);
};

window.addEventListener('focus', resumePushIfNeeded);
document.addEventListener('visibilitychange', resumePushIfNeeded);
window.addEventListener('online', resumePushIfNeeded);
