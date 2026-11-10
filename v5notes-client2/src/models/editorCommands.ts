import { t } from '../i18n'

export type WorkspaceMode = 'edit' | 'source' | 'preview'
export type ExportFormat = 'html' | 'pdf' | 'pdf-image' | 'markdown' | 'image'

export interface CommandContext {
  mode: WorkspaceMode
  focusMode: boolean
  toolbarVisible: boolean
  hasNote: boolean
  dirty: boolean
  fontSize: number
}

export interface CommandActions {
  setMode: (mode: WorkspaceMode) => void
  toggleFocus: () => void
  toggleToolbar: () => void
  openHistory: () => void
  changeFontSize: (delta: number) => void
  exportNote: (format: ExportFormat) => void
  renameNote: () => void
  copyMarkdown: () => void
  deleteNote: () => void
}

export interface EditorCommand {
  id: string
  group: string
  label: string
  hint: string
  shortcut?: string
  keywords: string
  /** `state` renders as a pill; `meta` (file extension, size) renders as plain text. */
  badgeTone?: 'state' | 'meta'
  badge?: (context: CommandContext) => string | undefined
  /** Repeatable adjustments keep the palette open so they can be tapped again. */
  keepOpen?: boolean
  available: (context: CommandContext) => boolean
  run: () => void | Promise<void>
}

export interface CommandGroup {
  name: string
  items: EditorCommand[]
}

export const GROUP_ORDER = ['mode', 'view', 'type', 'export'] as const

/**
 * The command palette is generated from the current workspace state instead of
 * being a fixed list: a command that cannot run right now never appears, and the
 * mode you are already in is never offered. See `visibleCommands`.
 */
export function buildEditorCommands(actions: CommandActions): EditorCommand[] {
  return [
    {
      id: 'mode.edit',
      group: 'mode',
      label: t('commands.edit'),
      hint: t('commands.editHint'),
      shortcut: '⌘1',
      keywords: '编辑 所见即所得 wysiwyg 返回',
      available: context => context.mode !== 'edit',
      run: () => actions.setMode('edit'),
    },
    {
      id: 'mode.source',
      group: 'mode',
      label: t('commands.source'),
      hint: t('commands.sourceHint'),
      shortcut: '⌘2',
      keywords: '源码 markdown source',
      available: context => context.mode === 'edit',
      run: () => actions.setMode('source'),
    },
    {
      id: 'mode.preview',
      group: 'mode',
      label: t('commands.preview'),
      hint: t('commands.previewHint'),
      shortcut: '⌘3',
      keywords: '预览 阅读 preview',
      available: context => context.mode !== 'preview',
      run: () => actions.setMode('preview'),
    },
    {
      id: 'view.focus',
      group: 'view',
      label: t('commands.focus'),
      hint: t('commands.focusHint'),
      shortcut: '⌘.',
      keywords: '专注 写作 focus',
      badgeTone: 'state',
      badge: context => (context.focusMode ? t('commands.on') : undefined),
      available: context => context.mode !== 'preview',
      run: () => actions.toggleFocus(),
    },
    {
      id: 'view.toolbar',
      group: 'view',
      label: t('commands.toolbar'),
      hint: t('commands.toolbarHint'),
      shortcut: '⌘/',
      keywords: '工具条 格式 隐藏 显示 toolbar',
      badgeTone: 'state',
      badge: context => (context.toolbarVisible ? t('commands.shown') : t('commands.hidden')),
      available: context => context.mode === 'edit',
      run: () => actions.toggleToolbar(),
    },
    {
      id: 'view.history',
      group: 'view',
      label: t('commands.history'),
      hint: t('commands.historyHint'),
      shortcut: '⌘Y',
      keywords: '历史 版本 history',
      available: context => context.hasNote && context.mode !== 'preview',
      run: () => actions.openHistory(),
    },
    {
      id: 'font.increase',
      group: 'type',
      label: t('commands.fontUp'),
      hint: t('commands.fontUpHint'),
      shortcut: '⌘+',
      keywords: '字号 放大 font',
      badge: context => `${context.fontSize} px`,
      keepOpen: true,
      available: context => context.hasNote,
      run: () => actions.changeFontSize(1),
    },
    {
      id: 'font.decrease',
      group: 'type',
      label: t('commands.fontDown'),
      hint: t('commands.fontDownHint'),
      shortcut: '⌘−',
      keywords: '字号 缩小 font',
      keepOpen: true,
      available: context => context.hasNote,
      run: () => actions.changeFontSize(-1),
    },
    {
      id: 'export.html',
      group: 'export',
      label: t('commands.html'),
      hint: t('commands.htmlHint'),
      keywords: '导出 html 网页',
      badge: () => '.html',
      available: context => context.hasNote,
      run: () => actions.exportNote('html'),
    },
    {
      id: 'export.pdf',
      group: 'export',
      label: t('commands.pdf'),
      hint: t('commands.pdfHint'),
      keywords: '导出 pdf 矢量 打印',
      badge: () => '.pdf',
      available: context => context.hasNote,
      run: () => actions.exportNote('pdf'),
    },
    {
      id: 'export.pdfImage',
      group: 'export',
      label: t('commands.pdfImage'),
      hint: t('commands.pdfImageHint'),
      keywords: '导出 pdf 图片 光栅',
      badge: () => '.pdf',
      available: context => context.hasNote,
      run: () => actions.exportNote('pdf-image'),
    },
    {
      id: 'export.markdown',
      group: 'export',
      label: t('commands.markdown'),
      hint: t('commands.markdownHint'),
      keywords: '导出 markdown md 源文件',
      badge: () => '.md',
      available: context => context.hasNote,
      run: () => actions.exportNote('markdown'),
    },
    {
      id: 'export.image',
      group: 'export',
      label: t('commands.image'),
      hint: t('commands.imageHint'),
      keywords: '导出 图片 png 长图',
      badge: () => '.png',
      available: context => context.hasNote,
      run: () => actions.exportNote('image'),
    },
  ]
}

export function visibleCommands(commands: EditorCommand[], context: CommandContext): EditorCommand[] {
  return commands.filter(command => command.available(context))
}

export function groupCommands(commands: EditorCommand[]): CommandGroup[] {
  const groups: CommandGroup[] = []
  for (const command of commands) {
    const existing = groups.find(group => group.name === command.group)
    if (existing) existing.items.push(command)
    else groups.push({ name: command.group, items: [command] })
  }
  return groups.sort((left, right) => GROUP_ORDER.indexOf(left.name as typeof GROUP_ORDER[number]) - GROUP_ORDER.indexOf(right.name as typeof GROUP_ORDER[number]))
}

export function matchesQuery(command: EditorCommand, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const haystack = `${command.label} ${command.hint} ${command.keywords}`.toLowerCase()
  return needle.split(/\s+/).every(part => haystack.includes(part))
}

export function filterCommands(commands: EditorCommand[], query: string): EditorCommand[] {
  return commands.filter(command => matchesQuery(command, query))
}

export function paletteModeLabel(context: CommandContext): string {
  if (context.mode === 'preview') return t('commands.modePreviewReadonly')
  if (context.mode === 'source') return t('commands.modeSource')
  return t('commands.modeWysiwyg')
}

/** Bottom toast copy shown after a mode switch; mirrors the v3 design wording. */
export function modeSwitchLabel(mode: WorkspaceMode): string {
  if (mode === 'preview') return t('commands.modePreview')
  if (mode === 'source') return t('commands.modeSource')
  return t('commands.modeWysiwyg')
}
