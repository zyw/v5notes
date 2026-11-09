<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  filterCommands,
  groupCommands,
  paletteModeLabel,
  visibleCommands,
  type CommandContext,
  type EditorCommand,
} from '../models/editorCommands'

const props = defineProps<{
  open: boolean
  commands: EditorCommand[]
  context: CommandContext
}>()

const emit = defineEmits<{
  close: []
  run: [command: EditorCommand]
}>()

const query = ref('')
const activeId = ref('')
const input = ref<HTMLInputElement | null>(null)

const ICONS: Record<string, string> = {
  'mode.edit': '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5a2.12 2.12 0 0 1 3 0Z"/>',
  'mode.source': '<path d="m9 8-4 4 4 4M15 8l4 4-4 4"/>',
  'mode.preview': '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.6"/>',
  'view.focus': '<path d="M8 3.5H3.5V8M16 3.5h4.5V8M20.5 16v4.5H16M8 20.5H3.5V16"/>',
  'view.toolbar': '<rect x="3.2" y="6.4" width="17.6" height="11.2" rx="2.2"/><path d="M7 10.2v3.6M10.2 10.2v3.6M13.4 10.2v3.6M16.6 10.2v3.6"/>',
  'view.history': '<circle cx="12" cy="12" r="7.6"/><path d="M12 7.8v4.5l2.9 1.8"/>',
  'font.increase': '<path d="M3.5 19 9.4 5h1.6L17 19M6.1 13.6h8.2"/><path d="M18 9.5v6M15 12.5h6"/>',
  'font.decrease': '<path d="M3.5 19 9.4 5h1.6L17 19M6.1 13.6h8.2"/><path d="M15 12.5h6"/>',
  'export.html': '<circle cx="12" cy="12" r="8.4"/><path d="M3.6 12h16.8M12 3.6c2.4 2.3 3.6 5.2 3.6 8.4s-1.2 6.1-3.6 8.4c-2.4-2.3-3.6-5.2-3.6-8.4S9.6 5.9 12 3.6Z"/>',
  'export.pdf': '<path d="M6.5 3.2h7.6l4 4V20.8h-11.6z"/><path d="M14 3.4v4.2h4.1"/><path d="M9.2 12.6h6M9.2 16.2h6"/>',
  'export.markdown': '<rect x="3.2" y="5.2" width="17.6" height="13.6" rx="2"/><path d="M6.6 15.6V9.2l2.4 3 2.4-3v6.4M15 9.2v4.6M15 9.2l-2 2.8M18.4 13.8l-2.2-2.4M18.4 11.4v4.2"/>',
  'export.image': '<rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2"/><circle cx="9" cy="10" r="1.7"/><path d="m4.4 17.2 4.6-4.6 3.1 3.1L15.6 12l4 4.4"/>',
}

const filtered = computed(() => filterCommands(visibleCommands(props.commands, props.context), query.value))
const groups = computed(() => groupCommands(filtered.value))
const flat = computed(() => groups.value.flatMap(group => group.items))
const modeLabel = computed(() => paletteModeLabel(props.context))

function iconFor(command: EditorCommand): string {
  return ICONS[command.id] ?? '<circle cx="12" cy="12" r="7.5"/>'
}

watch(() => props.open, async open => {
  if (!open) return
  query.value = ''
  activeId.value = ''
  await nextTick()
  input.value?.focus()
  if (!activeId.value && flat.value.length) activeId.value = flat.value[0].id
})

function onWindowKeydown(event: KeyboardEvent): void {
  if (!props.open) return
  if (event.key === 'Escape') {
    event.stopPropagation()
    emit('close')
  }
}

onMounted(() => window.addEventListener('keydown', onWindowKeydown, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onWindowKeydown, true))

watch(filtered, commands => {
  if (!commands.some(command => command.id === activeId.value)) activeId.value = commands[0]?.id ?? ''
})

function move(step: number): void {
  if (!flat.value.length) return
  const index = flat.value.findIndex(command => command.id === activeId.value)
  const next = (index + step + flat.value.length) % flat.value.length
  activeId.value = flat.value[next].id
}

function run(command: EditorCommand): void {
  emit('run', command)
  emit('close')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    move(1)
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    move(-1)
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    const command = flat.value.find(item => item.id === activeId.value)
    if (command) run(command)
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="palette-backdrop" @pointerdown.self="emit('close')">
      <section class="palette" role="dialog" aria-modal="true" aria-label="命令面板">
        <div class="palette-input">
          <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6"/><path d="m15.6 15.6 4 4"/></svg>
          <input ref="input" v-model="query" type="text" placeholder="搜索命令或导出方式…" aria-label="搜索命令" autocomplete="off" @keydown="onKeydown">
          <kbd>ESC</kbd>
        </div>
        <div class="palette-state">
          <span>当前 · <strong>{{ modeLabel }}</strong></span>
          <span>{{ flat.length }} 项可用</span>
        </div>
        <div class="palette-list">
          <template v-for="group in groups" :key="group.name">
            <div class="palette-group">{{ group.name }}</div>
            <button
              v-for="command in group.items"
              :key="command.id"
              type="button"
              class="palette-item"
              :class="{ 'is-active': command.id === activeId }"
              @pointermove="activeId = command.id"
              @click="run(command)"
            >
              <svg class="ic" viewBox="0 0 24 24" aria-hidden="true" v-html="iconFor(command)" />
              <span class="pi-copy"><strong>{{ command.label }}</strong><span>{{ command.hint }}</span></span>
              <span v-if="command.badge?.(context)" class="pi-badge" :class="`is-${command.badgeTone ?? 'meta'}`">{{ command.badge(context) }}</span>
              <span v-else-if="command.shortcut" class="pi-kbd">{{ command.shortcut }}</span>
            </button>
          </template>
          <p v-if="!flat.length" class="palette-empty">没有匹配的命令</p>
        </div>
        <div class="palette-foot">
          <span>↑↓ 选择 · ↵ 执行 · esc 关闭</span>
          <span>只列出当前模式可用的命令</span>
        </div>
      </section>
    </div>
  </Teleport>
</template>
