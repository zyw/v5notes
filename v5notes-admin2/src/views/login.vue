<template>
  <div class="login-page" :data-theme="resolved">
    <!-- 左：科技感动效 + 笔记特点 -->
    <section class="login-scene" aria-label="V5Notes 产品介绍">
      <login-tech-background :theme="resolved" />
      <div class="scene-inner">
        <div class="brand">
          <img :src="brandLogo" alt="V5Notes" />
          <div>
            <b>V5Notes</b>
            <span>{{ $t('login.brandSub') }}</span>
          </div>
        </div>

        <div class="story">
          <h1>
            {{ $t('login.scene.line1') }}<br />
            {{ $t('login.scene.line2') }}<em>{{ $t('login.scene.accent') }}</em>{{ $t('login.scene.end') }}
          </h1>
          <p class="lede">{{ $t('login.scene.lede') }}</p>

          <ul class="features">
            <li>
              <span class="fi" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <path d="M8 13h8M8 17h5" />
                </svg>
              </span>
              <div class="ft">
                <b>{{ $t('login.scene.treeTitle') }}</b>
                <p>{{ $t('login.scene.treeDesc') }}</p>
              </div>
            </li>
            <li>
              <span class="fi" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M4 19V5" />
                  <path d="M8 16l4-9 4 9" />
                  <path d="M9.5 13h5" />
                </svg>
              </span>
              <div class="ft">
                <b>{{ $t('login.scene.mdTitle') }}</b>
                <p>{{ $t('login.scene.mdDesc') }}</p>
              </div>
            </li>
            <li>
              <span class="fi" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z" />
                  <path d="M9.2 12l2 2 3.6-4" />
                </svg>
              </span>
              <div class="ft">
                <b>{{ $t('login.scene.permTitle') }}</b>
                <p>{{ $t('login.scene.permDesc') }}</p>
              </div>
            </li>
          </ul>
        </div>

        <div class="scene-foot">
          <span>V5NOTES · ADMIN CONSOLE</span>
          <span>v2.0.0</span>
        </div>
      </div>
    </section>

    <!-- 右：登录 -->
    <section class="login-panel">
      <div class="panel-head">
        <button
          class="theme-toggle"
          type="button"
          :aria-label="themeLabel"
          :title="themeLabel"
          :data-mode="mode"
          @click="cycleTheme"
        >
          <svg v-if="mode === 'auto'" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8M12 16v4" />
          </svg>
          <svg v-else-if="mode === 'dark'" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </button>
        <div class="lang-switch" role="group" :aria-label="$t('login.langAria')">
          <button type="button" :aria-pressed="appStore.language === 'zh_CN'" @click="switchLang('zh_CN')">简体中文</button>
          <i aria-hidden="true">/</i>
          <button type="button" :aria-pressed="appStore.language === 'zh_TW'" @click="switchLang('zh_TW')">繁體中文</button>
          <i aria-hidden="true">/</i>
          <button type="button" :aria-pressed="appStore.language === 'en_US'" @click="switchLang('en_US')">English</button>
        </div>
      </div>

      <el-form
        ref="loginRef"
        :model="loginForm"
        :rules="loginRules"
        label-position="top"
        class="login-form"
        @submit.prevent="handleLogin"
      >
        <div class="form-head">
          <h2>{{ $t('login.welcome') }}</h2>
          <p>{{ $t('login.welcomeSub') }}</p>
        </div>

        <el-form-item prop="username" :label="$t('login.account')">
          <el-input
            v-model="loginForm.username"
            type="text"
            size="large"
            autocomplete="username"
            :placeholder="$t('login.accountPh')"
          />
        </el-form-item>

        <el-form-item prop="password" :label="$t('login.password')">
          <div class="pw-field">
            <el-input
              v-model="loginForm.password"
              :type="passwordVisible ? 'text' : 'password'"
              size="large"
              autocomplete="current-password"
              :placeholder="$t('login.passwordPh')"
              @keyup.enter="handleLogin"
            />
            <button
              class="pw-eye"
              type="button"
              :aria-label="passwordVisible ? $t('login.hidePassword') : $t('login.showPassword')"
              :aria-pressed="passwordVisible"
              @click="togglePassword"
            >
              <svg v-if="!passwordVisible" viewBox="0 0 24 24">
                <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
                <circle cx="12" cy="12" r="2.7" />
              </svg>
              <svg v-else viewBox="0 0 24 24">
                <path d="M3 3l18 18" />
                <path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.4 3.9" />
                <path d="M6.2 7.4A16.5 16.5 0 0 0 2.5 12S6 18 12 18c1.6 0 3-.5 4.2-1.2" />
              </svg>
            </button>
          </div>
        </el-form-item>

        <el-form-item v-if="captchaEnabled" prop="code" :label="$t('login.code')" class="captcha-item">
          <div class="captcha-row">
            <el-input
              v-model="loginForm.code"
              size="large"
              autocomplete="off"
              maxlength="4"
              :placeholder="$t('login.codePh')"
              @keyup.enter="handleLogin"
            />
            <button class="code-box" type="button" :aria-label="$t('login.refreshCode')" @click="getCode">
              <img v-if="codeUrl" :src="codeUrl" alt="" />
            </button>
          </div>
        </el-form-item>

        <div class="form-meta">
          <el-checkbox v-model="loginForm.rememberMe">{{ $t('login.rememberAccount') }}</el-checkbox>
          <button class="refresh" type="button" @click="getCode">{{ $t('login.refreshCode') }}</button>
        </div>

        <el-button class="submit" type="primary" :loading="loading" @click="handleLogin">
          {{ loading ? $t('login.submitLoading') : $t('login.submit') }}
        </el-button>

        <div v-if="socialLoginEnabled" class="alt">
          <div class="alt-hint">{{ $t('login.otherWays') }}</div>
          <div class="prov" role="group" :aria-label="$t('login.otherWays')">
            <button
              v-for="item in providers"
              :key="item.source"
              type="button"
              :title="$t('login.social.' + item.source)"
              @click="doSocialLogin(item.source)"
            >
              <svg-icon :icon-class="item.icon" class="prov-icon" />
              <span>{{ $t('login.socialShort.' + item.source) }}</span>
            </button>
          </div>
        </div>
      </el-form>

      <div class="panel-foot">
        <span>Copyright © 2018-{{ currentYear }} V5科技 All Rights Reserved.</span>
        <span class="ver">v2.0.0</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { to } from 'await-to-js';
