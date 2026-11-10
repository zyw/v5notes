import type { LoadingInstance } from 'element-plus';
import axiosModule from 'axios';
import { HttpStatus } from '@/enums/RespEnum';
import { getLanguage, t } from '@/lang';
import cache from '@/plugins/cache';
import router from '@/router';
import { useUserStore } from '@/store/modules/user';
import { getRefreshToken, getToken, getTokenExpireAt, setTokenExpireAt } from '@/utils/auth';
import { decryptBase64, decryptWithAes, encryptBase64, encryptWithAes, generateAesKey } from '@/utils/crypto';
import { errorCode } from '@/utils/errorCode';
import { decrypt, encrypt } from '@/utils/jsencrypt';
import { blobValidate, tansParams } from '@/utils/ruoyi';
import { saveBlob } from '@/utils/save';

/** axios 1.13 + TS6：默认导出在类型上会被解析为不可调用的 export= 形态 */
const axios = axiosModule as any;

const encryptHeader = 'encrypt-key';
let downloadLoadingInstance: LoadingInstance | undefined;
// 是否显示重新登录
export const isRelogin = { show: false };
// 并发请求共享同一个刷新令牌 Promise，避免重复刷新
let refreshTokenPromise: Promise<boolean> | null = null;
// 无感续期定时器
let tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;
// 提前多少毫秒刷新（默认提前 60 秒）
const REFRESH_LEAD_MS = 60 * 1000;

function createHandledError(message: string) {
  const error = new Error(message) as Error & { isHandled?: boolean };
  error.isHandled = true;
  return error;
}

export function isHandledRequestError(error: unknown) {
  return Boolean((error as { isHandled?: boolean } | undefined)?.isHandled);
}

function normalizeErrorMessage(message?: string) {
  if (!message) {
    return undefined;
  }
  if (message === 'Network Error') {
    return t('request.network');
  }
  if (message.includes('timeout')) {
    return t('request.timeout');
  }
  if (message.includes('Request failed with status code')) {
    return t('request.status', { code: message.slice(-3) });
  }
  return message;
}

async function parseResponseErrorData(data: unknown): Promise<string | undefined> {
  if (!data) {
    return undefined;
  }

  if (data instanceof Blob) {
    return parseResponseErrorData(await data.text());
  }

  if (data instanceof ArrayBuffer) {
    return parseResponseErrorData(new TextDecoder().decode(data));
  }

  if (typeof data === 'string') {
    const text = data.trim();
    if (!text) {
      return undefined;
    }
    try {
      return parseResponseErrorData(JSON.parse(text));
    } catch {
      return text;
    }
  }

  if (typeof data === 'object') {
    const payload = data as Record<string, any>;
    return payload.msg || payload.message || errorCode[payload.code] || errorCode['default'];
  }

  return undefined;
}

export async function extractErrorMessage(error: any): Promise<string | undefined> {
  const responseMessage = await parseResponseErrorData(error?.response?.data);
  if (responseMessage) {
    return responseMessage;
  }
  return normalizeErrorMessage(error?.message);
}

export const globalHeaders = () => {
  return {
    Authorization: 'Bearer ' + getToken(),
    clientid: import.meta.env.VITE_APP_CLIENT_ID
  };
};

axios.defaults.headers['Content-Type'] = 'application/json;charset=utf-8';
axios.defaults.headers['clientid'] = import.meta.env.VITE_APP_CLIENT_ID;
// 创建 axios 实例
const service = axios.create({
  baseURL: import.meta.env.VITE_APP_BASE_API,
  timeout: 50000,
  transitional: {
    // 超时错误更明确
    clarifyTimeoutError: true
  }
});

/**
 * 用 refresh_token 换取新的令牌对；并发请求共用同一次刷新。
 * 刷新请求本身标记 isRefreshTokenRequest，避免在 401 时再次触发刷新造成递归。
 */
async function doRefreshToken(): Promise<boolean> {
  if (!refreshTokenPromise) {
    refreshTokenPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        return false;
      }
      try {
        const res: any = await service({
          url: '/auth/refresh',
          method: 'post',
          headers: {
            isToken: false,
            isEncrypt: true,
            repeatSubmit: false,
            isRefreshTokenRequest: true
          },
          data: { refreshToken }
        });
        const data = res?.data ?? res;
        if (data?.access_token && data?.refresh_token) {
          useUserStore().updateTokens(data.access_token, data.refresh_token);
          if (data.expire_in) {
            setTokenExpireAt(Date.now() + Number(data.expire_in) * 1000);
            scheduleTokenRefresh(Number(data.expire_in));
          }
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        refreshTokenPromise = null;
      }
    })();
  }
  return refreshTokenPromise;
}

