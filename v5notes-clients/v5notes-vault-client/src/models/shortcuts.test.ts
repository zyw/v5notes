// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { detectShortcutPlatform, modShortcut } from './platform'
import {
  SHORTCUTS_STORAGE_KEY,
  eventToChord,
  findShortcutConflict,
  formatShortcut,
  formatShortcutParts,
  getFormattedShortcut,
  getShortcutChord,
  hasAnyCustomShortcut,
  isShortcutCustomized,
  matchesShortcut,
  parseChord,
  reloadShortcutsFromStorage,
  replaceShortcutChord,
  resetAllShortcuts,
  resetShortcutChord,
  setShortcutChord,
} from './shortcuts'

function keyEvent(overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key: '',
    code: '',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    ...overrides,
  } as KeyboardEvent
}

describe('platform helpers', () => {
  it('detects mac vs win shortcut platform', () => {
    expect(detectShortcutPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel')).toBe('mac')
    expect(detectShortcutPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32')).toBe('win')
  })

  it('formats modShortcut consistently across platforms', () => {
    expect(modShortcut('⇧S', true)).toBe('⌘⇧S')
    expect(modShortcut('⇧S', false)).toBe('Ctrl+Shift+S')
    expect(modShortcut('−', false)).toBe('Ctrl+-')
    expect(modShortcut('K', false)).toBe('Ctrl+K')
  })
})

describe('shortcut formatting', () => {
  it('formats chords into platform-native strings and keycap parts', () => {
    expect(formatShortcut('Mod+K', 'mac')).toBe('⌘K')
    expect(formatShortcut('Mod+K', 'win')).toBe('Ctrl+K')

    expect(formatShortcut('Mod+Shift+S', 'mac')).toBe('⌘⇧S')
    expect(formatShortcut('Mod+Shift+S', 'win')).toBe('Ctrl+Shift+S')

    expect(formatShortcut('Mod+=', 'mac')).toBe('⌘+')
    expect(formatShortcut('Mod+=', 'win')).toBe('Ctrl++')

    expect(formatShortcut('Mod+-', 'mac')).toBe('⌘−')
    expect(formatShortcut('Mod+-', 'win')).toBe('Ctrl+-')

    expect(formatShortcut('Mod+,', 'mac')).toBe('⌘,')
    expect(formatShortcut('Mod+,', 'win')).toBe('Ctrl+,')

    expect(formatShortcutParts('Mod+Shift+O', 'mac')).toEqual(['⌘', '⇧', 'O'])
    expect(formatShortcutParts('Mod+Shift+O', 'win')).toEqual(['Ctrl', 'Shift', 'O'])
    expect(formatShortcutParts('', 'mac')).toEqual([])
  })

  it('parses canonical chords and rejects invalid ones', () => {
    expect(parseChord('Mod+Shift+S')).toEqual({
      mod: true,
      ctrl: false,
      alt: false,
      shift: true,
      key: 'S',
    })
    expect(parseChord('F2')).toEqual({
      mod: false,
      ctrl: false,
      alt: false,
      shift: false,
      key: 'F2',
    })
    expect(parseChord('A')).toBeNull()
    expect(parseChord('')).toBeNull()
  })
})

describe('matchesShortcut', () => {
  it('enforces strict macOS modifier semantics', () => {
    const cmdK = keyEvent({ key: 'k', code: 'KeyK', metaKey: true })
    const ctrlK = keyEvent({ key: 'k', code: 'KeyK', ctrlKey: true })
    expect(matchesShortcut(cmdK, 'Mod+K', 'mac')).toBe(true)
    expect(matchesShortcut(ctrlK, 'Mod+K', 'mac')).toBe(false)
    expect(matchesShortcut(ctrlK, 'Ctrl+K', 'mac')).toBe(true)
  })

  it('enforces strict Windows modifier semantics', () => {
    const ctrlK = keyEvent({ key: 'k', code: 'KeyK', ctrlKey: true })
    const winK = keyEvent({ key: 'k', code: 'KeyK', metaKey: true })
    expect(matchesShortcut(ctrlK, 'Mod+K', 'win')).toBe(true)
    expect(matchesShortcut(winK, 'Mod+K', 'win')).toBe(false)

    const ctrlShiftS = keyEvent({ key: 'S', code: 'KeyS', ctrlKey: true, shiftKey: true })
    expect(matchesShortcut(ctrlShiftS, 'Mod+Shift+S', 'win')).toBe(true)
  })

  it('uses event.code to ignore macOS Option-modified dead characters', () => {
    const optS = keyEvent({ key: 'ß', code: 'KeyS', altKey: true })
    expect(matchesShortcut(optS, 'Alt+S', 'mac')).toBe(true)
  })

  it('matches both Equal and shifted + for font.increase', () => {
    const cmdEq = keyEvent({ key: '=', code: 'Equal', metaKey: true })
    const cmdPlus = keyEvent({ key: '+', code: 'Equal', metaKey: true, shiftKey: true })
    expect(matchesShortcut(cmdEq, 'Mod+=', 'mac')).toBe(true)
    expect(matchesShortcut(cmdPlus, 'Mod+=', 'mac')).toBe(true)

    const ctrlPlus = keyEvent({ key: '+', code: 'Equal', ctrlKey: true, shiftKey: true })
    expect(matchesShortcut(ctrlPlus, 'Mod+=', 'win')).toBe(true)
  })

  it('ignores IME composition and unbound chords', () => {
    const composing = keyEvent({ key: 's', code: 'KeyS', metaKey: true, isComposing: true })
    expect(matchesShortcut(composing, 'Mod+S', 'mac')).toBe(false)
    expect(matchesShortcut(keyEvent({ key: 's', code: 'KeyS', metaKey: true }), '', 'mac')).toBe(false)
  })
})

describe('eventToChord', () => {
  it('returns null for modifier-only key presses', () => {
    expect(eventToChord(keyEvent({ key: 'Meta', metaKey: true }), 'mac')).toBeNull()
    expect(eventToChord(keyEvent({ key: 'Control', ctrlKey: true }), 'win')).toBeNull()
    expect(eventToChord(keyEvent({ key: 'Shift', shiftKey: true }), 'mac')).toBeNull()
  })

  it('serializes macOS and Windows shortcuts accurately', () => {
    expect(eventToChord(keyEvent({ key: 'k', code: 'KeyK', metaKey: true }), 'mac')).toEqual({
      chord: 'Mod+K',
    })
    expect(eventToChord(keyEvent({ key: 'k', code: 'KeyK', ctrlKey: true }), 'mac')).toEqual({
      chord: 'Ctrl+K',
    })
    expect(eventToChord(keyEvent({ key: 'k', code: 'KeyK', ctrlKey: true }), 'win')).toEqual({
      chord: 'Mod+K',
    })
    expect(eventToChord(keyEvent({ key: 'F2', code: 'F2' }), 'win')).toEqual({
      chord: 'F2',
    })
  })

  it('rejects bare keys, Windows key, and reserved system editing chords', () => {
    expect(eventToChord(keyEvent({ key: 'a', code: 'KeyA' }), 'mac')).toEqual({
      error: expect.any(String),
    })
    expect(eventToChord(keyEvent({ key: 'k', code: 'KeyK', metaKey: true }), 'win')).toEqual({
      error: '不支持 Windows 键组合',
    })
    expect(eventToChord(keyEvent({ key: 'c', code: 'KeyC', metaKey: true }), 'mac')).toEqual({
      error: '系统编辑快捷键不可占用',
    })
    expect(eventToChord(keyEvent({ key: 'v', code: 'KeyV', ctrlKey: true }), 'win')).toEqual({
      error: '系统编辑快捷键不可占用',
    })
    expect(eventToChord(keyEvent({ key: 'z', code: 'KeyZ', metaKey: true }), 'mac')).toEqual({
      error: '系统编辑快捷键不可占用',
    })
  })
})

describe('shortcut store & persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    reloadShortcutsFromStorage()
  })

  it('updates, detects conflicts, replaces, resets, and persists overrides', () => {
    expect(getShortcutChord('palette.open')).toBe('Mod+K')
    expect(hasAnyCustomShortcut()).toBe(false)

    setShortcutChord('palette.open', 'Mod+P')
    expect(getShortcutChord('palette.open')).toBe('Mod+P')
    expect(getFormattedShortcut('palette.open', 'mac')).toBe('⌘P')
    expect(getFormattedShortcut('palette.open', 'win')).toBe('Ctrl+P')
    expect(isShortcutCustomized('palette.open')).toBe(true)
    expect(hasAnyCustomShortcut()).toBe(true)

    reloadShortcutsFromStorage()
    expect(getShortcutChord('palette.open')).toBe('Mod+P')

    const conflict = findShortcutConflict('Mod+S', 'palette.open')
    expect(conflict?.id).toBe('file.save')

    replaceShortcutChord('palette.open', 'Mod+S')
    expect(getShortcutChord('palette.open')).toBe('Mod+S')
    expect(getShortcutChord('file.save')).toBe('')

    resetShortcutChord('palette.open')
    expect(getShortcutChord('palette.open')).toBe('Mod+K')
    expect(getShortcutChord('file.save')).toBe('')

    resetAllShortcuts()
    expect(getShortcutChord('file.save')).toBe('Mod+S')
    expect(hasAnyCustomShortcut()).toBe(false)
    expect(localStorage.getItem(SHORTCUTS_STORAGE_KEY)).toBeNull()
  })

  it('ignores malformed or reserved bindings in localStorage', () => {
    localStorage.setItem(
      SHORTCUTS_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        bindings: {
          'palette.open': 'Mod+C',
          'file.save': 'invalid-chord',
          'unknown.action': 'Mod+P',
          'view.find': 'Mod+G',
        },
      }),
    )
    reloadShortcutsFromStorage()
    expect(getShortcutChord('palette.open')).toBe('Mod+K')
    expect(getShortcutChord('file.save')).toBe('Mod+S')
    expect(getShortcutChord('view.find')).toBe('Mod+G')
  })
})
