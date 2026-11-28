<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { detectShortcutPlatform } from '../models/platform'
import {
  SHORTCUT_DEFINITIONS,
  SHORTCUT_GROUP_LABELS,
  SHORTCUT_GROUP_ORDER,
  eventToChord,
  findShortcutConflict,
  formatShortcutParts,
  getFormattedShortcutParts,
  getShortcutChord,
  isShortcutCustomized,
  replaceShortcutChord,
  resetShortcutChord,
  setRecordingShortcut,
  setShortcutChord,
  type ShortcutActionId,
  type ShortcutDefinition,
} from '../models/shortcuts'

const platform = detectShortcutPlatform()

const groups = computed(() =>
  SHORTCUT_GROUP_ORDER.map(groupId => ({
    id: groupId,
    label: SHORTCUT_GROUP_LABELS[groupId],
    items: SHORTCUT_DEFINITIONS.filter(def => def.group === groupId),
  })),
)

const recordingId = ref<ShortcutActionId | null>(null)
const errorState = ref<{ id: ShortcutActionId; message: string } | null>(null)
const conflictState = ref<{
  id: ShortcutActionId
  chord: string
  conflict: ShortcutDefinition
} | null>(null)

let captureAttached = false

function detachCapture(): void {
  if (!captureAttached) return
  window.removeEventListener('keydown', onCaptureKeydown, true)
  window.removeEventListener('pointerdown', onOutsidePointerDown, true)
  captureAttached = false
  setRecordingShortcut(false)
}

function cancelRecording(): void {
  recordingId.value = null
  errorState.value = null
  conflictState.value = null
  detachCapture()
}

function startRecording(id: ShortcutActionId): void {
  if (recordingId.value === id && !conflictState.value) {
    cancelRecording()
    return
  }
  errorState.value = null
  conflictState.value = null
  recordingId.value = id
  if (!captureAttached) {
    window.addEventListener('keydown', onCaptureKeydown, true)
    window.addEventListener('pointerdown', onOutsidePointerDown, true)
    captureAttached = true
    setRecordingShortcut(true)
  }
}

function onOutsidePointerDown(event: PointerEvent): void {
  const target = event.target as HTMLElement | null
  if (!target?.closest(`[data-shortcut-row="${recordingId.value}"]`)) {
    cancelRecording()
  }
}

function onCaptureKeydown(event: KeyboardEvent): void {
  const activeId = recordingId.value
  if (!activeId) return

  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    cancelRecording()
    return
  }

  if (conflictState.value) {
    // Wait for explicit 替换/取消 or Escape while a conflict prompt is open.
    event.preventDefault()
    event.stopPropagation()
    return
  }

  event.preventDefault()
  event.stopPropagation()

  const result = eventToChord(event, platform)
  if (result === null) return

  if ('error' in result) {
    errorState.value = { id: activeId, message: result.error }
    return
  }

  errorState.value = null
  const conflict = findShortcutConflict(result.chord, activeId)
  if (conflict) {
    conflictState.value = { id: activeId, chord: result.chord, conflict }
    return
  }

  setShortcutChord(activeId, result.chord)
  cancelRecording()
}

function confirmReplace(): void {
  if (!conflictState.value) return
  replaceShortcutChord(conflictState.value.id, conflictState.value.chord)
  cancelRecording()
}

function clearBinding(id: ShortcutActionId): void {
  if (recordingId.value === id) cancelRecording()
  setShortcutChord(id, '')
}

function restoreBinding(id: ShortcutActionId): void {
  if (recordingId.value === id) cancelRecording()
  resetShortcutChord(id)
}

function keyPartsFor(id: ShortcutActionId): string[] {
  return getFormattedShortcutParts(id, platform)
}

function conflictParts(chord: string): string[] {
  return formatShortcutParts(chord, platform)
}

onBeforeUnmount(() => {
  detachCapture()
})
</script>

