export type ErrorKind = 'network' | 'timeout' | 'session' | 'server' | 'unknown';

export interface ErrorInfo {
  kind: ErrorKind;
  title: string;
  message: string;
}

const DEFAULTS: Record<ErrorKind, { title: string; message: string }> = {
  timeout: { title: '请求超时', message: '服务在预期时间内没有响应，可能是网络较慢或服务繁忙，请重试。' },
  network: { title: '网络连接异常', message: '无法连接到笔记服务，请检查网络或后端是否可用后重试。' },
  session: { title: '会话已过期', message: '登录状态已失效，请重新登录后继续。' },
  server: { title: '服务暂时不可用', message: '服务端返回错误，请稍后重试。' },
  unknown: { title: '加载失败', message: '发生未知错误，请重试。' }
};

/**
 * 把请求异常归一成「失败剧本」，供 ErrorState 渲染。
 * 兼容 axios 原始错误（response/status/code）与 request.ts 抛出的 handled Error。
 */
export function classifyRequestError(error: any): ErrorInfo {
  const status: number | undefined = error?.response?.status;
  const msg: string = String(error?.message ?? '');

  if (status === 401 || /401|会话已过期|无效的会话/.test(msg)) {
    return { kind: 'session', ...DEFAULTS.session };
  }
  if ((status && status >= 500) || /50\d/.test(msg)) {
    const code = status ?? (msg.match(/50\d/) || [])[0];
    return { kind: 'server', ...DEFAULTS.server, message: '服务端返回错误（' + code + '），请稍后重试。' };
  }
  if (error?.code === 'ECONNABORTED' || /timeout|超时/i.test(msg)) {
    return { kind: 'timeout', ...DEFAULTS.timeout };
  }
  if (!status || /Network Error|ERR_NETWORK|Failed to fetch|连接异常/i.test(msg)) {
    return { kind: 'network', ...DEFAULTS.network };
  }
  const serverMsg = error?.response?.data?.msg || error?.response?.data?.message || msg;
  return { kind: 'unknown', ...DEFAULTS.unknown, message: serverMsg || DEFAULTS.unknown.message };
}
