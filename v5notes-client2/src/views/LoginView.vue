<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppTheme } from '../hooks/useAppTheme'
import {
  type AuthFieldErrorKey,
  validateEmail,
  validateEmailCode,
  validateLoginAccount,
  validatePassword,
} from '../models/authValidation'
import SocialProviderIcon from '../components/SocialProviderIcon.vue'
import { hasSocialOAuthPending, readSocialCallbackParams, SOCIAL_PROVIDERS } from '../models/socialAuth'

const props = defineProps<{
  server: string
  useOfficial: boolean
  username: string
  password: string
  busy: boolean
  error: string
  authMode: 'login' | 'register'
  registerEnabled: boolean
  socialLoginEnabled: boolean
  email: string
  emailCode: string
  codeBusy: boolean
  codeWait: number
  enteringAfterRegister?: boolean
}>()

const emit = defineEmits<{
  'update:username': [value: string]
  'update:password': [value: string]
  'update:email': [value: string]
  'update:emailCode': [value: string]
  submit: []
  register: []
  'send-code': []
  'show-register': []
  'show-login': []
  'social-login': [source: string]
  settings: []
}>()

const { t } = useI18n()
const { mode, resolved, cycleTheme } = useAppTheme()

const brandIcon = new URL('../assets/brand-icon.png', import.meta.url).href
const codeInputRef = ref<HTMLInputElement | null>(null)
const codeNotice = ref('')
const codeSentOnce = ref(false)
const passwordVisible = ref(false)
const fieldErrors = reactive<Partial<Record<'account' | 'password' | 'email' | 'emailCode', AuthFieldErrorKey | null>>>({})

