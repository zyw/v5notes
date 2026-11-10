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

export const GROUP_ORDER = ['显示模式', '视图', '排版', '导出'] as const

/**
 * The command palette is generated from the current workspace state instead of
 * being a fixed list: a command that cannot run right now never appears, and the
 * mode you are already in is never offered. See `visibleCommands`.
 */
export function buildEditorCommands(actions: CommandActions): EditorCommand[] {
  return [
    {
      id: 'mode.edit',
      group: '显示模式',
      label: '回到编辑',
      hint: '所见即所得，继续修改正文',
      shortcut: '⌘1',
      keywords: '编辑 所见即所得 wysiwyg 返回',
      available: context => context.mode !== 'edit',
      run: () => actions.setMode('edit'),
    },
    {
      id: 'mode.source',
      group: '显示模式',
      label: '源码模式',
      hint: '直接编辑 Markdown 原文',
      shortcut: '⌘2',
      keywords: '源码 markdown source',
      available: context => context.mode === 'edit',
      run: () => actions.setMode('source'),
    },
    {
      id: 'mode.preview',
      group: '显示模式',
      label: '预览',
      hint: '只读，按发布的样子看',
      shortcut: '⌘3',
      keywords: '预览 阅读 preview',
      available: context => context.mode !== 'preview',
      run: () => actions.setMode('preview'),
    },
    {
      id: 'view.focus',
      group: '视图',
      label: '专注写作',
      hint: '收起目录，只留正文',
      shortcut: '⌘.',
      keywords: '专注 写作 focus',
      badgeTone: 'state',
      badge: context => (context.focusMode ? '已开启' : undefined),
      available: context => context.mode !== 'preview',
      run: () => actions.toggleFocus(),
    },
    {
      id: 'view.toolbar',
      group: '视图',
      label: '编辑器工具条',
      hint: '格式按钮的显示与隐藏',
      shortcut: '⌘/',
      keywords: '工具条 格式 隐藏 显示 toolbar',
      badgeTone: 'state',
      badge: context => (context.toolbarVisible ? '已显示' : '已隐藏'),
      available: context => context.mode === 'edit',
      run: () => actions.toggleToolbar(),
    },
    {
      id: 'view.history',
      group: '视图',
      label: '历史记录',
      hint: '查看与恢复旧版本',
      shortcut: '⌘Y',
      keywords: '历史 版本 history',
      available: context => context.hasNote && context.mode !== 'preview',
      run: () => actions.openHistory(),
    },
    {
      id: 'font.increase',
      group: '排版',
      label: '增大字号',
      hint: '每次增加 1 px',
      shortcut: '⌘+',
      keywords: '字号 放大 font',
      badge: context => `${context.fontSize} px`,
      keepOpen: true,
      available: context => context.hasNote,
      run: () => actions.changeFontSize(1),
    },
    {
      id: 'font.decrease',
      group: '排版',
      label: '减小字号',
      hint: '最小 13 px',
      shortcut: '⌘−',
      keywords: '字号 缩小 font',
      keepOpen: true,
      available: context => context.hasNote,
      run: () => actions.changeFontSize(-1),
    },
    {
      id: 'export.html',
      group: '导出',
      label: '导出 HTML 网页',
      hint: '带样式，可离线打开',
      keywords: '导出 html 网页',
      badge: () => '.html',
      available: context => context.hasNote,
      run: () => actions.exportNote('html'),
    },
    {
      id: 'export.pdf',
      group: '导出',
      label: '导出 PDF',
      hint: '矢量排版，文字可选中；不可用时自动改图片版',
      keywords: '导出 pdf 矢量 打印',
      badge: () => '.pdf',
      available: context => context.hasNote,
      run: () => actions.exportNote('pdf'),
    },
    {
      id: 'export.pdfImage',
      group: '导出',
      label: '导出 PDF（图片版）',
      hint: '整篇渲染成图片，全平台结果一致',
      keywords: '导出 pdf 图片 光栅',
      badge: () => '.pdf',
      available: context => context.hasNote,
      run: () => actions.exportNote('pdf-image'),
    },
    {
      id: 'export.markdown',
      group: '导出',
      label: '导出 Markdown',
      hint: '原始 .md，跨工具通用',
      keywords: '导出 markdown md 源文件',
      badge: () => '.md',
      available: context => context.hasNote,
      run: () => actions.exportNote('markdown'),
    },
    {
      id: 'export.image',
      group: '导出',
      label: '导出图片长图',
      hint: '整篇渲染成一张 PNG',
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
  if (context.mode === 'preview') return '预览 · 只读'
  if (context.mode === 'source') return '源码模式'
  return '所见即所得'
}

/** Bottom toast copy shown after a mode switch; mirrors the v3 design wording. */
export function modeSwitchLabel(mode: WorkspaceMode): string {
  if (mode === 'preview') return '预览模式'
  if (mode === 'source') return '源码模式'
  return '所见即所得'
}
