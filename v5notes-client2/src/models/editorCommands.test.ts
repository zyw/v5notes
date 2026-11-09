import { describe, expect, it, vi } from 'vitest'
import {
  buildEditorCommands,
  filterCommands,
  groupCommands,
  matchesQuery,
  paletteModeLabel,
  visibleCommands,
  type CommandActions,
  type CommandContext,
} from './editorCommands'

function actions(): CommandActions {
  return {
    setMode: vi.fn(),
    toggleFocus: vi.fn(),
    toggleToolbar: vi.fn(),
    openHistory: vi.fn(),
    changeFontSize: vi.fn(),
    exportNote: vi.fn(),
    renameNote: vi.fn(),
    copyMarkdown: vi.fn(),
    deleteNote: vi.fn(),
  }
}

const editContext: CommandContext = { mode: 'edit', focusMode: false, toolbarVisible: true, hasNote: true, dirty: false, fontSize: 17 }
const sourceContext: CommandContext = { ...editContext, mode: 'source' }
const previewContext: CommandContext = { ...editContext, mode: 'preview' }
const emptyContext: CommandContext = { ...editContext, hasNote: false }

describe('editor commands', () => {
  it('offers 12 commands while editing and hides the mode it is already in', () => {
    const commands = visibleCommands(buildEditorCommands(actions()), editContext)
    expect(commands.map(command => command.id)).toEqual([
      'mode.source',
      'mode.preview',
      'view.focus',
      'view.toolbar',
      'view.history',
      'font.increase',
      'font.decrease',
      'export.html',
      'export.pdf',
      'export.pdfImage',
      'export.markdown',
      'export.image',
    ])
  })

  it('drops editing-only commands in preview and keeps reading actions', () => {
    const ids = visibleCommands(buildEditorCommands(actions()), previewContext).map(command => command.id)
    expect(ids).toEqual([
      'mode.edit',
      'view.history',
      'font.increase',
      'font.decrease',
      'export.html',
      'export.pdf',
      'export.pdfImage',
      'export.markdown',
      'export.image',
    ])
    expect(ids).not.toContain('view.focus')
    expect(ids).not.toContain('view.toolbar')
    expect(ids).not.toContain('mode.source')
  })

  it('keeps focus and history in source mode but hides the formatting toolbar command', () => {
    const ids = visibleCommands(buildEditorCommands(actions()), sourceContext).map(command => command.id)
    expect(ids).toContain('mode.edit')
    expect(ids).toContain('view.focus')
    expect(ids).not.toContain('view.toolbar')
    expect(ids).not.toContain('mode.source')
  })

  it('hides note-bound commands when no note is open', () => {
    const ids = visibleCommands(buildEditorCommands(actions()), emptyContext).map(command => command.id)
    expect(ids).not.toContain('view.history')
    expect(ids).not.toContain('export.html')
    expect(ids).toContain('mode.source')
  })

  it('keeps group order stable and never emits an empty group', () => {
    const groups = groupCommands(visibleCommands(buildEditorCommands(actions()), previewContext))
    expect(groups.map(group => group.name)).toEqual(['显示模式', '视图', '排版', '导出'])
    for (const group of groups) expect(group.items.length).toBeGreaterThan(0)
  })

  it('shows state badges for toggles and the current font size', () => {
    const commands = buildEditorCommands(actions())
    const toolbar = commands.find(command => command.id === 'view.toolbar')
    const font = commands.find(command => command.id === 'font.increase')
    expect(toolbar?.badge?.(editContext)).toBe('已显示')
    expect(toolbar?.badge?.({ ...editContext, toolbarVisible: false })).toBe('已隐藏')
    expect(font?.badge?.(editContext)).toBe('17 px')
  })

  it('lets the font size commands keep the palette open', () => {
    const commands = buildEditorCommands(actions())
    const repeatable = commands.filter(command => command.keepOpen).map(command => command.id)
    expect(repeatable).toEqual(['font.increase', 'font.decrease'])
  })

  it('matches commands by label, hint and keywords', () => {
    const commands = buildEditorCommands(actions())
    expect(commands.filter(command => matchesQuery(command, '字号')).length).toBe(2)
    expect(commands.filter(command => matchesQuery(command, 'pdf')).length).toBe(2)
    expect(filterCommands(commands, '导出').length).toBe(5)
    expect(filterCommands(commands, '不存在的命令')).toEqual([])
  })

  it('labels the current mode for the palette header', () => {
    expect(paletteModeLabel(editContext)).toBe('所见即所得')
    expect(paletteModeLabel(sourceContext)).toBe('源码模式')
    expect(paletteModeLabel(previewContext)).toBe('预览 · 只读')
  })
})
