<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  title: string
  label: string
  initialValue?: string
  submitLabel?: string
  busy?: boolean
  error?: string | null
  lede?: string
}>()

const emit = defineEmits<{
  cancel: []
  submit: [value: string]
}>()

const value = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.open,
  async open => {
    if (open) {
      value.value = props.initialValue ?? ''
      await nextTick()
      inputRef.value?.focus()
      inputRef.value?.select()
    }
  },
)

function onKeydown(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'Escape' && !props.busy) {
    event.preventDefault()
    emit('cancel')
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

function submit() {
  if (props.busy) return
  emit('submit', value.value)
}
</script>

<template>
  <div
    v-if="open"
    class="modal-root"
    role="dialog"
    aria-modal="true"
    aria-labelledby="name-dialog-title"
  >
    <button type="button" class="modal-backdrop" aria-label="关闭" :disabled="busy" @click="emit('cancel')" />
    <div class="modal-card">
      <h2 id="name-dialog-title">{{ title }}</h2>
      <p v-if="lede" class="modal-lede">{{ lede }}</p>
      <label class="field">
        <span>{{ label }}</span>
        <input
          ref="inputRef"
          v-model="value"
          maxlength="100"
          autocomplete="off"
          :disabled="busy"
          @keydown.enter.prevent="submit"
        />
      </label>
      <p v-if="error" class="field-error" role="alert">{{ error }}</p>
      <div class="modal-actions">
        <button type="button" class="ghost" :disabled="busy" @click="emit('cancel')">取消</button>
        <button type="button" class="primary" :disabled="busy" @click="submit">
          {{ submitLabel || '确定' }}
        </button>
      </div>
    </div>
  </div>
</template>
