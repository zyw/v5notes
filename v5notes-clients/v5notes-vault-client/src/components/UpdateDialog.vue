<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import ReleaseNotes from './ReleaseNotes.vue'
import {
  formatReleaseDate,
  progressLabel,
  updateTitle,
  type UpdatePhase,
} from '../update/appUpdate'

/**
 * 一个对话框承接检查、下载、安装和本版说明。
 * 进度与结果都留在原位（进度条、就地错误），关掉对话框只在可以安全关闭时出现。
 */
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
  if (
    phase.kind === 'available' ||
    phase.kind === 'downloading' ||
    phase.kind === 'ready' ||
    phase.kind === 'installing' ||
    phase.kind === 'installed-notes'
  ) {
    return phase.offer
  }
  return null
})

const title = computed(() => updateTitle(props.phase))
const eyebrow = computed(() => (props.phase.kind === 'installed-notes' ? '本版更新' : '在线升级'))
const showNotes = computed(
  () =>
    props.phase.kind === 'available' ||
    props.phase.kind === 'downloading' ||
    props.phase.kind === 'ready' ||
    props.phase.kind === 'installed-notes',
)
const notes = computed(() => offer.value?.notes ?? '')
const progress = computed(() => (props.phase.kind === 'downloading' ? progressLabel(props.phase.received, props.phase.total) : ''))
const progressRatio = computed(() => {
  if (props.phase.kind !== 'downloading' || !props.phase.total) return 0
  return Math.min(100, Math.floor((props.phase.received / props.phase.total) * 100))
})
/** 下载与安装期间不允许关闭，否则会把半途状态留在后台。 */
const locked = computed(() => props.phase.kind === 'installing' || props.phase.kind === 'downloading')

const primaryLabel = computed(() => {
  switch (props.phase.kind) {
    case 'available': return '下载并安装'
    case 'ready': return '立即重启'
    case 'error': return '重试'
    default: return '关闭'
  }
})

const secondaryLabel = computed(() => {
  switch (props.phase.kind) {
    case 'available':
    case 'ready': return '稍后'
    case 'checking':
    case 'downloading': return '取消'
    case 'error': return '关闭'
    default: return ''
  }
})

const secondaryAction = computed<'later' | 'cancel' | 'close'>(() => {
  switch (props.phase.kind) {
    case 'available':
    case 'ready': return 'later'
    case 'checking':
    case 'downloading': return 'cancel'
    default: return 'close'
  }
})

function dismiss(): void {
  if (locked.value) return
  if (props.phase.kind === 'checking') {
    emit('cancel')
    return
  }
  if (props.phase.kind === 'available' || props.phase.kind === 'ready') {
    emit('later')
    return
  }
  emit('close')
}

function runSecondary(): void {
  switch (secondaryAction.value) {
    case 'later': emit('later'); return
    case 'cancel': emit('cancel'); return
    default: emit('close')
  }
}

function primary(): void {
  switch (props.phase.kind) {
    case 'available': emit('download'); return
    case 'ready': emit('install'); return
    case 'error': emit('retry'); return
    default: emit('close')
  }
}

const dialogRef = ref<HTMLElement | null>(null)
const primaryButton = ref<HTMLButtonElement | null>(null)

onMounted(() => {
  void nextTick(() => (primaryButton.value ?? dialogRef.value)?.focus())
})
</script>