/**
 * 根据访问令牌剩余有效期安排一次“过期前主动刷新”。
 * @param expireInSeconds 距离过期的秒数；不传则按本地记录的绝对过期时间计算
 */
export function scheduleTokenRefresh(expireInSeconds?: number): void {
  if (tokenRefreshTimer) {
    clearTimeout(tokenRefreshTimer);
    tokenRefreshTimer = null;
  }
  const expireAt = getTokenExpireAt();
  const seconds = expireInSeconds ?? (expireAt ? Math.floor((expireAt - Date.now()) / 1000) : undefined);
  if (seconds === undefined || seconds <= 0) {
    return;
  }
  // 至少提前 5 秒，避免令牌即将过期时立即触发又过于频繁
  const delay = Math.max(seconds * 1000 - REFRESH_LEAD_MS, 5 * 1000);
  tokenRefreshTimer = setTimeout(async () => {
    tokenRefreshTimer = null;
    if (!getRefreshToken()) {
      return;
    }
    await doRefreshToken();
  }, delay);
}

/** 应用启动 / 每次路由切换时调用：按本地过期时间启动无感续期。 */
export function startTokenRefresh(): void {
  const expireAt = getTokenExpireAt();
  if (!expireAt) {
    return;
  }
  const remainingSeconds = Math.floor((expireAt - Date.now()) / 1000);
  if (remainingSeconds <= 0) {
    // 已过期则立即刷新一次（失败再由 401 流程引导重新登录）
    void doRefreshToken();
    return;
  }
  scheduleTokenRefresh(remainingSeconds);
}

