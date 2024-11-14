// 定义是否折叠小仓库[选择式Api写法]
import { defineStore } from "pinia";
import { MenuTypeEnum } from '@/enums/MenuTypeEnum'
import { useRouter } from "vue-router";
// import { to } from 'await-to-js';
// import { getToken, removeToken } from '@/utils/auth';
// import { getInfo as getUserInfo } from '@/api/user';
// import { logout as logoutApi } from '@/api/login';
// import defAva from '@/assets/images/avatar/zyw.png';

// defineStore方法执行会返回一个函数，函数的作用就是让组件可以获取到仓库数据
const useLeftMenuStore = defineStore("leftMenu", () => {

  const router = useRouter();

  const id = ref<number>(0);
  const title = ref('全部笔记');
  const type = ref<MenuTypeEnum>(MenuTypeEnum.MENU_LIST);

  // 修改目录或者笔记名称时刷新列表页面
  const refreshList = ref<number>()

  const setLeftMenu = (_id: number, _title: string, _menuType: MenuTypeEnum) => {
    id.value = _id
    title.value = _title
    type.value = _menuType
  }

  const initRightMain = async (_id: number, menuType: string) => {
    if(id.value === _id) {
      setLeftMenu(0, "全部笔记", MenuTypeEnum.MENU_LIST)
      if(menuType === 'new') {
        setLeftMenu(1, "最新笔记", MenuTypeEnum.MENU_LIST)
      }
      
      await router.push("/");
    }
  }

  return {
    title,
    id,
    type,
    refreshList,
    setLeftMenu,
    initRightMain
  }
});

// 对外暴露方法
export default useLeftMenuStore;