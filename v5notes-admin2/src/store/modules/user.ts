import { to } from 'await-to-js';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { UserInfo } from '@/api/system/user/types';
import type { LoginData, LoginResult } from '@/api/types';
import type { RuoYiAjaxResult } from '@/utils/api-types';
import { getInfo as getUserInfo, login as loginApi, logout as logoutApi } from '@/api/login';
import defAva from '@/assets/images/profile.jpg';
import {
  getToken,
  removeRefreshToken,
  removeToken,
  removeTokenExpireAt,
  setRefreshToken,
  setToken,
  setTokenExpireAt
} from '@/utils/auth';

export const useUserStore = defineStore('user', () => {
  const token = ref(getToken());
  const name = ref('');
  const nickname = ref('');
  const userId = ref<string | number>('');
  const avatar = ref('');
  const roles = ref<Array<string>>([]); // 用户角色编码集合 → 判断路由权限
  const permissions = ref<Array<string>>([]); // 用户权限编码集合 → 判断按钮权限

  /**
   * 登录
   * @param userInfo
   * @returns
   */
  const login = async (userInfo: LoginData): Promise<void> => {
    const [err, res] = await to(loginApi(userInfo));
    if (res) {
      const data = (res as RuoYiAjaxResult<LoginResult>).data;
      if (!data?.access_token) {
        return Promise.reject(err);
      }
      setToken(data.access_token);
      token.value = data.access_token;
      if (data.refresh_token) {
        setRefreshToken(data.refresh_token);
      }
      if (data.expire_in) {
        setTokenExpireAt(Date.now() + Number(data.expire_in) * 1000);
      }
      return Promise.resolve();
    }
    return Promise.reject(err);
  };

  // 获取用户信息
  const getInfo = async (): Promise<void> => {
    const [err, res] = await to(getUserInfo());
    if (res) {
      const data = (res as RuoYiAjaxResult<UserInfo>).data;
      if (!data?.user) {
        return Promise.reject(err);
      }
      const user = data.user;
      const profile = user.avatarUrl == '' || user.avatarUrl == null ? defAva : user.avatarUrl;

      if (data.roles && data.roles.length > 0) {
        // 验证返回的roles是否是一个非空数组
        roles.value = data.roles;
        permissions.value = data.permissions;
      } else {
        roles.value = ['ROLE_DEFAULT'];
      }
      name.value = user.userName;
      nickname.value = user.nickName;
      avatar.value = profile;
      userId.value = user.userId;
      return Promise.resolve();
    }
    return Promise.reject(err);
  };

  // 注销
  const logout = async (): Promise<void> => {
    await logoutApi();
    token.value = '';
    roles.value = [];
    permissions.value = [];
    removeToken();
    removeRefreshToken();
    removeTokenExpireAt();
  };

  /** 刷新令牌成功后同步更新内存与本地存储 */
  const updateTokens = (accessToken: string, refreshToken?: string) => {
    setToken(accessToken);
    token.value = accessToken;
    if (refreshToken) {
      setRefreshToken(refreshToken);
    }
  };

  const setAvatar = (value: string) => {
    avatar.value = value;
  };

  return {
    userId,
    token,
    nickname,
    avatar,
    roles,
    permissions,
    login,
    getInfo,
    logout,
    updateTokens,
    setAvatar
  };
});
