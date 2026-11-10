<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLoginTheme } from '../hooks/useLoginTheme'

const props = defineProps<{
  server: string
  useOfficial: boolean
  username: string
  password: string
  busy: boolean
  error: string
}>()

const emit = defineEmits<{
  'update:username': [value: string]
  'update:password': [value: string]
  submit: []
  settings: []
}>()

const { t } = useI18n()
const { mode, resolved, cycleTheme } = useLoginTheme()

const brandIcon = new URL('../assets/brand-icon.png', import.meta.url).href

/** 官方地址不出现在页面上，只显示“官方服务器”；自定义地址显示主机名。 */
const serverLabel = computed(() => props.useOfficial
  ? t('login.official')
  : props.server.replace(/^https?:\/\//, '').replace(/\/+$/, ''))

const themeText = computed(() => t(
  mode.value === 'auto' ? 'login.themeAuto' : mode.value === 'light' ? 'login.themeLight' : 'login.themeDark',
))
const themeTitle = computed(() => `${t('login.theme')} · ${themeText.value}`)
</script>

<template>
  <div class="login-screen" :data-theme="resolved" :data-theme-mode="mode">
    <div class="login-atmos" aria-hidden="true">
      <div class="login-atmos-light">
        <span class="atmos-wash"></span>
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
            <span class="login-headline-lead">{{ t('login.headlineLead') }}</span><br />
            <span class="login-headline-rest">{{ t('login.headlineRest') }}</span>
          </h1>
          <p class="login-sub">{{ t('login.subtitle') }}</p>
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

      <form class="login-card" @submit.prevent="emit('submit')">
        <span class="login-card-kicker">{{ t('login.connect') }}</span>
        <div class="login-server" :class="{ 'is-custom': !useOfficial }">
          <span class="login-server-dot" aria-hidden="true" />
          <span>{{ t('login.server') }} · <strong>{{ serverLabel }}</strong></span>
          <button class="login-server-change" type="button" @click="emit('settings')">{{ t('login.change') }}</button>
        </div>
        <label class="login-field">
          <span>{{ t('login.username') }}</span>
          <input :value="username" autocomplete="username" required @input="emit('update:username', ($event.target as HTMLInputElement).value.trim())" />
        </label>
        <label class="login-field">
          <span>{{ t('login.password') }}</span>
          <input :value="password" type="password" autocomplete="current-password" required @input="emit('update:password', ($event.target as HTMLInputElement).value)" />
        </label>
        <button class="login-submit" type="submit" :disabled="busy">
          <span class="login-cta-mark" aria-hidden="true">
            <svg viewBox="0 0 20 20"><path d="M4.5 10h7M8.5 6.5 12 10l-3.5 3.5" /><path d="M15.5 4.5v11" /></svg>
          </span>
          {{ busy ? t('login.connecting') : t('login.enter') }}
        </button>
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