import LoginTechBackground from '@/components/LoginTechBackground/index.vue';
import { useThemeMode } from '@/composables/useThemeMode';
import { useI18n } from 'vue-i18n';
import brandLogo from '@/assets/logo/logo.png';
import { getCodeImg, getThirdPartyLoginEnabled } from '@/api/login';
import { authRouterUrl } from '@/api/system/social/auth';
import { LoginData } from '@/api/types';
import { HttpStatus } from '@/enums/RespEnum';
import { useAppStore } from '@/store/modules/app';
import { useUserStore } from '@/store/modules/user';

const { t } = useI18n();
const appStore = useAppStore();
const userStore = useUserStore();
const router = useRouter();
const { mode, resolved, label: themeLabel, cycle: cycleTheme } = useThemeMode();

const currentYear = new Date().getFullYear();
/** 与后端 justauth、个人中心绑定列表一致：Gitee、GitHub */
const providers = [
  { source: 'gitee', icon: 'gitee' },
  { source: 'github', icon: 'github' }
] as const;

const loginForm = ref<LoginData>({
  username: '',
  password: '',
  rememberMe: false,
  code: '',
  uuid: ''
} as LoginData);

const loginRules = computed<ElFormRules>(() => ({
  username: [{ required: true, trigger: 'blur', message: t('login.rule.username.required') }],
  password: [{ required: true, trigger: 'blur', message: t('login.rule.password.required') }],
  code: [{ required: true, trigger: 'change', message: t('login.rule.code.required') }]
}));

