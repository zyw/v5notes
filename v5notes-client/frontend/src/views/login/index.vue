<template>
    <div class="absolute flex w-full h-30px z-500 bg-white win-title" :class="{ 'justify-start': isMacOS, 'justify-end': !isMacOS }">
      <WindowControls 
        class="win-btn"
        :showMaximize="false"
        :showMinimize="false"
        @action="handleCloseWin"
      />
    </div>
    <div class="h-full">
      <el-row class="h-100%">
        <div class="absolute top-10px right-10px flex flex-items-center">
          <!-- <KoiLanguage></KoiLanguage> -->
          <!-- <KoiDark></KoiDark> -->
        </div>
        <el-col :lg="16" :md="12" :sm="15" :xs="0" class="flex items-center justify-center">
          <div class="login-background w-85% h-100%"></div>
          <div class="absolute text-center select-none">
            <el-image class="w-400px h-360px mb-50px animate-float <md:hidden <lg:w-360px h-320px" :src="bg" />
            <div class="font-bold text-3xl chroma-text mb-6px text-center <lg:text-2xl <md:hidden">
                欢迎登录 V5Notes云笔记
            </div>
            <div class="chroma-text text-lg text-center <md:hidden">不以物喜，不以己悲</div>
          </div>
        </el-col>
        <el-col :lg="8" :md="12" :sm="9" :xs="24" class="dark:bg-#161616 bg-gray-100 flex items-center justify-center flex-col">
          <div class="flex items-center">
            <el-image class="rounded-full w-36px h-36px" :src="logo" />
            <div class="ml-6px font-bold text-xl">V5Notes云笔记</div>
          </div>
          <div class="flex items-center space-x-3 text-gray-400 mt-16px mb-16px">
            <span class="h-1px w-16 bg-gray-300 inline-block"></span>
            <span class="text-center">账号密码登录</span>
            <span class="h-1px w-16 bg-gray-300 inline-block"></span>
          </div>
          <!-- 输入框盒子 -->
          <el-form ref="loginFormRef" :model="loginForm" :rules="loginRules" class="w-280px">
            <el-form-item prop="serverUrl">
              <el-input
                type="text"
                placeholder="服务器地址以http或者https开头"
                :suffix-icon="OfficeBuilding"
                v-model="loginForm.serverUrl"
              ></el-input>
            </el-form-item>
            <el-form-item prop="username">
              <el-input type="text" placeholder="请输入用户名" :suffix-icon="User" v-model="loginForm.username" />
            </el-form-item>
            <el-form-item prop="password">
              <el-input
                type="password"
                placeholder="请输入密码"
                show-password
                :suffix-icon="Lock"
                v-model="loginForm.password"
                @keydown.enter="handleKoiLogin"
              />
            </el-form-item>
            <!-- 登录按钮 -->
            <el-form-item>
              <el-button
                type="primary"
                v-if="!loading"
                class="w-280px bg-[--el-color-primary]"
                round
                v-throttle:3000="handleKoiLogin">
                登录
              </el-button>
              <el-button type="primary" v-else class="w-280px bg-[--el-color-primary]" round :loading="loading">
                登录中
              </el-button>
            </el-form-item>
          </el-form>
        </el-col>
      </el-row>
  
      <KoiLoading></KoiLoading>
    </div>
  </template>
  
  <script lang="ts" setup>
  import { ipcApiRoute } from '@/api/ipcMain';
  import { ipc as ipcRenderer } from '@/utils/ipcRenderer'
  import { to } from 'await-to-js';
  import { User, Lock, OfficeBuilding } from "@element-plus/icons-vue";
  import { ref, reactive, onMounted, computed } from "vue";
  import type { FormInstance, FormRules } from "element-plus";
  import { koiMsgWarning, koiMsgError } from "@/utils/commons";
  import { useRouter } from "vue-router";
  import { login, ping } from "@/api/login";
  import { LoginData } from "@/api/login/types";
  import useUserStore from "@/stores/modules/user";
  import { getAssets } from "@/utils/commons";
  import KoiLoading from "./components/KoiLoading.vue";
  import { setToken } from "@/utils/auth";
  import useGlobalStore from "@/stores/modules/global";
  import WindowControls from '@/components/WindowControls.vue';
  import { isMac } from '@/utils/platform';
  
  const globalStore = useGlobalStore();
  const router = useRouter();
  
  /** 用户登录代码 */
  const logo = getAssets("images/logo/logo.png");
  const bg = getAssets("images/login/bg.png");
  const loginFormRef = ref<FormInstance>();
  const loading = ref(false);
  const isMacOS = ref(false);

  const redirect = ref(undefined);

  watch(
    () => router.currentRoute.value,
    (newRoute: any) => {
      redirect.value = newRoute.query && newRoute.query.redirect;
    },
    { immediate: true }
  );

  // 验证服务器地址是否可用
  const validateServerUrl = async (rule: any, value: any, callback: any) => {
    const [err1, res1] = await to(ping(loginForm.serverUrl));
    if(!err1) {
      globalStore.setServerUrl(loginForm.serverUrl)
      callback()
    } else {
      callback(new Error('服务器验证失败，请确认服务器地址是否正确🌻'))
    }
  }
  
  const loginForm = reactive<LoginData>({
    tenantId: '000000',
    username: "",
    password: "",
    serverUrl: globalStore.serverUrl || '',
    clientId: import.meta.env.VITE_APP_CLIENT_ID,
    grantType: "clientPassword"
  } as LoginData);

  const loginRules = reactive<FormRules<typeof loginForm>>({
    serverUrl: [
      { required: true, message: "服务器地址不能为空", trigger: "blur" },
      { type: 'url', message: "服务器地址格式不正确", trigger: 'blur' },
      // @ts-ignore
      { validator: validateServerUrl, trigger: 'blur' }
    ],
    username: [{ required: true, message: "用户名不能为空", trigger: "blur" }],
    password: [{ required: true, message: "密码不能为空", trigger: "blur" }]
  });

  // 关闭登录窗口
  const handleCloseWin = (action?: string) => {
    // 只处理关闭操作，忽略其他操作（登录页不支持最大化/最小化）
    console.log("action: ", action)
    // if (!action || action === 'close') {
    //   ipcRenderer.send("close");
    // }
  }
  
  /** 登录 */
  const handleKoiLogin = async () => {
    if (!loginFormRef.value) return;

    (loginFormRef.value as any).validate(async (valid: any, fields: any) => {
      if (valid) {
        loading.value = true;
        try {

          // 1、执行登录接口
          const [err, res] = await to(login(loginForm))
          // 调用action的登录方法
          if (!err) {
            setToken(res.data.access_token);
            const [err] = await to(useUserStore().getInfo());
            const redirectUrl = redirect.value || '/';
            await router.push(redirectUrl);
            loading.value = false;
          } else {
            loading.value = false;
            const msg = err.message
            if(msg != null && msg != '') {
              koiMsgWarning(msg + "，请重试🌻");
            } else {
              koiMsgWarning("登录错误，请重试🌻");
            }
            
            router.replace('/login');
            return;
          }
  
          // 4、跳转到首页
          router.replace('/');
        } catch (error) {
          // 等待1秒关闭loading
          let loadingTime = 1;
          setInterval(() => {
            loadingTime--;
            if (loadingTime === 0) {
              loading.value = false;
            }
          }, 1000);
        }
      } else {
        console.log("登录校验失败", fields);
        koiMsgError("校验失败，信息填写有误🌻");
      }
    });
  };

  // 进入页面加载管理员信息
  onMounted(async () => {
    ipcRenderer.send(ipcApiRoute.loginWindow,{ width: 800, height: 600 })
    isMacOS.value = await isMac()
  });
