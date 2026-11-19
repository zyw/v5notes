<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

export interface MoveTargetOption {
  /** Directory path relative to the vault root; '' is the root. */
  path: string
  label: string
  depth: number
  /** The entry already lives here; listed for orientation, not selectable. */
  current?: boolean
  /** The entry itself or one of its descendants; not selectable. */
  blocked?: boolean
}

const props = defineProps<{
  open: boolean
  title: string
  /** The entry being moved, named so the choice stays anchored to its object. */
  subject: string
  targets: MoveTargetOption[]
  initialPath: string
  busy?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  cancel: []
  submit: [path: string]
}>()

const selected = ref('')
const selectRef = ref<HTMLSelectElement | null>(null)

function isSelectable(target: MoveTargetOption | undefined): boolean {
  return !!target && !target.current && !target.blocked
}

const canSubmit = computed(() => isSelectable(props.targets.find(target => target.path === selected.value)))

function submit() {
  if (props.busy || !canSubmit.value) return
  emit('submit', selected.value)
}

function indent(target: MoveTargetOption): string {
  return '\u3000'.repeat(target.depth)
}

function onKeydown(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'Escape' && !props.busy) {
    event.preventDefault()
    emit('cancel')
  }
}

watch(
  () => props.open,
  async open => {
    if (!open) return
    selected.value = props.initialPath
    selectRef.value?.focus()
  },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div
    v-if="open"
    class="modal-root"
    role="dialog"
    aria-modal="true"
    aria-labelledby="move-dialog-title"
  >
    <button type="button" class="modal-backdrop" aria-label="关闭" :disabled="busy" @click="emit('cancel')" />
    <div class="modal-card">
      <h2 id="move-dialog-title">{{ title }}</h2>
      <p class="modal-lede">{{ subject }}</p>
      <label class="field">
        <span>目标目录</span>
        <select ref="selectRef" v-model="selected" :disabled="busy">
          <option
            v-for="target in targets"
            :key="target.path || '__root__'"
            :value="target.path"
            :disabled="!isSelectable(target)"
          >
            {{ indent(target) }}{{ target.label }}{{ target.current ? '（当前位置）' : '' }}
          </option>
        </select>
      </label>
      <p v-if="error" class="field-error" role="alert">{{ error }}</p>
      <div class="modal-actions">
        <button type="button" class="ghost action-btn" :disabled="busy" @click="emit('cancel')">
          <svg class="action-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="m4.2 4.2 7.6 7.6M11.8 8.7v3.1H8.7" />
          </svg>
          取消
        </button>
        <button
          type="button"
          class="primary action-btn"
          :disabled="busy || !canSubmit"
          @click="submit"
        >
          <svg class="action-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M1.5 8h7M6 5.5 8.5 8 6 10.5M10.5 3v10M13 6.2v3.6" />
          </svg>
          移动
        </button>
      </div>
    </div>
  </div>
</template>