const codeUrl = ref('');
const loading = ref(false);
const passwordVisible = ref(false);
const captchaEnabled = ref(true);
const socialLoginEnabled = ref(false);
const redirect = ref('/');
const loginRef = ref<ElFormInstance>();

watch(
  () => router.currentRoute.value,
  (newRoute: any) => {
    redirect.value = newRoute.query && newRoute.query.redirect && decodeURIComponent(newRoute.query.redirect);
  },
  { immediate: true }
);

function switchLang(lang: 'zh_CN' | 'zh_TW' | 'en_US') {
  if (appStore.language === lang) return;
  appStore.changeLanguage(lang);
}

const handleLogin = () => {
  loginRef.value?.validate(async (valid: boolean) => {
    if (!valid) {
      await nextTick();
      document.querySelector<HTMLInputElement>('.login-form .el-form-item.is-error input')?.focus();
      return;
    }
    loading.value = true;
    if (loginForm.value.rememberMe) {
      localStorage.setItem('username', String(loginForm.value.username));
      localStorage.setItem('rememberMe', String(loginForm.value.rememberMe));
    } else {
      localStorage.removeItem('username');
      localStorage.removeItem('rememberMe');
    }
    localStorage.removeItem('password');
    const [err] = await to(userStore.login(loginForm.value));
    if (!err) {
      const redirectUrl = redirect.value || '/';
      await router.push(redirectUrl);
      loading.value = false;
    } else {
      loading.value = false;
      if (captchaEnabled.value) {
        await getCode();
      }
    }
  });
};

function togglePassword() {
  passwordVisible.value = !passwordVisible.value;
}

const getCode = async () => {
  const res = await getCodeImg();
  const { data } = res;
  captchaEnabled.value = data.captchaEnabled === undefined ? true : data.captchaEnabled;
  if (captchaEnabled.value) {
    loginForm.value.code = '';
    codeUrl.value = 'data:image/gif;base64,' + data.img;
    loginForm.value.uuid = data.uuid;
  }
};

const getLoginData = () => {
  const username = localStorage.getItem('username');
  const rememberMe = localStorage.getItem('rememberMe');
  localStorage.removeItem('password');
  loginForm.value = {
    username: username === null ? '' : username,
    password: '',
    rememberMe: rememberMe === 'true'
  } as LoginData;
};

const doSocialLogin = (type: string) => {
  if (!socialLoginEnabled.value) {
    ElMessage.warning(t('login.socialOff'));
    return;
  }
  authRouterUrl(type).then((res: any) => {
    if (res.code === HttpStatus.SUCCESS) {
      window.location.href = res.data;
    } else {
      ElMessage.error(res.msg);
    }
  });
};

const loadSocialLoginEnabled = async () => {
  try {
    const res = await getThirdPartyLoginEnabled();
    socialLoginEnabled.value = Boolean(res.data);
  } catch {
    socialLoginEnabled.value = false;
  }
};

onMounted(() => {
  getCode();
  getLoginData();
  loadSocialLoginEnabled();
});
</script>

<style lang="scss" scoped>
/* ==========================================================================
   登录页 · 左侧科技动效 + 笔记特点 / 右侧表单
   ========================================================================== */
.login-page {
  display: grid;
  grid-template-columns: 56% 44%;
  min-height: 100vh;
  background: #f4f7f5;
}