</script>
  
<style lang="scss" scoped>
  /** 备案号 
  .beianhao {
    position: absolute;
    bottom: 10px;
    left: auto;
    font-size: 12px;
    font-weight: bold;
  }*/
  
  .login-background {
    background: linear-gradient(155deg, #07070915 12%, var(--el-color-primary) 36%, #07070915 76%);
    filter: blur(100px);
  }
  
  .animate-float {
    animation: float 5s linear 0ms infinite;
  }


  [class*=el-col-] {
    box-sizing: border-box;
  }
  .el-col-24, .el-col-24.is-guttered {
    display: block;
  }
  .el-col-24 {
    flex: 0 0 100%;
    max-width: 100%;
  }


  .top-10px {
    top: 10px;
  }
  .right-10px {
    right: 10px;
  }


  .flex-items-center, .items-center, [items-center=""] {
    align-items: center;
  }


  .bg-gray-100, [bg-gray-100=""] {
    --un-bg-opacity: 1;
    background-color: rgb(243 244 246 / var(--un-bg-opacity));
  }
  .flex-col {
    flex-direction: column;
  }
  @media only screen and (min-width: 1200px) {
    .el-col-lg-8, .el-col-lg-8.is-guttered {
        display: block;
    }
  }
  @media only screen and (min-width: 1200px) {
    .el-col-lg-8 {
        flex: 0 0 33.3333333333%;
        max-width: 33.3333333333%;
    }
  }
  @media only screen and (min-width: 1200px) {
    .el-col-lg-16 {
        display: block;
        flex: 0 0 66.6666666667%;
        max-width: 66.6666666667%;
    }
  }
  
  @media only screen and (min-width: 992px) {
    .el-col-md-12 {
        display: block;
        flex: 0 0 50%;
        max-width: 50%;
    }
 }
  @media only screen and (min-width: 768px) {
    .el-col-sm-9, .el-col-sm-9.is-guttered {
        display: block;
    }
 }
  @media only screen and (min-width: 768px) {
    .el-col-sm-9 {
        flex: 0 0 37.5%;
        max-width: 37.5%;
    }
 }
 @media only screen and (min-width: 768px) {
    .el-col-sm-15 {
        display: block;
        flex: 0 0 62.5%;
        max-width: 62.5%;
    }
  }



 .chroma-text {
    background: linear-gradient(270deg, rgba(198, 141, 255, .9019607843) 8.92%, #5685ff 46.17%, var(--el-color-primary) 92.17%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    white-space: nowrap;
    color: transparent;
}


  // 通用
  .flex,[flex=''] {
    display: flex;
  }
  .flex-justify-center, .justify-center, [justify-center=""] {
    justify-content: center;
  }
  .flex-items-center, .items-center, [items-center=""] {
    align-items: center;
  }

  @keyframes float {
    0% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-20px);
    }
    100% {
      transform: translateY(0);
    }
  }
</style>