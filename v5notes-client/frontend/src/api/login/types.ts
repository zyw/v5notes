/**
 * 登录请求
 */
export interface LoginData {
    tenantId?: string;
    username?: string;
    password?: string;
    // socialCode?: string;
    // socialState?: string;
    // source?: string;
    // code?: string;
    // uuid?: string;
    clientId: string;
    grantType: string;
    deviceType: string;
    serverUrl: string;
}

/**
 * 登录响应
 */
export interface LoginResult {
    access_token: string;
  }