/* ---------------- 左侧场景 ---------------- */
.login-scene {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 52px 64px 36px;
  overflow: hidden;
  background:
    radial-gradient(860px 500px at 2% -12%, rgba(28, 90, 72, 0.06), transparent 62%),
    radial-gradient(760px 520px at 98% 108%, rgba(79, 191, 148, 0.12), transparent 64%),
    radial-gradient(520px 420px at 62% 46%, rgba(255, 255, 255, 0.7), transparent 70%),
    linear-gradient(158deg, #f8fcfa 0%, #eff6f1 54%, #e8f1eb 100%);
  border-right: 1px solid #e2ebe5;
}


.scene-inner {
  position: relative;
  z-index: 2;
  display: flex;
  flex: 1;
  flex-direction: column;
}

.brand {
  display: flex;
  align-items: center;
  gap: 11px;

  img {
    display: block;
    width: 32px;
    height: 32px;
  }

  b {
    display: block;
    color: #15241e;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: 0.01em;
  }

  span {
    display: block;
    margin-top: 3px;
    color: #5f7067;
    font-size: 11px;
    letter-spacing: 0.02em;
  }
}

.story {
  max-width: 470px;
  margin: auto 0;
  padding: 26px 0;

  h1 {
    margin: 0 0 18px;
    color: #15241e;
    font-size: clamp(30px, 3.1vw, 44px);
    font-weight: 600;
    line-height: 1.24;
    letter-spacing: -0.025em;

    em {
      color: #1c5a48;
      font-style: normal;
    }
  }

  .lede {
    max-width: 410px;
    margin: 0;
    color: #5f7067;
    font-size: 14.5px;
    line-height: 1.85;
  }
}

.features {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 430px;
  margin: 34px 0 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: flex-start;
    gap: 13px;
  }
}

.fi {
  display: grid;
  flex: 0 0 30px;
  place-items: center;
  width: 30px;
  height: 30px;
  margin-top: 1px;
  border: 1px solid #cfe3d8;
  border-radius: 9px;
  background: #fff;

  svg {
    width: 15px;
    height: 15px;
    stroke: #1c5a48;
    stroke-width: 1.5;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}

.ft {
  b {
    display: block;
    color: #15241e;
    font-size: 13.5px;
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  p {
    margin: 3px 0 0;
    color: #5f7067;
    font-size: 12.5px;
    line-height: 1.7;
  }
}

.scene-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
  color: #7d8d84;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  letter-spacing: 0.08em;
}

/* ---------------- 右侧表单 ---------------- */
.login-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 44px 56px 30px;
  background: #fff;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.lang-switch {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 2px;

  button {
    padding: 5px 7px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: #8a9991;
    font-family: inherit;
    font-size: 12.5px;
    line-height: 1;
    cursor: pointer;

    &[aria-pressed='true'] {
      color: #15241e;
      font-weight: 600;
    }

    &:hover {
      color: #1c5a48;
    }

    &:focus-visible {
      outline: 2px solid #1c5a48;
      outline-offset: 1px;
    }
  }

  i {
    color: #ccd5d0;
    font-style: normal;
  }
}

.login-form {
  width: 100%;
  max-width: 352px;
  margin: auto;
  padding: 36px 0 24px;
}

.form-head {
  margin-bottom: 30px;

  h2 {
    margin: 0;
    color: #15241e;
    font-size: 26px;
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: -0.02em;
  }

  p {
    margin: 7px 0 0;
    color: #5f7067;
    font-size: 13px;
  }
}

.login-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.login-form :deep(.el-form-item.is-required:not(.is-no-asterisk) > .el-form-item__label::before) {
  display: none;
}

.login-form :deep(.el-form-item__label) {
  padding: 0;
  margin-bottom: 7px;
  color: #2b3a32;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.4;
}

.login-form :deep(.el-input__wrapper) {
  height: 46px;
  padding: 0 13px;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 0 0 1px #dfe5e1 inset;
  transition: box-shadow 0.16s;
}

.login-form :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #cbd5cf inset;
}

.login-form :deep(.el-input__wrapper.is-focus) {
  box-shadow:
    0 0 0 1px #1c5a48 inset,
    0 0 0 3px rgba(28, 90, 72, 0.12);
}

.login-form :deep(.el-input__inner) {
  height: 44px;
  color: #15241e;
  font-size: 14px;
}

.login-form :deep(.el-input__inner::placeholder) {
  color: #7c8b84;
}

