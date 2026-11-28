import { ref } from 'vue'
import { detectShortcutPlatform, type ShortcutPlatform } from './platform'

export type { ShortcutPlatform }

export type ShortcutGroupId = 'app' | 'file' | 'mode' | 'view'

export type ShortcutActionId =
  | 'palette.open'
  | 'app.settings'
  | 'app.sync'
  | 'file.save'
  | 'file.new'
  | 'file.newChooser'
  | 'mode.edit'
  | 'mode.source'
  | 'mode.preview'
  | 'view.find'
  | 'view.sidebar'
  | 'view.outline'
  | 'font.increase'
  | 'font.decrease'

export interface ShortcutDefinition {
  id: ShortcutActionId
  group: ShortcutGroupId
  label: string
  defaultChord: string
}

export interface ParsedChord {
  mod: boolean
  ctrl: boolean
  alt: boolean
  shift: boolean
  key: string
}

export interface ShortcutPrefs {
  schemaVersion: 1
  bindings: Partial<Record<ShortcutActionId, string>>
}

export const SHORTCUTS_STORAGE_KEY = 'v5notes.vault.shortcuts.v1'

export const SHORTCUT_GROUP_ORDER: readonly ShortcutGroupId[] = ['app', 'file', 'mode', 'view']

export const SHORTCUT_GROUP_LABELS: Record<ShortcutGroupId, string> = {
  app: '全局',
  file: '文件',
  mode: '模式',
  view: '视图与排版',
}

export const SHORTCUT_DEFINITIONS: readonly ShortcutDefinition[] = [
  { id: 'palette.open', group: 'app', label: '命令面板', defaultChord: 'Mod+K' },
  { id: 'app.settings', group: 'app', label: '打开设置', defaultChord: 'Mod+,' },
  { id: 'app.sync', group: 'app', label: '立即同步', defaultChord: 'Mod+Shift+S' },
  { id: 'file.save', group: 'file', label: '保存笔记', defaultChord: 'Mod+S' },
  { id: 'file.new', group: 'file', label: '新建笔记', defaultChord: 'Mod+N' },
  { id: 'file.newChooser', group: 'file', label: '选择类型新建', defaultChord: 'Mod+Shift+N' },
  { id: 'mode.edit', group: 'mode', label: '进入编辑', defaultChord: 'Mod+E' },
  { id: 'mode.source', group: 'mode', label: '源码模式', defaultChord: 'Mod+2' },
  { id: 'mode.preview', group: 'mode', label: '预览模式', defaultChord: 'Mod+R' },
  { id: 'view.find', group: 'view', label: '文内查找', defaultChord: 'Mod+F' },
  { id: 'view.sidebar', group: 'view', label: '切换侧栏', defaultChord: 'Mod+\\' },
  { id: 'view.outline', group: 'view', label: '切换大纲', defaultChord: 'Mod+Shift+O' },
  { id: 'font.increase', group: 'view', label: '增大字号', defaultChord: 'Mod+=' },
  { id: 'font.decrease', group: 'view', label: '减小字号', defaultChord: 'Mod+-' },
]

const DEFINITION_MAP = new Map<ShortcutActionId, ShortcutDefinition>(
  SHORTCUT_DEFINITIONS.map(def => [def.id, def]),
)

const MODIFIER_ONLY_KEYS = new Set([
  'Meta',
  'Control',
  'Alt',
  'Shift',
  'CapsLock',
  'OS',
  'Process',
  'Unidentified',
])

const CODE_KEY_MAP: Record<string, string> = {
  Equal: '=',
  NumpadAdd: '=',
  Minus: '-',
  NumpadSubtract: '-',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Space: 'Space',
  Enter: 'Enter',
  NumpadEnter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
}

const VALID_FALLBACK_KEYS = new Set([
  '=',
  '-',
  ',',
  '.',
  '/',
  '\\',
  '[',
  ']',
  ';',
  "'",
  '`',
  'Space',
  'Enter',
  'Tab',
  'Backspace',
  'Delete',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
])