// 请求拦截器
service.interceptors.request.use(
  (config: any) => {
    // 对应国际化资源文件后缀
    config.headers['Content-Language'] = getLanguage();

    const isToken = config.headers?.isToken === false;
    // 是否需要防止数据重复提交
    const isRepeatSubmit = config.headers?.repeatSubmit === false;
    // 是否需要加密
    const isEncrypt = config.headers?.isEncrypt === 'true';

    if (getToken() && !isToken) {
      config.headers['Authorization'] = 'Bearer ' + getToken(); // 让每个请求携带自定义token 请根据实际情况自行修改
    }
    // get请求映射params参数
    if (config.method === 'get' && config.params) {
      let url = config.url + '?' + tansParams(config.params);
      url = url.slice(0, -1);
      config.params = {};
      config.url = url;
    }

    if (!isRepeatSubmit && (config.method === 'post' || config.method === 'put')) {
      const requestObj = {
        url: config.url,
        data: typeof config.data === 'object' ? JSON.stringify(config.data) : config.data,
        time: new Date().getTime()
      };
      const sessionObj = cache.session.getJSON('sessionObj');
      if (sessionObj === undefined || sessionObj === null || sessionObj === '') {
        cache.session.setJSON('sessionObj', requestObj);
      } else {
        const s_url = sessionObj.url; // 请求地址
        const s_data = sessionObj.data; // 请求数据
        const s_time = sessionObj.time; // 请求时间
        const interval = 500; // 间隔时间(ms)，小于此时间视为重复提交
        if (s_data === requestObj.data && requestObj.time - s_time < interval && s_url === requestObj.url) {
          const message = t('request.repeat');
          console.warn(`[${s_url}]: ` + message);
          return Promise.reject(new Error(message));
        } else {
          cache.session.setJSON('sessionObj', requestObj);
        }
      }
    }
    if (import.meta.env.VITE_APP_ENCRYPT === 'true') {
      // 当开启参数加密
      if (isEncrypt && (config.method === 'post' || config.method === 'put')) {
        // 生成一个 AES 密钥
        const aesKey = generateAesKey();
        config.headers[encryptHeader] = encrypt(encryptBase64(aesKey));
        config.data =
          typeof config.data === 'object'
            ? encryptWithAes(JSON.stringify(config.data), aesKey)
            : encryptWithAes(config.data, aesKey);
      }
    }
    // FormData数据去请求头Content-Type
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error: any) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
service.interceptors.response.use(
  async (res: any) => {
    if (import.meta.env.VITE_APP_ENCRYPT === 'true') {
      // 加密后的 AES 秘钥
      const keyStr = res.headers[encryptHeader];
      // 加密
      if (keyStr != null && keyStr != '') {
        const data = res.data;
        // 请求体 AES 解密
        const base64Str = decrypt(keyStr);
        // base64 解码 得到请求头的 AES 秘钥
        const aesKey = decryptBase64(base64Str.toString());
        // aesKey 解码 data
        const decryptData = decryptWithAes(data, aesKey);
        // 将结果 (得到的是 JSON 字符串) 转为 JSON
        res.data = JSON.parse(decryptData);
      }
    }
    // 未设置状态码则默认成功状态
    const code = res.data.code || HttpStatus.SUCCESS;
    // 获取错误信息
    const msg = res.data.msg || errorCode[code] || errorCode['default'];
    // 二进制数据则直接返回
    if (res.request.responseType === 'blob' || res.request.responseType === 'arraybuffer') {
      return res.data;
    }
    if (code === 401) {
      // 优先尝试用刷新令牌续期并重放原请求
      const originalConfig: any = res.config || {};
      const originalHeaders: any = originalConfig.headers || {};
      const isRefreshRequest =
        originalHeaders.isRefreshTokenRequest === true || originalHeaders.isRefreshTokenRequest === 'true';
      if (!isRefreshRequest && !originalConfig.retried && getRefreshToken()) {
        originalConfig.retried = true;
        originalConfig.headers = originalHeaders;
        // 重放时关闭重复提交校验，避免被本地防重拦截
        originalHeaders.repeatSubmit = false;
        const refreshed = await doRefreshToken();
        if (refreshed) {
          return service(originalConfig);
        }
      }
      // prettier-ignore
      if (!isRelogin.show) {
				isRelogin.show = true;
				ElMessageBox.confirm(
					t('request.sessionExpired'),
					t('common.systemTip'),
					{
						confirmButtonText: t('request.relogin'),
						cancelButtonText: t('common.cancel'),
						type: "warning",
					},
				)
					.then(() => {
						isRelogin.show = false;
						useUserStore()
							.logout()
							.then(() => {
								router.replace({
									path: "/login",
									query: {
										redirect: encodeURIComponent(
											router.currentRoute.value.fullPath || "/",
										),
									},
								});
							});
					})
					.catch(() => {
						isRelogin.show = false;
					});
			}
      return Promise.reject(t('request.invalidSession'));
    } else if (code === HttpStatus.SERVER_ERROR) {
      ElMessage({ message: msg, type: 'error' });
      return Promise.reject(createHandledError(msg));
    } else if (code === HttpStatus.WARN) {
      ElMessage({ message: msg, type: 'warning' });
      return Promise.reject(createHandledError(msg));
    } else if (code !== HttpStatus.SUCCESS) {
      ElNotification.error({ title: msg });
      return Promise.reject(createHandledError(msg));
    } else {
      return Promise.resolve(res.data);
    }
  },
  async (error: any) => {
    const message = (await extractErrorMessage(error)) || errorCode['default'];
    ElMessage({ message: message, type: 'error', duration: 5 * 1000 });
    error.isHandled = true;
    return Promise.reject(error);
  }
);
// 通用下载方法
export function download(url: string, params: any, fileName: string) {
  downloadLoadingInstance = ElLoading.service({
    text: t('request.downloading'),
    background: 'rgba(0, 0, 0, 0.7)'
  });
  // prettier-ignore
  return service
		.post(url, params, {
			transformRequest: [
				(params: any) => {
					return tansParams(params);
				},
			],
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			responseType: "blob",
		})
		.then(async (resp: any) => {
			const isLogin = blobValidate(resp);
			if (isLogin) {
				const blob = new Blob([resp]);
				saveBlob(blob, fileName);
			} else {
				const blob = new Blob([resp]);
				const resText = await blob.text();
				const rspObj = JSON.parse(resText);
				const errMsg =
					errorCode[rspObj.code] || rspObj.msg || errorCode["default"];
				ElMessage.error(errMsg);
			}
			downloadLoadingInstance?.close();
		})
		.catch((r: any) => {
			console.error(r);
			downloadLoadingInstance?.close();
		});
}
// 导出 axios 实例
export default service;