.login-form :deep(.el-input__password) {
  color: #7f8f87;
}

.login-form :deep(.el-form-item__error) {
  position: static;
  padding-top: 5px;
  color: #b4534b;
  font-size: 11.5px;
  line-height: 1.4;
}

.login-form :deep(.el-form-item.is-error .el-input__wrapper) {
  box-shadow: 0 0 0 1px #d9a3a0 inset;
}

.captcha-row {
  display: flex;
  gap: 10px;
  width: 100%;

  :deep(.el-input) {
    flex: 1;
    min-width: 0;
  }
}

.code-box {
  flex: 0 0 112px;
  width: 112px;
  height: 46px;
  padding: 0;
  overflow: hidden;
  border: 1px solid #dfe5e1;
  border-radius: 10px;
  background: #e8f2ec;
  cursor: pointer;

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &:focus-visible {
    outline: 2px solid #1c5a48;
    outline-offset: 2px;
  }
}

.pw-field {
  position: relative;
  width: 100%;

  :deep(.el-input__wrapper) {
    padding-right: 42px;
  }
}

.pw-eye {
  position: absolute;
  top: 50%;
  right: 8px;
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: none;
  transform: translateY(-50%);
  place-items: center;
  cursor: pointer;

  svg {
    width: 17px;
    height: 17px;
    stroke: #7f8f87;
    stroke-width: 1.5;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:hover {
    background: #e8f2ec;
  }

  &:focus-visible {
    outline: 2px solid #1c5a48;
    outline-offset: 0;
  }
}

.form-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 2px 0 20px;
}

.login-form :deep(.el-checkbox__label) {
  color: #2b3a32;
  font-size: 12.5px;
}

.login-form :deep(.el-checkbox__inner) {
  width: 15px;
  height: 15px;
  border-radius: 4px;
  border-color: #c9d3cd;
}

.login-form :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  border-color: #1c5a48;
  background: #1c5a48;
}

.refresh {
  padding: 0;
  border: 0;
  background: none;
  color: #17624a;
  font-family: inherit;
  font-size: 12.5px;
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: rgba(23, 98, 74, 0.35);
  cursor: pointer;

  &:hover {
    color: #1c5a48;
  }

  &:focus-visible {
    outline: 2px solid #1c5a48;
    outline-offset: 2px;
    border-radius: 3px;
  }
}

.submit {
  width: 100%;
  height: 46px;
  border: 0;
  border-radius: 10px;
  background: #1c5a48;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  box-shadow: 0 8px 20px rgba(28, 90, 72, 0.18);
  transition:
    background 0.16s,
    box-shadow 0.16s,
    transform 0.12s;

  &:hover,
  &:focus {
    background: #236a55;
    box-shadow: 0 10px 24px rgba(28, 90, 72, 0.22);
  }

  &:active {
    transform: translateY(1px);
  }

  &:focus-visible {
    outline: 2px solid #1c5a48;
    outline-offset: 3px;
  }

  :deep(.el-icon) {
    margin-right: 6px;
  }
}

.alt {
  margin-top: 26px;

  .alt-hint {
    display: flex;
    align-items: center;
    gap: 12px;
    color: #8a9991;
    font-size: 11.5px;

    &::before,
    &::after {
      flex: 1;
      height: 1px;
      background: #edf1ee;
      content: '';
    }
  }
}

.prov {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 4px;
  margin-top: 12px;

  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border: 0;
    border-radius: 7px;
    background: none;
    color: #5f7067;
    font-family: inherit;
    font-size: 12.5px;
    line-height: 1;
    cursor: pointer;

    &:hover {
      background: #e8f2ec;
      color: #17624a;
    }

    &:focus-visible {
      outline: 2px solid #1c5a48;
      outline-offset: 1px;
    }
  }

  :deep(.prov-icon) {
    width: 16px;
    height: 16px;
    font-size: 16px;
  }
}

.panel-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: auto;
  color: #6f7f77;
  font-size: 12px;

  .ver {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 12px;
    letter-spacing: 0.06em;
  }
}

