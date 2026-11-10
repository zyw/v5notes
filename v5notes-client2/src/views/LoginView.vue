<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

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
/** 官方地址不出现在页面上，只显示“官方服务器”；自定义地址显示主机名。 */
const serverLabel = computed(() => props.useOfficial
  ? t('login.official')
  : props.server.replace(/^https?:\/\//, '').replace(/\/+$/, ''))
</script>

<template>
  <div class="login-screen">
    <button class="login-settings-trigger" type="button" :aria-label="t('login.settings')" :title="t('login.settings')" @click="emit('settings')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 1.72l-.06.4a2 2 0 0 1-1 1.4l-.7.4a2 2 0 0 1-1.72.2l-.38-.13a2 2 0 0 0-2.48.9l-.22.38a2 2 0 0 0 .43 2.55l.3.27a2 2 0 0 1 .66 1.6v.8a2 2 0 0 1-.66 1.6l-.3.27a2 2 0 0 0-.43 2.55l.22.38a2 2 0 0 0 2.48.9l.38-.13a2 2 0 0 1 1.72.2l.7.4a2 2 0 0 1 1 1.4l.06.4a2 2 0 0 0 2 1.72h.44a2 2 0 0 0 2-1.72l.06-.4a2 2 0 0 1 1-1.4l.7-.4a2 2 0 0 1 1.72-.2l.38.13a2 2 0 0 0 2.48-.9l.22-.38a2 2 0 0 0-.43-2.55l-.3-.27a2 2 0 0 1-.66-1.6v-.8a2 2 0 0 1 .66-1.6l.3-.27a2 2 0 0 0 .43-2.55l-.22-.38a2 2 0 0 0-2.48-.9l-.38.13a2 2 0 0 1-1.72-.2l-.7-.4a2 2 0 0 1-1-1.4l-.06-.4a2 2 0 0 0-2-1.72z"/><circle cx="12" cy="12" r="3"/></svg></button>
    <div class="login-copy">
      <span class="eyebrow">V5 / NOTES</span>
      <h1>{{ t('login.headlineLead') }}<br />{{ t('login.headlineRest') }}</h1>
      <p>{{ t('login.subtitle') }}</p>
    </div>
    <form class="login-card" @submit.prevent="emit('submit')">
      <span class="eyebrow">{{ t('login.connect') }}</span>
      <div class="login-server" :class="{ 'is-custom': !useOfficial }">
        <span class="login-server-dot" aria-hidden="true" />
        <span>{{ t('login.server') }} · <strong>{{ serverLabel }}</strong></span>
        <button class="login-server-change" type="button" @click="emit('settings')">{{ t('login.change') }}</button>
      </div>
      <label>{{ t('login.username') }}<input :value="username" autocomplete="username" required @input="emit('update:username', ($event.target as HTMLInputElement).value.trim())" /></label>
      <label>{{ t('login.password') }}<input :value="password" type="password" autocomplete="current-password" required @input="emit('update:password', ($event.target as HTMLInputElement).value)" /></label>
      <button class="primary" type="submit" :disabled="busy">
        <span class="login-cta-mark" aria-hidden="true">
          <svg viewBox="0 0 20 20"><path d="M4.5 10h7M8.5 6.5 12 10l-3.5 3.5" /><path d="M15.5 4.5v11" /></svg>
        </span>
        {{ busy ? t('login.connecting') : t('login.enter') }}
      </button>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
    </form>
  </div>
</template>
