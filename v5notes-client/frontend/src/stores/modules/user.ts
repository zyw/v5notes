// 定义是否折叠小仓库[选择式Api写法]
import { defineStore } from "pinia";
import { to } from 'await-to-js';
import { getToken, removeToken } from '@/utils/auth';
import { getInfo as getUserInfo } from '@/api/user';
import { UserVO } from '@/api/user/types';
import { logout as logoutApi } from '@/api/login';
import defAva from '@/assets/images/avatar/zyw.png';
import store from '@/stores';

// defineStore方法执行会返回一个函数，函数的作用就是让组件可以获取到仓库数据
const useUserStore = defineStore("user", () => {
  const token = ref(getToken());
  // const name = ref('');
  // const nickname = ref('');
  // const userId = ref<string | number>('');
  // const tenantId = ref<string>('');
  const avatarUrl = ref('');

  const roles = ref<Array<string>>([]);
  const userInfo = ref<UserVO>({
    avatarId: '',
    avatarUrl:'',
    nickName:'',
  } as UserVO);

  // 获取用户信息
  const getInfo = async (): Promise<void> => {
    const [err, res] = await to(getUserInfo());
    if (res) {
      const data = res.data;
      userInfo.value = data.user;
      const profile = userInfo.value.avatarUrl == '' || userInfo.value.avatarUrl == null ? defAva : userInfo.value.avatarUrl;

      if (data.roles && data.roles.length > 0) {
        // 验证返回的roles是否是一个非空数组
        roles.value = data.roles;
      } else {
        roles.value = ['ROLE_DEFAULT'];
      }
      avatarUrl.value = profile
      return Promise.resolve();
    }
    return Promise.reject(err);
  };

  // 注销
  const logout = async (): Promise<void> => {
    await logoutApi();
    token.value = '';
    removeToken();
  };

  return {
    avatarUrl,
    userInfo,
    roles,
    getInfo,
    logout
  }
}, 
{
  // 开启数据持久化
  persist: {
    // enabled: true, // true 表示开启持久化保存，默认localStorage
    key: "v5notes-user", // 默认会以 store 的 id 作为 key
    storage: localStorage
  }
});

// 对外暴露方法
export default useUserStore;

// 非setup
export function useUserStoreHook() {
  return useUserStore(store);
}