/* ---------------- 响应式 ---------------- */
@media (max-width: 1180px) and (min-width: 921px) {
  .login-scene {
    padding-right: 46px;
    padding-left: 46px;
  }

  .login-panel {
    padding-right: 38px;
    padding-left: 38px;
  }

  .story h1 {
    font-size: 36px;
  }
}

@media (max-width: 920px) {
  .login-page {
    grid-template-columns: 1fr;
  }

  .login-scene {
    height: 392px;
    min-height: 0;
    padding: 26px 22px 22px;
  }

  .brand img {
    width: 26px;
    height: 26px;
  }

  .brand b {
    font-size: 12.5px;
  }

  .brand span {
    font-size: 10px;
  }

  .story {
    max-width: none;
    margin: 22px 0 0;
    padding: 0;

    h1 {
      margin-bottom: 10px;
      font-size: 27px;
      line-height: 1.3;
    }

    .lede {
      max-width: 340px;
      font-size: 12.5px;
      line-height: 1.7;
    }
  }

  .features {
    gap: 11px;
    max-width: none;
    margin-top: 18px;
  }

  .fi {
    flex-basis: 26px;
    width: 26px;
    height: 26px;
    border-radius: 8px;

    svg {
      width: 13px;
      height: 13px;
    }
  }

  .ft {
    b {
      font-size: 12px;
    }

    p {
      margin-top: 2px;
      font-size: 11px;
      line-height: 1.55;
    }
  }

  .scene-foot {
    display: none;
  }

  .login-panel {
    min-height: 0;
    padding: 22px 20px 26px;
  }

  .login-form {
    max-width: none;
    padding: 14px 0 6px;
  }

  .form-head h2 {
    font-size: 24px;
  }

  .form-head {
    margin-bottom: 22px;
  }

  .panel-foot {
    margin-top: 22px;
  }
}

/* ==========================================================================
   主题切换按钮（仅图标，三态：跟随系统 / 深色 / 浅色）
   ========================================================================== */
.panel-head {
  gap: 10px;
}

.theme-toggle {
  display: grid;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid #e2ebe5;
  border-radius: 9px;
  background: #fff;
  color: #4a5b52;
  cursor: pointer;
  transition:
    background 0.16s,
    border-color 0.16s,
    color 0.16s;
  place-items: center;

  svg {
    width: 17px;
    height: 17px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:hover {
    border-color: #cfe3d8;
    background: #e8f2ec;
    color: #1c5a48;
  }

  &:focus-visible {
    outline: 2px solid #1c5a48;
    outline-offset: 2px;
  }
}

/* ==========================================================================
   深色主题
   ========================================================================== */
.login-page[data-theme='dark'] {
  background: #050d0a;
}

.login-page[data-theme='dark'] .login-scene {
  border-right-color: #12241c;
  background: #06120e;
}

.login-page[data-theme='dark'] .brand b {
  color: #f2fbf6;
}

.login-page[data-theme='dark'] .brand span {
  color: rgba(214, 236, 225, 0.62);
}

.login-page[data-theme='dark'] .story h1 {
  color: #f4fbf7;
}

.login-page[data-theme='dark'] .story h1 em {
  color: #8fe0bc;
}

.login-page[data-theme='dark'] .story .lede {
  color: rgba(216, 236, 226, 0.72);
}

.login-page[data-theme='dark'] .fi {
  border-color: rgba(143, 224, 188, 0.2);
  background: rgba(143, 224, 188, 0.06);
}

.login-page[data-theme='dark'] .fi svg {
  stroke: #8fe0bc;
}

.login-page[data-theme='dark'] .ft b {
  color: #eaf5ef;
}

.login-page[data-theme='dark'] .ft p {
  color: rgba(206, 229, 217, 0.62);
}

.login-page[data-theme='dark'] .scene-foot {
  color: rgba(190, 216, 203, 0.58);
}

.login-page[data-theme='dark'] .login-panel {
  background: #0b1410;
}

.login-page[data-theme='dark'] .theme-toggle {
  border-color: #24352c;
  background: #101b16;
  color: #9fc0ae;
}

.login-page[data-theme='dark'] .theme-toggle:hover {
  border-color: #2f4439;
  background: #16261e;
  color: #8fe0bc;
}

.login-page[data-theme='dark'] .lang-switch button {
  color: #8fa39a;
}

.login-page[data-theme='dark'] .lang-switch button[aria-pressed='true'] {
  color: #e9f5ee;
}

.login-page[data-theme='dark'] .lang-switch button:hover {
  color: #8fe0bc;
}

.login-page[data-theme='dark'] .lang-switch i {
  color: #33463d;
}

.login-page[data-theme='dark'] .form-head h2 {
  color: #eef7f2;
}

.login-page[data-theme='dark'] .form-head p {
  color: #9fb3a8;
}

.login-page[data-theme='dark'] .login-form :deep(.el-form-item__label) {
  color: #cfe0d7;
}

.login-page[data-theme='dark'] .login-form :deep(.el-input__wrapper) {
  background: #101b16;
  box-shadow: 0 0 0 1px #24352c inset;
}

.login-page[data-theme='dark'] .login-form :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #2f4439 inset;
}

