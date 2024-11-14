import { to as tos } from 'await-to-js';
import router from './index';
import { getToken } from '@/utils/auth';
import { isRelogin } from '@/utils/request';
import useUserStore from '@/stores/modules/user';
import { ElMessage } from 'element-plus';
import useEditorStore from '@/stores/modules/editor'
import { ipcApiRoute } from '@/api/ipcMain';
import { ipc as ipcRenderer } from '@/utils/ipcRenderer'

const whiteList = ['/login'];

router.beforeEach(async (to, from, next) => {
  
  // 判断是否是登录页跳转到首页，如果是则调整窗口大小
  if((from.path === '/login' || from.path.startsWith('/login')) 
    && to.path === '/' || to.path === '/index') {
    ipcRenderer.send(ipcApiRoute.mainWindow,{ width: 1200, height: 800 })
  }

  if (getToken()) {
    /* has token*/
    if (to.path === '/login') {
      next({ path: '/' });
    } else if (whiteList.indexOf(to.path as string) !== -1) {
      next();
    } else {
      if (useUserStore().roles.length === 0) {
        isRelogin.show = true;
        // 判断当前用户是否已拉取完user_info信息
        const [err] = await tos(useUserStore().getInfo());
        if (err) {
          await useUserStore().logout();
          ElMessage.error(err);
          next({ path: '/' });
        } else {
          isRelogin.show = false;
          // const accessRoutes = await usePermissionStore().generateRoutes();
          // // 根据roles权限生成可访问的路由表
          // accessRoutes.forEach((route) => {
          //   if (!isHttp(route.path)) {
          //     router.addRoute(route); // 动态添加可访问路由表
          //   }
          // });
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          next({ path: to.path, replace: true, params: to.params, query: to.query, hash: to.hash, name: to.name as string }); // hack方法 确保addRoutes已完成
        }
      } else {
        if(from.path.startsWith('/md/editor') && useEditorStore().hasSave) {
          await ElMessageBox.confirm(
          '有没有保存的内容，是否保存？',
          '提示',
          {
              confirmButtonText: '保存',
              cancelButtonText: '不保存',
              type: 'warning',
          }
          ).finally(() => {
            useEditorStore().hasSave = false
            next();
          });
          useEditorStore().handleSaveContent()
        } else {
          next();
        }
      }
    }
  } else {
    // 没有token
    if (whiteList.indexOf(to.path as string) !== -1) {
      // 在免登录白名单，直接进入
      next();
    } else {
      const redirect = encodeURIComponent(to.fullPath || '/');
      next(`/login?redirect=${redirect}`); // 否则全部重定向到登录页
    }
  }
});

router.afterEach(() => {
  
});