<template>
  <div class="shortcuts-panel">
    <div v-for="group in groups" :key="group.id" class="shortcut-group">
      <p class="shortcut-group-label">{{ group.label }}</p>
      <ul class="shortcut-list">
        <li
          v-for="def in group.items"
          :key="def.id"
          class="shortcut-row"
          :class="{
            'is-recording': recordingId === def.id,
            'is-customized': isShortcutCustomized(def.id),
          }"
          :data-shortcut-row="def.id"
        >
          <div class="shortcut-main">
            <div class="shortcut-title">
              <strong>{{ def.label }}</strong>
            </div>
            <p
              v-if="errorState?.id === def.id"
              class="shortcut-feedback is-error"
              role="alert"
            >
              {{ errorState.message }}
            </p>
            <div
              v-else-if="conflictState?.id === def.id"
              class="shortcut-feedback is-conflict"
              role="alert"
            >
              <span class="conflict-keys">
                <kbd v-for="(part, idx) in conflictParts(conflictState.chord)" :key="idx">{{ part }}</kbd>
              </span>
              <span>与「{{ conflictState.conflict.label }}」冲突</span>
              <button
                type="button"
                class="shortcut-inline-btn is-primary"
                @click="confirmReplace"
              >
                替换
              </button>
              <button
                type="button"
                class="shortcut-inline-btn"
                @click="cancelRecording"
              >
                取消
              </button>
            </div>
          </div>

          <div class="shortcut-controls">
            <button
              v-if="getShortcutChord(def.id)"
              type="button"
              class="shortcut-icon-btn"
              aria-label="清除快捷键"
              title="清除"
              @click="clearBinding(def.id)"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2" />
              </svg>
            </button>
            <button
              v-if="isShortcutCustomized(def.id)"
              type="button"
              class="shortcut-icon-btn"
              aria-label="恢复默认快捷键"
              title="恢复默认"
              @click="restoreBinding(def.id)"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.4 8a4.6 4.6 0 1 0 1.4-3.3L3.2 6.2" />
                <path d="M3.2 3.2v3h3" />
              </svg>
            </button>

            <button
              type="button"
              class="kbd-record-btn"
              :class="{
                'is-recording': recordingId === def.id,
                'is-empty': !getShortcutChord(def.id),
              }"
              :aria-pressed="recordingId === def.id"
              :aria-label="
                recordingId === def.id
                  ? `正在录制 ${def.label} 快捷键，按 Esc 取消`
                  : `修改 ${def.label} 快捷键`
              "
              @click="startRecording(def.id)"
            >
              <span v-if="recordingId === def.id" class="kbd-recording-copy">按下快捷键…</span>
              <span v-else-if="keyPartsFor(def.id).length" class="kbd-caps">
                <kbd v-for="(part, idx) in keyPartsFor(def.id)" :key="idx">{{ part }}</kbd>
              </span>
              <span v-else class="kbd-empty-copy">未设置</span>
            </button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.shortcuts-panel {
  display: grid;
  gap: 18px;
}

.shortcut-group-label {
  margin: 0 0 6px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--muted) 90%, transparent);
}

.shortcut-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0;
}

.shortcut-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  min-height: 40px;
  padding: 6px 10px;
  margin: 0 -10px;
  border-radius: 8px;
  transition: background 0.14s ease;
}

.shortcut-row + .shortcut-row::before {
  content: '';
  position: absolute;
  left: 10px;
  right: 10px;
  top: 0;
  height: 1px;
  background: color-mix(in srgb, var(--line) 62%, transparent);
}

.shortcut-row:hover {
  background: color-mix(in srgb, var(--accent) 5%, transparent);
}

.shortcut-row.is-recording {
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

.shortcut-main {
  min-width: 0;
  flex: 1;
}

.shortcut-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.shortcut-title strong {
  font-size: 12px;
  font-weight: 500;
  color: var(--ink);
}

.shortcut-feedback {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 4px 0 0;
  font-size: 10.5px;
  line-height: 1.4;
}

.shortcut-feedback.is-error {
  color: var(--danger);
}

.shortcut-feedback.is-conflict {
  color: var(--ink);
}

.conflict-keys {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.conflict-keys kbd,
.kbd-caps kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
  border-radius: 4px;
  background: var(--panel);
  box-shadow: 0 1px 0 color-mix(in srgb, var(--line) 75%, transparent);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  color: var(--ink);
}

.shortcuts-panel button.shortcut-inline-btn {
  height: 21px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
  border-radius: 5px;
  background: var(--panel);
  color: var(--ink);
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  transition: border-color 0.14s ease, background 0.14s ease, color 0.14s ease;
}

.shortcuts-panel button.shortcut-inline-btn:hover {
  border-color: color-mix(in srgb, var(--muted) 60%, var(--line));
}

.shortcuts-panel button.shortcut-inline-btn.is-primary {
  border-color: color-mix(in srgb, var(--accent) 70%, var(--line));
  background: var(--accent);
  color: #fffefa;
}

:root[data-color-mode='dark'] .shortcuts-panel button.shortcut-inline-btn.is-primary {
  color: #10231b;
}

.shortcuts-panel button.shortcut-inline-btn.is-primary:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.shortcut-controls {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
}

.shortcuts-panel button.shortcut-icon-btn {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--muted);
  opacity: 0;
  transition: opacity 0.14s ease, background 0.14s ease, color 0.14s ease;
}

.shortcut-row:hover .shortcut-icon-btn,
.shortcut-row:focus-within .shortcut-icon-btn,
.shortcut-icon-btn:focus-visible {
  opacity: 1;
}

.shortcuts-panel button.shortcut-icon-btn:hover {
  background: color-mix(in srgb, var(--surface) 75%, var(--panel));
  color: var(--ink);
}

.shortcut-icon-btn svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.shortcuts-panel button.kbd-record-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 80px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--line) 90%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--surface) 45%, var(--panel));
  color: var(--ink);
  transition: border-color 0.14s ease, background 0.14s ease, box-shadow 0.14s ease;
}

.shortcuts-panel button.kbd-record-btn:hover {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
  background: var(--panel);
}

.shortcuts-panel button.kbd-record-btn.is-recording {
  border-color: var(--accent);
  background: var(--panel);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent);
}

.kbd-caps {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.kbd-recording-copy {
  font-size: 10.5px;
  font-weight: 500;
  color: var(--accent);
  white-space: nowrap;
}

.kbd-empty-copy {
  font-size: 10.5px;
  color: var(--muted);
  white-space: nowrap;
}
</style>
