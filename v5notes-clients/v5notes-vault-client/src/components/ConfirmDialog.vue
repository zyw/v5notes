<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
}>()

const emit = defineEmits<{
  cancel: []
  confirm: []
}>()

function onKeydown(event: KeyboardEvent) {
  if (!props.open || props.busy) return
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('cancel')
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div
    v-if="open"
    class="modal-root"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="'confirm-title'"
  >
    <button type="button" class="modal-backdrop" aria-label="关闭" :disabled="busy" @click="emit('cancel')" />
    <div class="modal-card">
      <h2 id="confirm-title">{{ title }}</h2>
      <p class="modal-lede">{{ message }}</p>
      <div class="modal-actions">
        <button type="button" class="ghost" :disabled="busy" @click="emit('cancel')">
          {{ cancelLabel || '取消' }}
        </button>
        <button
          type="button"
          :class="danger ? 'danger' : 'primary'"
          :disabled="busy"
          @click="emit('confirm')"
        >
          {{ confirmLabel || '确认' }}
        </button>
      </div>
    </div>
  </div>
</template>
