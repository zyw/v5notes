<template>
  <div class="error-state" role="alert" aria-live="polite">
    <div class="es-icon" :data-kind="kind">
      <svg v-if="kind === 'timeout'" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.4" /><path d="M12 7.4V12l3 1.8" /></svg>
      <svg v-else-if="kind === 'session'" viewBox="0 0 24 24"><rect x="4.6" y="10.4" width="14.8" height="9.6" rx="2.2" /><path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6" /><path d="M12 14.4v2.2" /></svg>
      <svg v-else-if="kind === 'server'" viewBox="0 0 24 24"><path d="M6.8 17.4h9.6a3.4 3.4 0 0 0 .5-6.76A5 5 0 0 0 7.9 9.2a3 3 0 0 0-1.1 8.2z" /><path d="M4.4 20.2 19.6 4.8" /></svg>
      <svg v-else viewBox="0 0 24 24"><path d="M3.5 9.5a13 13 0 0 1 17 0" /><path d="M6.5 13a8.5 8.5 0 0 1 11 0" /><path d="M9.6 16.4a4 4 0 0 1 4.8 0" /><path d="M12 20h.01" /></svg>
    </div>
    <div class="es-eyebrow">{{ eyebrow }}</div>
    <h3 class="es-title">{{ resolvedTitle }}</h3>
    <p class="es-body">{{ resolvedMessage }}</p>
    <div class="es-actions">
      <el-button type="primary" @click="$emit('retry')">{{ resolvedRetry }}</el-button>
      <el-button v-if="secondaryText" @click="$emit('secondary')">{{ secondaryText }}</el-button>
    </div>
  </div>
</template>

<script setup name="ErrorState" lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ErrorKind } from '@/utils/errorKind';

const props = withDefaults(
  defineProps<{
    kind?: ErrorKind;
    title?: string;
    message?: string;
    retryText?: string;
    secondaryText?: string;
  }>(),
  { kind: 'unknown', retryText: '' }
);

defineEmits<{ retry: []; secondary: [] }>();

const { t } = useI18n();
const EYEBROW: Record<ErrorKind, string> = {
  timeout: 'TIMEOUT',
  network: 'NETWORK',
  session: '401 · UNAUTHORIZED',
  server: '5XX · SERVER ERROR',
  unknown: 'ERROR'
};
const eyebrow = computed(() => EYEBROW[props.kind] || 'ERROR');
const resolvedRetry = computed(() => props.retryText || t('error.retry'));
const resolvedTitle = computed(() => t(`error.${props.kind}.title`));
const resolvedMessage = computed(() => {
  if (props.kind === 'server' && props.message) {
    const code = props.message.match(/\d{3}/)?.[0];
    if (code) return t('error.server.messageWithCode', { code });
  }
  if (props.kind === 'unknown' && props.message && props.message !== t('error.unknown.message')) {
    return props.message;
  }
  return t(`error.${props.kind}.message`);
});
</script>