const RESERVED_EDIT_CHORDS = new Set([
  'Mod+C',
  'Mod+V',
  'Mod+X',
  'Mod+A',
  'Mod+Z',
  'Mod+Shift+Z',
  'Mod+Y',
])

const FUNCTION_KEY_RE = /^F([1-9]|1[0-2])$/

function isValidActionId(id: string): id is ShortcutActionId {
  return DEFINITION_MAP.has(id as ShortcutActionId)
}

function normalizeKeyToken(raw: string): string | null {
  if (!raw) return null
  if (/^[a-zA-Z]$/.test(raw)) return raw.toUpperCase()
  if (/^[0-9]$/.test(raw)) return raw
  if (FUNCTION_KEY_RE.test(raw.toUpperCase())) return raw.toUpperCase()
  if (raw === '+') return '='
  if (raw === '−') return '-'
  if (raw === ' ') return 'Space'
  if (VALID_FALLBACK_KEYS.has(raw)) return raw
  return null
}

/**
 * Normalize a KeyboardEvent's main key, preferring physical `event.code` so
 * macOS Option-modified characters (e.g. `⌥S` -> `ß`) remain stable.
 */
export function normalizeEventKey(event: Pick<KeyboardEvent, 'key' | 'code'>): string | null {
  if (MODIFIER_ONLY_KEYS.has(event.key)) return null

  const code = event.code || ''
  if (code) {
    if (/^Key[A-Z]$/.test(code)) return code.slice(3)
    if (/^Digit[0-9]$/.test(code)) return code.slice(5)
    if (FUNCTION_KEY_RE.test(code)) return code
    if (code in CODE_KEY_MAP) return CODE_KEY_MAP[code]
  }

  return normalizeKeyToken(event.key)
}

export function serializeChord(parsed: ParsedChord): string {
  const parts: string[] = []
  if (parsed.mod) parts.push('Mod')
  if (parsed.ctrl) parts.push('Ctrl')
  if (parsed.alt) parts.push('Alt')
  if (parsed.shift) parts.push('Shift')
  parts.push(parsed.key)
  return parts.join('+')
}

export function parseChord(chord: string): ParsedChord | null {
  const trimmed = chord.trim()
  if (!trimmed) return null
  const tokens = trimmed.split('+')
  const rawKey = tokens.pop()
  if (!rawKey) return null
  const key = normalizeKeyToken(rawKey)
  if (!key) return null

  let mod = false
  let ctrl = false
  let alt = false
  let shift = false

  for (const token of tokens) {
    switch (token) {
      case 'Mod':
        mod = true
        break
      case 'Ctrl':
        ctrl = true
        break
      case 'Alt':
        alt = true
        break
      case 'Shift':
        shift = true
        break
      default:
        return null
    }
  }

  if (!mod && !ctrl && !alt && !FUNCTION_KEY_RE.test(key)) {
    return null
  }

  return { mod, ctrl, alt, shift, key }
}

/**
 * Convert a KeyboardEvent captured during shortcut recording into a canonical
 * chord, or return a validation error, or `null` when only modifier keys are pressed.
 */
export function eventToChord(
  event: Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>,
  platform: ShortcutPlatform = detectShortcutPlatform(),
): { chord: string } | { error: string } | null {
  const key = normalizeEventKey(event)
  if (!key) return null

  if (platform === 'win' && event.metaKey) {
    return { error: '不支持 Windows 键组合' }
  }

  const mod = platform === 'mac' ? event.metaKey : event.ctrlKey
  const ctrl = platform === 'mac' ? event.ctrlKey : false
  const alt = event.altKey
  const shift = event.shiftKey

  if (!mod && !ctrl && !alt && !FUNCTION_KEY_RE.test(key)) {
    return {
      error: platform === 'mac'
        ? '请配合修饰键（如 ⌘ / ⌃ / ⌥）或功能键'
        : '请配合修饰键（如 Ctrl / Alt）或功能键',
    }
  }

  const chord = serializeChord({ mod, ctrl, alt, shift, key })
  if (RESERVED_EDIT_CHORDS.has(chord)) {
    return { error: '系统编辑快捷键不可占用' }
  }

  return { chord }
}