<template>
  <div class="modal-root update-modal" role="presentation">
    <button
      type="button"
      class="modal-backdrop"
      :aria-label="locked ? '下载中，暂时无法关闭' : '关闭'"
      :disabled="locked"
      tabindex="-1"
      @click="dismiss"
    />
    <section
      ref="dialogRef"
      class="modal-card update-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-title"
      tabindex="-1"
      @keydown.esc.stop.prevent="dismiss"
    >
      <span class="update-eyebrow">{{ eyebrow }}</span>
      <h2 id="update-title">{{ title }}</h2>

      <p v-if="offer && phase.kind !== 'installing'" class="update-meta">
        <span v-if="currentVersion && phase.kind !== 'installed-notes'" class="update-versions">
          <code>{{ currentVersion }}</code>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 8h9.6M9.6 4.8 12.8 8l-3.2 3.2" /></svg>
          <code>{{ offer.version }}</code>
        </span>
        <span v-if="offer.date">{{ formatReleaseDate(offer.date) }}</span>
      </p>
      <p v-else-if="phase.kind === 'installing'" class="update-meta">正在写入更新包，完成后应用会重新打开。</p>

      <ReleaseNotes v-if="showNotes" :source="notes" />

      <div v-if="phase.kind === 'checking'" class="update-wait" aria-hidden="true"><span /></div>

      <div
        v-if="phase.kind === 'downloading'"
        class="update-progress"
        :class="{ 'is-indeterminate': !phase.total }"
        role="progressbar"
        :aria-valuenow="phase.total ? progressRatio : undefined"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="progress"
      >
        <span :style="phase.total ? { width: progressRatio + '%' } : undefined" />
      </div>
      <p v-if="phase.kind === 'downloading'" class="update-meta update-progress-text">{{ progress }}</p>

      <p v-if="phase.kind === 'error'" class="update-error" role="alert">{{ phase.message }}</p>

      <div class="modal-actions">
        <button v-if="secondaryLabel" type="button" class="ghost" :disabled="locked && secondaryAction !== 'cancel'" @click="runSecondary">
          {{ secondaryLabel }}
        </button>
        <button
          v-if="phase.kind !== 'checking' && phase.kind !== 'downloading' && phase.kind !== 'installing'"
          ref="primaryButton"
          type="button"
          class="primary"
          @click="primary"
        >
          {{ primaryLabel }}
        </button>
        <button v-else-if="phase.kind === 'installing'" class="primary" type="button" disabled>正在安装…</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.update-card {
  width: min(520px, 100%);
  display: grid;
  gap: 10px;
}

.update-card h2 {
  margin: 0;
}

.update-eyebrow {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--accent) 78%, var(--muted));
}

.update-meta {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  font-family: var(--font-ui);
  font-size: 0.79rem;
  color: var(--muted);
}

.update-versions {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--ink);
}
.update-versions svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  color: var(--muted);
}
.update-versions code {
  padding: 1px 5px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  font-family: var(--font-mono);
  font-size: 0.72rem;
}

/* 不确定进度：一条细轨上滑动的块，等待检查与下载之间保持同一位置。 */
.update-wait {
  position: relative;
  height: 3px;
  overflow: hidden;
  border-radius: 3px;
  background: color-mix(in srgb, var(--line) 80%, transparent);
}
.update-wait span {
  position: absolute;
  inset: 0 auto 0 0;
  width: 36%;
  border-radius: 3px;
  background: var(--accent);
  animation: update-wait-slide 1.1s ease-in-out infinite;
}
@keyframes update-wait-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(280%); }
}

.update-progress {
  height: 5px;
  overflow: hidden;
  border-radius: 3px;
  background: color-mix(in srgb, var(--line) 85%, transparent);
}
.update-progress span {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
  transition: width 0.2s ease;
}
.update-progress.is-indeterminate span {
  width: 36% !important;
  animation: update-wait-slide 1.1s ease-in-out infinite;
}
.update-progress-text {
  font-family: var(--font-mono);
  font-size: 0.72rem;
}

.update-error {
  margin: 0;
  padding: 9px 11px;
  border: 1px solid color-mix(in srgb, var(--danger) 34%, var(--line));
  border-radius: 8px;
  background: color-mix(in srgb, var(--danger) 7%, var(--panel));
  font-size: 0.82rem;
  color: var(--danger);
}

@media (prefers-reduced-motion: reduce) {
  .update-wait span,
  .update-progress.is-indeterminate span {
    animation: none;
  }
}
</style>