/** 官方地址不出现在页面上，只显示“官方服务器”；自定义地址显示主机名。 */
const serverLabel = computed(() => props.useOfficial
  ? t('login.official')
  : props.server.replace(/^https?:\/\//, '').replace(/\/+$/, ''))

const themeText = computed(() => t(
  mode.value === 'auto' ? 'login.themeAuto' : mode.value === 'light' ? 'login.themeLight' : 'login.themeDark',
))
const themeTitle = computed(() => `${t('login.theme')} · ${themeText.value}`)

const isRegister = computed(() => props.authMode === 'register')
const verifyStepActive = computed(() => codeSentOnce.value || Boolean(props.emailCode.trim()))

const submitLabel = computed(() => {
  if (props.enteringAfterRegister) return t('login.entering')
  if (props.busy && readSocialCallbackParams()) return t('login.socialCallback')
  if (props.busy && hasSocialOAuthPending()) return t('login.socialConnecting')
  if (props.busy) return t(isRegister.value ? 'login.registering' : 'login.connecting')
  return t(isRegister.value ? 'login.registerSubmit' : 'login.enter')
})

const showSocial = computed(() =>
  !isRegister.value && !props.enteringAfterRegister && props.socialLoginEnabled)

const codeButtonLabel = computed(() => {
  if (props.codeBusy) return t('login.sendingCode')
  if (props.codeWait > 0) return t('login.resendCode', { seconds: props.codeWait })
  return t('login.sendCode')
})

const fieldErrorText = (key: AuthFieldErrorKey | null | undefined) => (key ? t(`login.${key}`) : '')

function clearFieldErrors() {
  fieldErrors.account = null
  fieldErrors.password = null
  fieldErrors.email = null
  fieldErrors.emailCode = null
}

function validateLoginFields(): boolean {
  fieldErrors.account = validateLoginAccount(props.username)
  fieldErrors.password = validatePassword(props.password, 'login')
  return !fieldErrors.account && !fieldErrors.password
}

function validateRegisterFields(): boolean {
  fieldErrors.email = validateEmail(props.email)
  fieldErrors.password = validatePassword(props.password, 'register')
  fieldErrors.emailCode = validateEmailCode(props.emailCode)
  return !fieldErrors.email && !fieldErrors.password && !fieldErrors.emailCode
}

function onSubmit() {
  if (isRegister.value) {
    if (!validateRegisterFields()) return
    emit('register')
    return
  }
  if (!validateLoginFields()) return
  emit('submit')
}

function onSendCode() {
  fieldErrors.email = validateEmail(props.email)
  if (fieldErrors.email) return
  emit('send-code')
}

watch(() => props.authMode, () => {
  codeNotice.value = ''
  codeSentOnce.value = false
  passwordVisible.value = false
  clearFieldErrors()
})

watch(() => props.codeWait, async (next, prev) => {
  if (prev === 0 && next > 0) {
    codeSentOnce.value = true
    codeNotice.value = t('login.codeSent')
    await nextTick()
    codeInputRef.value?.focus()
  }
})

watch(() => props.error, (value) => {
  if (value) codeNotice.value = ''
})
</script>

<template>
  <div class="login-screen" :data-theme="resolved" :data-theme-mode="mode" :data-auth="authMode">
    <div class="login-atmos" aria-hidden="true">
      <div class="login-atmos-light">
        <span class="atmos-wash"></span>
        <span class="atmos-bloom atmos-bloom-a"></span>
        <span class="atmos-bloom atmos-bloom-b"></span>
        <span class="atmos-bloom atmos-bloom-c"></span>
        <span class="atmos-dots"></span>
        <span class="atmos-stripes"></span>
      </div>
      <div class="login-atmos-dark">
        <span class="atmos-night"></span>
        <span class="atmos-fog"></span>
      </div>
    </div>

    <header class="login-top">
      <div class="login-brand">
        <img :src="brandIcon" alt="" />
        <span class="login-wordmark">V5 / NOTES</span>
        <span class="login-brand-rule" aria-hidden="true"></span>
      </div>
      <div class="login-actions">
        <button
          class="login-theme"
          type="button"
          :aria-label="themeTitle"
          :title="themeTitle"
          @click="cycleTheme"
        >
          <span class="login-theme-icon" aria-hidden="true">
            <svg v-if="mode === 'auto'" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.2" /><path class="fill" d="M12 4.8a7.2 7.2 0 0 1 0 14.4Z" /></svg>
            <svg v-else-if="mode === 'light'" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.3" /><path d="M12 2.4v2.4M12 19.2v2.4M2.4 12h2.4M19.2 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" /></svg>
            <svg v-else viewBox="0 0 24 24"><path d="M20.2 13.6A8.2 8.2 0 1 1 10.4 3.8a6.6 6.6 0 0 0 9.8 9.8Z" /></svg>
          </span>
          <span class="login-theme-text">{{ themeText }}</span>
        </button>
        <span class="sr-only" role="status" aria-live="polite">{{ themeTitle }}</span>
        <button
          class="login-settings-trigger"
          type="button"
          :aria-label="t('login.settings')"
          :title="t('login.settings')"
          @click="emit('settings')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 1.72l-.06.4a2 2 0 0 1-1 1.4l-.7.4a2 2 0 0 1-1.72.2l-.38-.13a2 2 0 0 0-2.48.9l-.22.38a2 2 0 0 0 .43 2.55l.3.27a2 2 0 0 1 .66 1.6v.8a2 2 0 0 1-.66 1.6l-.3.27a2 2 0 0 0-.43 2.55l.22.38a2 2 0 0 0 2.48.9l.38-.13a2 2 0 0 1 1.72.2l.7.4a2 2 0 0 1 1 1.4l.06.4a2 2 0 0 0 2 1.72h.44a2 2 0 0 0 2-1.72l.06-.4a2 2 0 0 1 1-1.4l.7-.4a2 2 0 0 1 1.72-.2l.38.13a2 2 0 0 0 2.48-.9l.22-.38a2 2 0 0 0-.43-2.55l-.3-.27a2 2 0 0 1-.66-1.6v-.8a2 2 0 0 1 .66-1.6l.3-.27a2 2 0 0 0 .43-2.55l-.22-.38a2 2 0 0 0-2.48-.9l-.38.13a2 2 0 0 1-1.72-.2l-.7-.4a2 2 0 0 1-1-1.4l-.06-.4a2 2 0 0 0-2-1.72z" /><circle cx="12" cy="12" r="3" /></svg>
        </button>
      </div>
    </header>

    <div class="login-body">
      <section class="login-copy">
        <div class="login-lead">
          <h1>
            <span class="login-headline-lead">{{ t(isRegister ? 'login.registerHeadlineLead' : 'login.headlineLead') }}</span><br />
            <span class="login-headline-rest">{{ t(isRegister ? 'login.registerHeadlineRest' : 'login.headlineRest') }}</span>
          </h1>
          <p class="login-sub">{{ t(isRegister ? 'login.registerSubtitle' : 'login.subtitle') }}</p>
        </div>

        <div class="login-stage" aria-hidden="true">
          <svg class="login-wave" viewBox="0 0 1000 260" preserveAspectRatio="none">
            <defs>
              <linearGradient id="loginWaveStroke" x1="0" x2="1">
                <stop offset="0" stop-color="#7fc9bf" stop-opacity="0" />
                <stop offset=".18" stop-color="#7fc9bf" stop-opacity=".85" />
                <stop offset=".62" stop-color="#7fc9bf" stop-opacity=".55" />
                <stop offset="1" stop-color="#7fc9bf" stop-opacity="0" />
              </linearGradient>
              <filter id="loginWaveGlow" x="-10%" y="-60%" width="120%" height="220%">
                <feGaussianBlur stdDeviation="7" />
              </filter>
            </defs>
            <path class="wave-echo" vector-effect="non-scaling-stroke" d="M0 226 C 84 226 112 214 180 214 S 272 232 344 232 S 430 206 502 206 S 596 228 668 228 S 758 204 830 204 S 920 224 1000 224" />
            <path class="wave-halo" vector-effect="non-scaling-stroke" d="M0 196 C 72 196 98 208 156 208 S 244 186 300 186 S 372 212 438 212 S 520 196 578 196 S 660 172 726 172 S 812 202 878 202 S 950 190 1000 190" />
            <path class="wave-main" vector-effect="non-scaling-stroke" d="M0 196 C 72 196 98 208 156 208 S 244 186 300 186 S 372 212 438 212 S 520 196 578 196 S 660 172 726 172 S 812 202 878 202 S 950 190 1000 190" />
            <circle class="wave-dot" r="3.2">
              <animateMotion dur="9s" repeatCount="indefinite" path="M0 196 C 72 196 98 208 156 208 S 244 186 300 186 S 372 212 438 212 S 520 196 578 196 S 660 172 726 172 S 812 202 878 202 S 950 190 1000 190" />
            </circle>
            <circle class="wave-dot wave-dot-2" cx="0" cy="196" r="2.2">
              <animateMotion dur="12s" begin="4.5s" repeatCount="indefinite" path="M0 196 C 72 196 98 208 156 208 S 244 186 300 186 S 372 212 438 212 S 520 196 578 196 S 660 172 726 172 S 812 202 878 202 S 950 190 1000 190" />
            </circle>
          </svg>

          <div class="login-sheets">
            <span class="login-sheet login-sheet-3"><em>{{ t('login.showcase.modePreview') }} ×3</em></span>
            <span class="login-sheet login-sheet-2"><em>{{ t('login.showcase.modeSource') }} ×2</em></span>
            <article class="login-note">
              <div class="note-rail">
                <span class="note-mode">{{ t('login.showcase.modeLive') }}</span>
                <span class="note-mark">×1</span>
              </div>
              <h2>{{ t('login.showcase.noteTitle') }}</h2>
              <p>
                {{ t('login.showcase.noteLine1') }}<br />
                {{ t('login.showcase.noteLine2') }}<br />
                {{ t('login.showcase.noteLine3') }}
              </p>
              <footer><span>{{ t('login.showcase.noteMeta') }}</span><span>V5Notes</span></footer>
            </article>
          </div>
        </div>
      </section>

      <form class="login-card" :class="{ 'is-register': isRegister }" @submit.prevent="onSubmit">
        <div class="login-card-head">
          <span class="login-card-kicker">{{ t(isRegister ? 'login.registerKicker' : 'login.connect') }}</span>
          <p v-if="isRegister" class="login-card-hint">{{ t('login.registerHint') }}</p>
        </div>

        <ol v-if="isRegister" class="login-steps" :aria-label="t('login.registerKicker')">
          <li class="login-step" :class="{ 'is-current': !verifyStepActive, 'is-done': verifyStepActive }">
            <span class="login-step-index" aria-hidden="true">1</span>
            <span>{{ t('login.registerStepAccount') }}</span>
          </li>
          <li class="login-step-rule" aria-hidden="true"></li>
          <li class="login-step" :class="{ 'is-current': verifyStepActive }">
            <span class="login-step-index" aria-hidden="true">2</span>
            <span>{{ t('login.registerStepVerify') }}</span>
          </li>
        </ol>

        <div class="login-server" :class="{ 'is-custom': !useOfficial }">
          <span class="login-server-dot" aria-hidden="true" />
          <span>{{ t('login.server') }} · <strong>{{ serverLabel }}</strong></span>
          <button class="login-server-change" type="button" @click="emit('settings')">{{ t('login.change') }}</button>
        </div>

        <div class="login-fields" :class="{ 'is-register': isRegister }">
          <template v-if="!isRegister">
            <label class="login-field" :class="{ 'has-error': fieldErrors.account }">
              <span>{{ t('login.account') }}</span>
              <input
                :value="username"
                type="text"
                inputmode="email"
                autocomplete="username"
                :placeholder="t('login.accountHint')"
                required
                @input="emit('update:username', ($event.target as HTMLInputElement).value.trim()); fieldErrors.account = null"
                @blur="fieldErrors.account = validateLoginAccount(username)"
              />
              <span v-if="fieldErrors.account" class="login-field-error">{{ fieldErrorText(fieldErrors.account) }}</span>
            </label>
          </template>

          <template v-else>
            <label class="login-field" :class="{ 'has-error': fieldErrors.email }">
              <span>{{ t('login.email') }}</span>
              <input
                :value="email"
                type="email"
                autocomplete="email"
                required
                @input="emit('update:email', ($event.target as HTMLInputElement).value.trim()); fieldErrors.email = null"
                @blur="fieldErrors.email = validateEmail(email)"
              />
              <span v-if="fieldErrors.email" class="login-field-error">{{ fieldErrorText(fieldErrors.email) }}</span>
            </label>
          </template>

          <label class="login-field" :class="{ 'has-error': fieldErrors.password }">
            <span>{{ t('login.password') }}</span>
            <div class="login-password-wrap">
              <input
                :value="password"
                :type="passwordVisible ? 'text' : 'password'"
                :autocomplete="isRegister ? 'new-password' : 'current-password'"
                required
                @input="emit('update:password', ($event.target as HTMLInputElement).value); fieldErrors.password = null"
                @blur="fieldErrors.password = validatePassword(password, isRegister ? 'register' : 'login')"
              />
              <button
                class="login-password-toggle"
                type="button"
                :aria-label="passwordVisible ? t('login.hidePassword') : t('login.showPassword')"
                :title="passwordVisible ? t('login.hidePassword') : t('login.showPassword')"
                @click="passwordVisible = !passwordVisible"
              >
                <svg v-if="!passwordVisible" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 3l18 18" />
                  <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
                  <path d="M9.9 5.1A11.4 11.4 0 0 1 12 4.8c6.5 0 10 7.2 10 7.2a18.5 18.5 0 0 1-2.2 3.1" />
                  <path d="M6.7 6.7C4.2 8.4 2.5 10.8 2 12c0 0 3.5 7.2 10 7.2 1.4 0 2.7-.3 3.9-.8" />
                </svg>
              </button>
            </div>
            <span v-if="isRegister && !fieldErrors.password" class="login-field-hint">{{ t('login.passwordHint') }}</span>
            <span v-if="fieldErrors.password" class="login-field-error">{{ fieldErrorText(fieldErrors.password) }}</span>
          </label>

          <template v-if="isRegister">
            <div class="login-code-row">
              <label class="login-field" :class="{ 'has-error': fieldErrors.emailCode }">
                <span>{{ t('login.emailCode') }}</span>
                <input
                  ref="codeInputRef"
                  :value="emailCode"
                  inputmode="numeric"
                  maxlength="6"
                  autocomplete="one-time-code"
                  required
                  @input="emit('update:emailCode', ($event.target as HTMLInputElement).value.trim()); fieldErrors.emailCode = null"
                  @blur="fieldErrors.emailCode = validateEmailCode(emailCode)"
                />
                <span v-if="fieldErrors.emailCode" class="login-field-error">{{ fieldErrorText(fieldErrors.emailCode) }}</span>
              </label>
              <button
                class="login-code-send"
                type="button"
                :class="{ 'is-waiting': codeWait > 0 }"
                :disabled="codeBusy || codeWait > 0 || busy"
                @click="onSendCode"
              >
                {{ codeButtonLabel }}
              </button>
            </div>
            <p v-if="codeNotice && !error" class="login-notice" role="status">{{ codeNotice }}</p>
          </template>
        </div>

        <button class="login-submit" type="submit" :disabled="busy || enteringAfterRegister">
          <span class="login-cta-mark" aria-hidden="true">
            <svg viewBox="0 0 20 20"><path d="M4.5 10h7M8.5 6.5 12 10l-3.5 3.5" /><path d="M15.5 4.5v11" /></svg>
          </span>
          {{ submitLabel }}
        </button>

        <div class="login-footer-row">
          <button
            v-if="authMode === 'login' && registerEnabled && !enteringAfterRegister"
            class="login-switch"
            type="button"
            @click="emit('show-register')"
          >
            {{ t('login.createAccount') }}
            <span aria-hidden="true">→</span>
          </button>
          <button v-else-if="isRegister" class="login-switch" type="button" @click="emit('show-login')">
            <span aria-hidden="true">←</span>
            {{ t('login.backToLogin') }}
          </button>
        </div>

        <div v-if="showSocial" class="login-social">
          <div class="login-social-hint">{{ t('login.socialOther') }}</div>
          <div class="login-social-prov" role="group" :aria-label="t('login.socialOther')">
            <button
              v-for="provider in SOCIAL_PROVIDERS"
              :key="provider.source"
              class="login-social-btn"
              type="button"
              :disabled="busy || enteringAfterRegister"
              :title="t(provider.labelKey)"
              @click="emit('social-login', provider.source)"
            >
              <SocialProviderIcon :source="provider.source" />
              <span>{{ t(provider.labelKey) }}</span>
            </button>
          </div>
        </div>

        <p v-if="error" class="login-error" role="alert">{{ error }}</p>
      </form>
    </div>

    <footer class="login-facts">
      <div class="login-fact"><h3>{{ t('login.showcase.factModes') }}</h3><p>{{ t('login.showcase.factModesDesc') }}</p></div>
      <div class="login-fact"><h3>{{ t('login.showcase.factTree') }}</h3><p>{{ t('login.showcase.factTreeDesc') }}</p></div>
      <div class="login-fact"><h3>{{ t('login.showcase.factDraft') }}</h3><p>{{ t('login.showcase.factDraftDesc') }}</p></div>
      <div class="login-fact"><h3>{{ t('login.showcase.factFocus') }}</h3><p>{{ t('login.showcase.factFocusDesc') }}</p></div>
    </footer>
  </div>
</template>
