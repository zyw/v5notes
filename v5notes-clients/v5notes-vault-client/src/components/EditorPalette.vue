<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  EDITOR_THEME_LABELS,
  filterCommands,
  groupCommands,
  paletteModeLabel,
  visibleCommands,
  GROUP_LABELS,
  type CommandContext,
  type EditorCommand,
} from '../models/editorCommands'
import {
  EDITOR_THEME_IDS,
  isDarkEditorTheme,
  type EditorThemePreference,
} from '../editor/useEditorTheme'

/**
 * Command palette, ported from v5notes-client2's EditorPalette.
 *
 * A single search field over the commands the current state allows, grouped in
 * the same order, with the editor theme reachable from the same panel. Vault
 * copy is plain Chinese: there is no i18n layer in this client.
 */
const props = defineProps<{
  open: boolean
  commands: EditorCommand[]
  context: CommandContext
  editorTheme: EditorThemePreference
  resolvedTheme: string
}>()

const emit = defineEmits<{
  close: []
  run: [command: EditorCommand]
  theme: [value: EditorThemePreference]
}>()

const query = ref('')
const activeId = ref('')
const input = ref<HTMLInputElement | null>(null)
const list = ref<HTMLElement | null>(null)

const ICONS: Record<string, string> = {
  'mode.edit': '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5a2.12 2.12 0 0 1 3 0Z"/>',
  'mode.preview': '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.6"/>',
  'file.save': '<path d="M5 3.5h10.5L20 8v12.5H5z"/><path d="M8.5 3.5v5h7v-5M8.5 20.5v-6h7v6"/>',
  'view.sidebar': '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M9.5 4.5v15"/>',
  'view.outline': '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M14.5 4.5v15"/><path d="M6 8.5h5.5M6 12h5.5M6 15.5h4"/>',
  'view.find': '<circle cx="10.8" cy="10.8" r="6.6"/><path d="m15.6 15.6 4 4"/>',
  'view.trash': '<path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13M10 10.5v6M14 10.5v6"/>',
  'attach.open': '<rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2"/><circle cx="9" cy="10" r="1.7"/><path d="m4.4 17.2 4.6-4.6 3.1 3.1L15.6 12l4 4.4"/>',
  'font.increase': '<path d="M3.5 19 9.4 5h1.6L17 19M6.1 13.6h8.2"/><path d="M18 9.5v6M15 12.5h6"/>',
  'font.decrease': '<path d="M3.5 19 9.4 5h1.6L17 19M6.1 13.6h8.2"/><path d="M15 12.5h6"/>',
  'export.html': '<circle cx="12" cy="12" r="8.4"/><path d="M3.6 12h16.8M12 3.6c2.4 2.3 3.6 5.2 3.6 8.4s-1.2 6.1-3.6 8.4c-2.4-2.3-3.6-5.2-3.6-8.4S9.6 5.9 12 3.6Z"/>',
  'export.pdf': '<path d="M6.5 3.2h7.6l4 4V20.8h-11.6z"/><path d="M14 3.4v4.2h4.1"/><path d="M9.2 12.6h6M9.2 16.2h6"/>',
  'export.markdown': '<rect x="3.2" y="5.2" width="17.6" height="13.6" rx="2"/><path d="M6.6 15.6V9.2l2.4 3 2.4-3v6.4M15 9.2v4.6M15 9.2l-2 2.8M18.4 13.8l-2.2-2.4M18.4 11.4v4.2"/>',
  'export.image': '<rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2"/><circle cx="9" cy="10" r="1.7"/><path d="m4.4 17.2 4.6-4.6 3.1 3.1L15.6 12l4 4.4"/>',
  'note.copy': '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  'app.settings': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
  'plugin.default': '<path d="M9 3.5v3M15 3.5v3M7 3.5h10v5a5 5 0 0 1-10 0zM12 13.5V20"/>',
}

const filtered = computed(() => filterCommands(visibleCommands(props.commands, props.context), query.value))
const groups = computed(() => groupCommands(filtered.value))
const flat = computed(() => groups.value.flatMap(group => group.items))
const modeLabel = computed(() => paletteModeLabel(props.context))
const lightThemes = computed(() => EDITOR_THEME_IDS.filter(id => !isDarkEditorTheme(id)))
const darkThemes = computed(() => EDITOR_THEME_IDS.filter(id => isDarkEditorTheme(id)))
const autoThemeLabel = computed(() => `跟随应用 · ${EDITOR_THEME_LABELS[props.resolvedTheme] ?? props.resolvedTheme}`)
const groupLabel = (name: string) => GROUP_LABELS[name] ?? name

function onThemeChange(event: Event): void {
  emit('theme', (event.target as HTMLSelectElement).value)
}

function iconFor(command: EditorCommand): string {
  return ICONS[command.id] ?? ICONS['plugin.default']
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
  void nextTick(() => {
    list.value?.querySelector<HTMLElement>('.palette-item.is-active')?.scrollIntoView({ block: 'nearest' })
  })
}

function run(command: EditorCommand): void {
  emit('run', command)
  if (command.keepOpen) {
    // Repeatable commands (font size) leave the panel open; keep the caret in the
    // search field so Enter and the arrow keys keep working.
    input.value?.focus()
    return
  }
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
          <input ref="input" v-model="query" type="text" placeholder="搜索命令或导出方式…" aria-label="搜索命令" autocomplete="off" spellcheck="false" @keydown="onKeydown">
          <kbd>ESC</kbd>
        </div>
        <div class="palette-state">
          <span>当前 · <strong>{{ modeLabel }}</strong></span>
          <span>{{ flat.length }} 项可用</span>
        </div>
        <div class="palette-theme">
          <label class="palette-theme-label" for="vault-palette-theme">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.4"/><path d="M12 3.6a8.4 8.4 0 0 0 0 16.8 4.2 4.2 0 0 1 0-8.4 4.2 4.2 0 0 0 0-8.4Z"/></svg>
            <span>编辑器主题</span>
          </label>
          <select id="vault-palette-theme" class="palette-theme-select" :value="editorTheme" aria-label="编辑器主题" @change="onThemeChange" @keydown.stop>
            <option value="auto">{{ autoThemeLabel }}</option>
            <optgroup label="浅色主题">
              <option v-for="id in lightThemes" :key="id" :value="id">{{ EDITOR_THEME_LABELS[id] }}</option>
            </optgroup>
            <optgroup label="深色主题">
              <option v-for="id in darkThemes" :key="id" :value="id">{{ EDITOR_THEME_LABELS[id] }}</option>
            </optgroup>
          </select>
        </div>
        <div ref="list" class="palette-list">
          <template v-for="group in groups" :key="group.name">
            <div class="palette-group">{{ groupLabel(group.name) }}</div>
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
              <span class="pi-copy"><strong>{{ command.label }}</strong><span v-if="command.hint">{{ command.hint }}</span></span>
              <span v-if="command.badge?.(context)" class="pi-badge" :class="`is-${command.badgeTone ?? 'meta'}`">{{ command.badge(context) }}</span>
              <span v-else-if="command.shortcut" class="pi-kbd">{{ command.shortcut }}</span>
            </button>
          </template>
          <p v-if="!flat.length" class="palette-empty">没有匹配的命令</p>
        </div>
        <div class="palette-foot">
          <span>↑↓ 选择 · ↵ 执行 · esc 关闭</span>
        </div>
      </section>
    </div>
  </Teleport>
</template>