/**
 * Match a KeyboardEvent against a canonical chord using strict platform rules:
 * macOS `Mod` requires `metaKey` (⌘), Windows `Mod` requires `ctrlKey` without `metaKey`.
 */
export function matchesShortcut(
  event: Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'isComposing'>,
  chord: string,
  platform: ShortcutPlatform = detectShortcutPlatform(),
): boolean {
  if (!chord || event.isComposing) return false
  const parsed = parseChord(chord)
  if (!parsed) return false

  const key = normalizeEventKey(event)
  if (!key || key !== parsed.key) return false

  if (platform === 'mac') {
    if (event.metaKey !== parsed.mod) return false
    if (event.ctrlKey !== parsed.ctrl) return false
    if (event.altKey !== parsed.alt) return false
  } else {
    const needCtrl = parsed.mod || parsed.ctrl
    if (event.ctrlKey !== needCtrl) return false
    if (event.metaKey) return false
    if (event.altKey !== parsed.alt) return false
  }

  if (parsed.key === '=' && !parsed.shift && event.key === '+') {
    return true
  }

  return event.shiftKey === parsed.shift
}

const MAC_KEY_LABELS: Record<string, string> = {
  '=': '+',
  '-': '−',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Backspace: '⌫',
  Delete: '⌦',
  Enter: '↵',
  Tab: '⇥',
}

const WIN_KEY_LABELS: Record<string, string> = {
  '=': '+',
  '-': '-',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
}

/** Format a canonical chord into individual keycap labels for the active platform. */
export function formatShortcutParts(
  chord: string,
  platform: ShortcutPlatform = detectShortcutPlatform(),
): string[] {
  const parsed = parseChord(chord)
  if (!parsed) return []

  const parts: string[] = []
  if (platform === 'mac') {
    if (parsed.mod) parts.push('⌘')
    if (parsed.ctrl) parts.push('⌃')
    if (parsed.alt) parts.push('⌥')
    if (parsed.shift) parts.push('⇧')
    parts.push(MAC_KEY_LABELS[parsed.key] ?? parsed.key)
  } else {
    if (parsed.mod || parsed.ctrl) parts.push('Ctrl')
    if (parsed.alt) parts.push('Alt')
    if (parsed.shift) parts.push('Shift')
    parts.push(WIN_KEY_LABELS[parsed.key] ?? parsed.key)
  }

  return parts
}

/** Format a canonical chord into a compact single-string hint for buttons and palettes. */
export function formatShortcut(
  chord: string,
  platform: ShortcutPlatform = detectShortcutPlatform(),
): string {
  const parts = formatShortcutParts(chord, platform)
  if (!parts.length) return ''
  return platform === 'mac' ? parts.join('') : parts.join('+')
}

export function loadShortcutOverrides(): Partial<Record<ShortcutActionId, string>> {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(SHORTCUTS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<ShortcutPrefs> | null
    if (!parsed || typeof parsed !== 'object' || !parsed.bindings || typeof parsed.bindings !== 'object') {
      return {}
    }
    const clean: Partial<Record<ShortcutActionId, string>> = {}
    for (const [id, value] of Object.entries(parsed.bindings)) {
      if (!isValidActionId(id) || typeof value !== 'string') continue
      if (value === '') {
        clean[id] = ''
        continue
      }
      const parsedChord = parseChord(value)
      if (parsedChord) {
        const canonical = serializeChord(parsedChord)
        if (!RESERVED_EDIT_CHORDS.has(canonical)) {
          clean[id] = canonical
        }
      }
    }
    return clean
  } catch {
    return {}
  }
}

