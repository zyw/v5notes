import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_FONT_SIZE,
  clampFontSize,
  buildEditorCommands,
  buildPluginCommands,
  filterCommands,
  groupCommands,
  matchesQuery,
  modeSwitchLabel,
  isSourceMode,
  modeChipLabel,
  paletteModeLabel,
  visibleCommands,
  type CommandActions,
  type CommandContext,
} from './editorCommands'

function actions(): CommandActions {
  return {
    enterEdit: vi.fn(),
    enterSource: vi.fn(),
    leaveEdit: vi.fn(),
    saveNote: vi.fn(),
    toggleSidebar: vi.fn(),
    toggleOutline: vi.fn(),
    toggleFind: vi.fn(),
    toggleTrash: vi.fn(),
    openAttachments: vi.fn(),
    changeFontSize: vi.fn(),
    exportNote: vi.fn(),
    copyMarkdown: vi.fn(),
    openSettings: vi.fn(),
  }
}

const editContext: CommandContext = {
  mode: 'edit',
  hasNote: true,
  dirty: false,
  busy: false,
  sidebarOpen: true,
  outlineOpen: true,
  outlineTab: 'outline',
  trashOpen: false,
  fontSize: 17,
}

const previewContext: CommandContext = { ...editContext, mode: 'preview' }
const sourceContext: CommandContext = { ...editContext, mode: 'source' }
const emptyContext: CommandContext = { ...editContext, hasNote: false, dirty: false }

const ids = (context: CommandContext) =>
  visibleCommands(buildEditorCommands(actions()), context).map(command => command.id)

describe('editor commands', () => {
  it('never offers the mode the user is already in', () => {
    expect(ids(editContext)).not.toContain('mode.edit')
    expect(ids(editContext)).toContain('mode.preview')
    expect(ids(previewContext)).toContain('mode.edit')
    expect(ids(previewContext)).not.toContain('mode.preview')
  })

  it('offers source mode from the rendered and preview modes but not from itself', () => {
    expect(ids(editContext)).toContain('mode.source')
    expect(ids(previewContext)).toContain('mode.source')
    expect(ids(sourceContext)).not.toContain('mode.source')
    // Source is a writable surface: 编辑 and 预览 are the ways out of it.
    expect(ids(sourceContext)).toEqual(expect.arrayContaining(['mode.edit', 'mode.preview']))
  })

  it('runs the source mode command', async () => {
    const list = actions()
    const commands = buildEditorCommands(list)
    await commands.find(command => command.id === 'mode.source')!.run()
    expect(list.enterSource).toHaveBeenCalledTimes(1)
    expect(list.enterEdit).not.toHaveBeenCalled()
  })

  it('hides note-only commands when no note is open', () => {
    const visible = ids(emptyContext)
    expect(visible).toContain('view.sidebar')
    expect(visible).toContain('app.settings')
    expect(visible).not.toContain('view.outline')
    expect(visible).not.toContain('export.pdf')
    expect(visible).not.toContain('note.copy')
  })

  it('only offers save while the draft is dirty and nothing is in flight', () => {
    expect(ids(editContext)).not.toContain('file.save')
    expect(ids({ ...editContext, dirty: true })).toContain('file.save')
    expect(ids({ ...editContext, dirty: true, busy: true })).not.toContain('file.save')
  })

  it('keeps font size commands within range and open for repeats', () => {
    const commands = buildEditorCommands(actions())
    const up = commands.find(command => command.id === 'font.increase')!
    const down = commands.find(command => command.id === 'font.decrease')!
    expect(up.keepOpen).toBe(true)
    expect(up.available({ ...editContext, fontSize: 26 })).toBe(false)
    expect(down.available({ ...editContext, fontSize: 13 })).toBe(false)
    expect(up.badge?.(editContext)).toBe('17 px')
  })

  it('marks the active view state on the command itself', () => {
    const commands = buildEditorCommands(actions())
    const sidebar = commands.find(command => command.id === 'view.sidebar')!
    expect(sidebar.badge?.({ ...editContext, sidebarOpen: false })).toBe('已隐藏')
    const save = commands.find(command => command.id === 'file.save')!
    expect(save.badge?.({ ...editContext, dirty: true })).toBe('未保存')
    const find = commands.find(command => command.id === 'view.find')!
    expect(find.badge?.(editContext)).toBeUndefined()
    expect(find.badge?.({ ...editContext, outlineTab: 'find' })).toBe('已显示')
  })

  it('runs the action behind a command', async () => {
    const list = actions()
    const commands = buildEditorCommands(list)
    await commands.find(command => command.id === 'mode.edit')!.run()
    await commands.find(command => command.id === 'export.markdown')!.run()
    await commands.find(command => command.id === 'app.settings')!.run()
    expect(list.enterEdit).toHaveBeenCalledTimes(1)
    expect(list.exportNote).toHaveBeenCalledWith('markdown')
    expect(list.openSettings).toHaveBeenCalledTimes(1)
  })
})