.login-page[data-theme='dark'] .login-form :deep(.el-input__wrapper.is-focus) {
  box-shadow:
    0 0 0 1px #4fbf94 inset,
    0 0 0 3px rgba(79, 191, 148, 0.18);
}

.login-page[data-theme='dark'] .login-form :deep(.el-input__inner) {
  color: #eaf5ef;
}

.login-page[data-theme='dark'] .login-form :deep(.el-input__inner::placeholder) {
  color: #6f8478;
}

.login-page[data-theme='dark'] .pw-eye svg {
  stroke: #7f9a8c;
}

.login-page[data-theme='dark'] .pw-eye:hover {
  background: #1b2c23;
}

.login-page[data-theme='dark'] .login-form :deep(.el-form-item__error) {
  color: #e08a82;
}

.login-page[data-theme='dark'] .login-form :deep(.el-form-item.is-error .el-input__wrapper) {
  box-shadow: 0 0 0 1px #7a4a46 inset;
}

.login-page[data-theme='dark'] .code-box {
  border-color: #24352c;
  background: #16241d;
}

.login-page[data-theme='dark'] .login-form :deep(.el-checkbox__label) {
  color: #cfe0d7;
}

.login-page[data-theme='dark'] .login-form :deep(.el-checkbox__inner) {
  border-color: #3b5145;
}

.login-page[data-theme='dark'] .login-form :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  border-color: #4fbf94;
  background: #4fbf94;
}

.login-page[data-theme='dark'] .refresh {
  color: #7fd6b0;
  text-decoration-color: rgba(127, 214, 176, 0.4);
}

.login-page[data-theme='dark'] .refresh:hover {
  color: #9be7c6;
}

.login-page[data-theme='dark'] .submit {
  background: #4fbf94;
  color: #07130d;
  box-shadow: 0 8px 20px rgba(79, 191, 148, 0.18);
}

.login-page[data-theme='dark'] .submit:hover,
.login-page[data-theme='dark'] .submit:focus {
  background: #5fd0a4;
  box-shadow: 0 10px 24px rgba(79, 191, 148, 0.24);
}

.login-page[data-theme='dark'] .alt .alt-hint {
  color: #7f948a;
}

.login-page[data-theme='dark'] .alt .alt-hint::before,
.login-page[data-theme='dark'] .alt .alt-hint::after {
  background: #1e2d25;
}

.login-page[data-theme='dark'] .prov button {
  color: #9fb3a8;
}

.login-page[data-theme='dark'] .prov button:hover {
  background: #17271f;
  color: #7fd6b0;
}

.login-page[data-theme='dark'] .panel-foot {
  color: #8ba396;
}
</style>
