<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatReleaseDate, progressLabel, type UpdatePhase } from '../models/appUpdate'
import ReleaseNotes from './ReleaseNotes.vue'

const { t } = useI18n()
const props = defineProps<{
  phase: UpdatePhase
  currentVersion: string
}>()
const emit = defineEmits<{
  download: []
  install: []
  retry: []
  later: []
  close: []
  cancel: []
}>()

const offer = computed(() => {
  const phase = props.phase
  if (phase.kind === 'available' || phase.kind === 'downloading' || phase.kind === 'ready' || phase.kind === 'installing' || phase.kind === 'installed-notes') return phase.offer
  return null
})
const title = computed(() => {
  switch (props.phase.kind) {
    case 'checking': return t('update.checking')
    case 'current': return t('update.current')
    case 'available': return t('update.available', { version: props.phase.offer.version })
    case 'downloading': return t('update.downloading')
    case 'ready': return t('update.ready')
    case 'installing': return t('update.installing')
    case 'error': return t('update.failed')
    case 'unsupported': return t('update.unsupported')
    case 'installed-notes': return t('update.installed')
    default: return t('update.check')
  }
})
const eyebrow = computed(() => props.phase.kind === 'installed-notes' ? "WHAT'S NEW" : 'UPDATE')
const locked = computed(() => props.phase.kind === 'installing')
const notes = computed(() => offer.value?.notes ?? '')
const showNotes = computed(() => props.phase.kind === 'available' || props.phase.kind === 'downloading' || props.phase.kind === 'ready' || props.phase.kind === 'installed-notes')
const progress = computed(() => props.phase.kind === 'downloading' ? progressLabel(props.phase.received, props.phase.total) : '')
const progressRatio = computed(() => {
  if (props.phase.kind !== 'downloading' || !props.phase.total) return 0
  return Math.min(100, Math.floor((props.phase.received / props.phase.total) * 100))
})

function dismiss(): void {
  if (locked.value) return
  if (props.phase.kind === 'downloading') {
    emit('cancel')
    return
  }
  if (props.phase.kind === 'available' || props.phase.kind === 'ready') {
    emit('later')
    return
  }
  emit('close')
}

const dialogRef = ref<HTMLElement | null>(null)
const primaryButton = ref<HTMLButtonElement | null>(null)

onMounted(() => {
  void nextTick(() => (primaryButton.value ?? dialogRef.value)?.focus())
})

function primary(): void {
  if (props.phase.kind === 'available') emit('download')
  else if (props.phase.kind === 'ready') emit('install')
  else if (props.phase.kind === 'error') emit('retry')
  else emit('close')
}
</script>

<template>
  <div class="modal-backdrop update-backdrop" role="presentation" @click.self="dismiss">
    <section ref="dialogRef" class="modal update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-title" tabindex="-1" @keydown.esc.stop.prevent="dismiss">
      <span class="eyebrow">{{ eyebrow }}</span>
      <h2 id="update-title">{{ title }}</h2>
      <p v-if="offer && phase.kind !== 'installing'" class="update-meta">
        <span v-if="currentVersion && phase.kind !== 'installed-notes'">{{ currentVersion }} → {{ offer.version }}</span>
        <span v-if="offer.date">{{ formatReleaseDate(offer.date) }}</span>
      </p>
      <p v-else-if="phase.kind === 'installing'" class="update-meta">{{ t('update.installingHint') }}</p>
      <ReleaseNotes v-if="showNotes" :source="notes" />
      <div v-if="phase.kind === 'downloading'" class="update-progress" :class="{ 'is-indeterminate': !phase.total }" role="progressbar" :aria-valuenow="phase.total ? progressRatio : undefined" :aria-valuemin="0" :aria-valuemax="100" :aria-label="progress">
        <span :style="phase.total ? { width: `${progressRatio}%` } : undefined" />
      </div>
      <p v-if="phase.kind === 'downloading'" class="update-meta">{{ progress }}</p>
      <p v-if="phase.kind === 'error'" class="dialog-error" role="alert">{{ phase.message }}</p>
      <div class="modal-actions">
        <button v-if="phase.kind === 'available' || phase.kind === 'ready'" type="button" @click="emit('later')">{{ t('update.later') }}</button>
        <button v-else-if="phase.kind === 'downloading' || phase.kind === 'checking'" type="button" @click="dismiss">{{ t('update.cancel') }}</button>
        <button v-else-if="phase.kind === 'error'" type="button" @click="emit('close')">{{ t('update.close') }}</button>
        <button v-if="phase.kind !== 'checking' && phase.kind !== 'downloading' && phase.kind !== 'installing'" ref="primaryButton" class="primary" type="button" @click="primary">
          {{ phase.kind === 'available' ? t('update.download') : phase.kind === 'ready' ? t('update.restart') : phase.kind === 'error' ? t('update.retry') : t('update.close') }}
        </button>
        <button v-else-if="phase.kind === 'installing'" class="primary" type="button" disabled>{{ t('update.installingHint') }}</button>
      </div>
    </section>
  </div>
</template>