describe('source mode helpers', () => {
  it('reports the Markdown source surface', () => {
    expect(isSourceMode('source')).toBe(true)
    expect(isSourceMode('edit')).toBe(false)
    expect(isSourceMode('preview')).toBe(false)
  })
})

describe('plugin commands', () => {
  it('decorates plugin command ids and only disambiguates duplicates', async () => {
    const run = vi.fn()
    const commands = buildPluginCommands([
      { id: 'toggle', name: '切换拼写检查', pluginId: 'spell', run },
      { id: 'toggle', name: '切换代理', pluginId: 'proxy', run },
    ])
    expect(commands.map(command => command.id)).toEqual(['plugin.spell.toggle', 'plugin.proxy.toggle'])
    expect(commands[0].hint).toBe('spell')
    expect(commands.every(command => command.group === 'plugin')).toBe(true)
    await commands[0].run()
    expect(run).toHaveBeenCalledTimes(1)
  })
})

describe('palette helpers', () => {
  it('groups commands in the approved order', () => {
    const commands = buildEditorCommands(actions())
      .concat(buildPluginCommands([{ id: 'x', name: '插件命令', pluginId: 'p', run: () => {} }]))
    const order = groupCommands(commands).map(group => group.name)
    expect(order).toEqual(['mode', 'view', 'type', 'plugin', 'export', 'app'])
  })

  it('matches every query word against label, hint and keywords', () => {
    const commands = buildEditorCommands(actions())
    const pdf = commands.find(command => command.id === 'export.pdf')!
    expect(matchesQuery(pdf, '')).toBe(true)
    expect(matchesQuery(pdf, 'pdf')).toBe(true)
    expect(matchesQuery(pdf, '导出 png')).toBe(false)
    expect(filterCommands(commands, '字号').map(command => command.id)).toEqual([
      'font.increase',
      'font.decrease',
    ])
  })

  it('labels the current mode for the palette header', () => {
    expect(paletteModeLabel(editContext)).toBe('编辑 · 所见即所得')
    expect(paletteModeLabel(previewContext)).toBe('预览 · 只读')
    expect(paletteModeLabel(sourceContext)).toBe('源码模式')
    expect(modeSwitchLabel('edit')).toBe('编辑模式')
    expect(modeSwitchLabel('preview')).toBe('预览模式')
    expect(modeSwitchLabel('source')).toBe('源码模式')
    expect(modeChipLabel('edit')).toBe('编辑中')
    expect(modeChipLabel('preview')).toBe('预览中')
    expect(modeChipLabel('source')).toBe('源码')
  })

  it('clamps stored font sizes into the supported range', () => {
    expect(clampFontSize(Number.NaN)).toBe(DEFAULT_FONT_SIZE)
    expect(clampFontSize(4)).toBe(13)
    expect(clampFontSize(99)).toBe(26)
    expect(clampFontSize(18.6)).toBe(19)
  })
})
