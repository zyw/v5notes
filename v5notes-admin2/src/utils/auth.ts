const TokenKey = 'Admin-Token';
const RefreshTokenKey = 'Admin-Refresh-Token';
const TokenExpireKey = 'Admin-Token-Expires-At';

const tokenStorage = useStorage<null | string>(TokenKey, null);
const refreshTokenStorage = useStorage<null | string>(RefreshTokenKey, null);
const tokenExpireStorage = useStorage<null | number>(TokenExpireKey, null);

export const getToken = () => tokenStorage.value;

export const setToken = (access_token: string) => (tokenStorage.value = access_token);

export const removeToken = () => (tokenStorage.value = null);

export const getRefreshToken = () => refreshTokenStorage.value;

export const setRefreshToken = (refresh_token: string) => (refreshTokenStorage.value = refresh_token);

export const removeRefreshToken = () => (refreshTokenStorage.value = null);
export const getTokenExpireAt = () => tokenExpireStorage.value;

/** 记录访问令牌绝对过期时间（毫秒时间戳） */
export const setTokenExpireAt = (expiresAt: number) => (tokenExpireStorage.value = expiresAt);

export const removeTokenExpireAt = () => (tokenExpireStorage.value = null);
