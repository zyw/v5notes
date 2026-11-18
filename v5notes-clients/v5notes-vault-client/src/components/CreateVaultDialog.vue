<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  busy?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  cancel: []
  submit: [name: string]
}>()

const name = ref('MyVault')
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.open,
  async open => {
    if (open) {
      name.value = 'MyVault'
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
  emit('submit', name.value)
}
</script>

<template>
  <div
    v-if="open"
    class="modal-root"
    role="dialog"
    aria-modal="true"
    aria-labelledby="create-vault-title"
  >
    <button type="button" class="modal-backdrop" aria-label="关闭" :disabled="busy" @click="emit('cancel')" />
    <div class="modal-card">
      <h2 id="create-vault-title">创建新库</h2>
      <p class="modal-lede">选择父目录后，将在其中创建以库名命名的文件夹，并写入 <code>.v5notes</code> 骨架。</p>
      <label class="field">
        <span>库名称</span>
        <input
          ref="inputRef"
          v-model="name"
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
          {{ busy ? '创建中…' : '选择父目录并创建' }}
        </button>
      </div>
    </div>
  </div>
</template>