export function saveShortcutOverrides(bindings: Partial<Record<ShortcutActionId, string>>): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (Object.keys(bindings).length === 0) {
      localStorage.removeItem(SHORTCUTS_STORAGE_KEY)
      return
    }
    const payload: ShortcutPrefs = { schemaVersion: 1, bindings }
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore storage failures */
  }
}

const shortcutOverrides = ref<Partial<Record<ShortcutActionId, string>>>(loadShortcutOverrides())
const recordingShortcut = ref(false)

export function reloadShortcutsFromStorage(): void {
  shortcutOverrides.value = loadShortcutOverrides()
}

export function isRecordingShortcut(): boolean {
  return recordingShortcut.value
}

export function setRecordingShortcut(active: boolean): void {
  recordingShortcut.value = active
}

export function getShortcutChord(id: ShortcutActionId): string {
  const override = shortcutOverrides.value[id]
  if (override !== undefined) return override
  return DEFINITION_MAP.get(id)?.defaultChord ?? ''
}

export function getFormattedShortcut(
  id: ShortcutActionId,
  platform: ShortcutPlatform = detectShortcutPlatform(),
): string {
  return formatShortcut(getShortcutChord(id), platform)
}

export function getFormattedShortcutParts(
  id: ShortcutActionId,
  platform: ShortcutPlatform = detectShortcutPlatform(),
): string[] {
  return formatShortcutParts(getShortcutChord(id), platform)
}

export function findShortcutConflict(
  chord: string,
  excludeId: ShortcutActionId,
): ShortcutDefinition | null {
  const parsed = parseChord(chord)
  if (!parsed) return null
  const target = serializeChord(parsed)
  for (const def of SHORTCUT_DEFINITIONS) {
    if (def.id === excludeId) continue
    if (getShortcutChord(def.id) === target) return def
  }
  return null
}

function updateBindings(next: Partial<Record<ShortcutActionId, string>>): void {
  shortcutOverrides.value = next
  saveShortcutOverrides(next)
}

export function setShortcutChord(id: ShortcutActionId, chord: string): void {
  const def = DEFINITION_MAP.get(id)
  if (!def) return
  const next = { ...shortcutOverrides.value }
  if (chord === '') {
    next[id] = ''
  } else {
    const parsed = parseChord(chord)
    if (!parsed) return
    const canonical = serializeChord(parsed)
    if (RESERVED_EDIT_CHORDS.has(canonical)) return
    if (canonical === def.defaultChord) {
      delete next[id]
    } else {
      next[id] = canonical
    }
  }
  updateBindings(next)
}

export function replaceShortcutChord(id: ShortcutActionId, chord: string): void {
  const def = DEFINITION_MAP.get(id)
  if (!def) return
  const parsed = parseChord(chord)
  if (!parsed) return
  const canonical = serializeChord(parsed)
  if (RESERVED_EDIT_CHORDS.has(canonical)) return

  const next = { ...shortcutOverrides.value }
  for (const other of SHORTCUT_DEFINITIONS) {
    if (other.id === id) continue
    const otherChord = next[other.id] !== undefined ? next[other.id]! : other.defaultChord
    if (otherChord === canonical) {
      next[other.id] = ''
    }
  }
  if (canonical === def.defaultChord) {
    delete next[id]
  } else {
    next[id] = canonical
  }
  updateBindings(next)
}

export function resetShortcutChord(id: ShortcutActionId): void {
  if (!(id in shortcutOverrides.value)) return
  const next = { ...shortcutOverrides.value }
  delete next[id]
  updateBindings(next)
}

export function resetAllShortcuts(): void {
  updateBindings({})
}

export function isShortcutCustomized(id: ShortcutActionId): boolean {
  return id in shortcutOverrides.value
}

export function hasAnyCustomShortcut(): boolean {
  return Object.keys(shortcutOverrides.value).length > 0
}
