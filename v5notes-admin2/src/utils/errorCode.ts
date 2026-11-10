import { t } from '@/lang';

const keys: Record<string, string> = {
  '401': 'request.http401',
  '403': 'request.http403',
  '404': 'request.http404',
  default: 'request.httpDefault'
};

export function resolveErrorCode(code?: string | number) {
  return t(keys[String(code)] || keys.default);
}

/** 读取时按当前语言返回，调用方仍可使用 errorCode[code]。 */
export const errorCode: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_target, prop) {
    if (typeof prop !== 'string') return undefined;
    return resolveErrorCode(prop);
  }
});

export default errorCode;
