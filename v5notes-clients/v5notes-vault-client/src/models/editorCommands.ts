import { modShortcut } from './platform'

/**
 * Editor command palette model, ported from v5notes-client2's `editorCommands`.
 *
 * The three reading/writing modes match Cloud: 所见即所得, 源码 (Markdown
 * source) and 预览 (read-only). The vault has fewer surfaces than Cloud (no
 * format strip, no server-side history), so the palette lists the vault's own
 * commands under the same groups, ordering and interaction: a command that
 * cannot run right now never appears, and the mode you are already in is never
 * offered.
 */
export type EditorMode = 'preview' | 'edit' | 'source'
export type ExportFormat = 'html' | 'pdf' | 'markdown' | 'image'

/** True when the writable surface is the Markdown source, not the rendered view. */
export function isSourceMode(mode: EditorMode): boolean {
  return mode === 'source'
}

export interface CommandContext {
  mode: EditorMode
  hasNote: boolean
  dirty: boolean
  busy: boolean
  sidebarOpen: boolean
  outlineOpen: boolean
  outlineTab: 'outline' | 'find'
  trashOpen: boolean
  fontSize: number
}

export interface CommandActions {
  enterEdit: () => void
  enterSource: () => void
  leaveEdit: () => void
  saveNote: () => void
  toggleSidebar: () => void
  toggleOutline: () => void
  toggleFind: () => void
  toggleTrash: () => void
  openAttachments: () => void
  changeFontSize: (delta: number) => void
  exportNote: (format: ExportFormat) => void
  copyMarkdown: () => void
  openSettings: () => void
}

export interface PluginCommandItem {
  id: string
  name: string
  /** Owning plugin id — shown when two plugins reuse a command id. */
  pluginId: string
  run: () => void | Promise<void>
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

export const GROUP_ORDER = ['mode', 'view', 'type', 'plugin', 'export', 'app'] as const

export const GROUP_LABELS: Record<string, string> = {
  mode: '显示模式',
  view: '视图',
  type: '排版',
  plugin: '插件',
  export: '导出',
  app: '应用',
}

export const FONT_MIN = 13
export const FONT_MAX = 26
export const DEFAULT_FONT_SIZE = 17

/** Same per-theme names as Cloud: theme ids are product names, not UI copy. */
export const EDITOR_THEME_LABELS: Record<string, string> = {
  paper: 'Paper',
  github: 'GitHub',
  nord: 'Nord',
  'tokyo-night': 'Tokyo Night',
  catppuccin: 'Catppuccin',
  'one-dark': 'One Dark',
  dracula: 'Dracula',
  'solarized-light': 'Solarized Light',
  'solarized-dark': 'Solarized Dark',
  'catppuccin-latte': 'Catppuccin Latte',
  'rose-pine-dawn': 'Rosé Pine Dawn',
}

export function buildEditorCommands(actions: CommandActions): EditorCommand[] {
  return [
    {
      id: 'mode.edit',
      group: 'mode',
      label: '进入编辑',
      hint: '所见即所得，继续修改正文',
      shortcut: modShortcut('E'),
      keywords: '编辑 修改 所见即所得 wysiwyg write edit',
      available: context => context.mode !== 'edit',
      run: () => actions.enterEdit(),
    },
    {
      id: 'mode.source',
      group: 'mode',
      label: '源码模式',
      hint: '直接编辑 Markdown 原文',
      shortcut: modShortcut('2'),
      keywords: '源码 markdown source 文本',
      available: context => context.mode !== 'source',
      run: () => actions.enterSource(),
    },
    {
      id: 'mode.preview',
      group: 'mode',
      label: '预览',
      hint: '只读，按发布的样子看；切换前先保存',
      shortcut: modShortcut('R'),
      keywords: '预览 阅读 完成 preview readonly',
      available: context => context.mode !== 'preview',
      run: () => actions.leaveEdit(),
    },
    {
      id: 'file.save',
      group: 'view',
      label: '保存',
      hint: '写入本机文件；没有改动时不会重复写盘',
      shortcut: modShortcut('S'),
      keywords: '保存 落盘 save write',
      badgeTone: 'state',
      badge: context => (context.dirty ? '未保存' : '已保存'),
      available: context => context.hasNote && context.dirty && !context.busy,
      run: () => actions.saveNote(),
    },
    {
      id: 'view.sidebar',
      group: 'view',
      label: '侧栏',
      hint: '目录树与搜索',
      keywords: '侧栏 目录 树 显示 隐藏 sidebar tree',
      badgeTone: 'state',
      badge: context => (context.sidebarOpen ? '已显示' : '已隐藏'),
      available: () => true,
      run: () => actions.toggleSidebar(),
    },
    {
      id: 'view.outline',
      group: 'view',
      label: '大纲',
      hint: '标题层级与查找',
      keywords: '大纲 标题 目录 outline',
      badgeTone: 'state',
      badge: context => (context.outlineOpen && context.outlineTab === 'outline' ? '已显示' : undefined),
      available: context => context.hasNote,
      run: () => actions.toggleOutline(),
    },
    {
      id: 'view.find',
      group: 'view',
      label: '查找',
      hint: '在当前笔记中查找与替换',
      shortcut: modShortcut('F'),
      keywords: '查找 搜索 替换 find search replace',
      badgeTone: 'state',
      badge: context => (context.outlineOpen && context.outlineTab === 'find' ? '已显示' : undefined),
      available: context => context.hasNote,
      run: () => actions.toggleFind(),
    },
    {
      id: 'view.trash',
      group: 'view',
      label: '回收站',
      hint: '本机删除的笔记可还原',
      keywords: '回收站 已删除 还原 trash',
      badgeTone: 'state',
      badge: context => (context.trashOpen ? '使用中' : undefined),
      available: () => true,
      run: () => actions.toggleTrash(),
    },
    {
      id: 'attach.open',
      group: 'view',
      label: '插入附件图片',
      hint: '从库内附件中选择，或在编辑模式插入到光标处',
      keywords: '附件 图片 插入 image attachment',
      available: () => true,
      run: () => actions.openAttachments(),
    },
    {
      id: 'font.increase',
      group: 'type',
      label: '增大字号',
      hint: '每次增加 1 px',
      shortcut: modShortcut('+'),
      keywords: '字号 放大 font',
      badge: context => `${context.fontSize} px`,
      keepOpen: true,
      available: context => context.hasNote && context.fontSize < FONT_MAX,
      run: () => actions.changeFontSize(1),
    },
    {
      id: 'font.decrease',
      group: 'type',
      label: '减小字号',
      hint: `最小 ${FONT_MIN} px`,
      shortcut: modShortcut('−'),
      keywords: '字号 缩小 font',
      badge: context => `${context.fontSize} px`,
      keepOpen: true,
      available: context => context.hasNote && context.fontSize > FONT_MIN,
      run: () => actions.changeFontSize(-1),
    },
    {
      id: 'export.html',
      group: 'export',
      label: '导出 HTML 网页',
      hint: '带样式，可离线打开',
      keywords: '导出 html 网页',
      badge: () => '.html',
      available: context => context.hasNote,
      run: () => actions.exportNote('html'),
    },
    {
      id: 'export.pdf',
      group: 'export',
      label: '导出 PDF',
      hint: 'A4 分页，整篇渲染成图片页',
      keywords: '导出 pdf 打印',
      badge: () => '.pdf',
      available: context => context.hasNote,
      run: () => actions.exportNote('pdf'),
    },
    {
      id: 'export.markdown',
      group: 'export',
      label: '导出 Markdown',
      hint: '原始 .md，跨工具通用',
      keywords: '导出 markdown md 源文件',
      badge: () => '.md',
      available: context => context.hasNote,
      run: () => actions.exportNote('markdown'),
    },
    {
      id: 'export.image',
      group: 'export',
      label: '导出图片长图',
      hint: '整篇渲染成一张 PNG',
      keywords: '导出 图片 png 长图',
      badge: () => '.png',
      available: context => context.hasNote,
      run: () => actions.exportNote('image'),
    },
    {
      id: 'note.copy',
      group: 'app',
      label: '复制 Markdown',
      hint: '把当前笔记原文复制到剪贴板',
      keywords: '复制 剪贴板 copy clipboard',
      available: context => context.hasNote,
      run: () => actions.copyMarkdown(),
    },
    {
      id: 'app.settings',
      group: 'app',
      label: '设置',
      hint: '外观、同步与插件',
      keywords: '设置 偏好 选项 settings preferences',
      available: () => true,
      run: () => actions.openSettings(),
    },
  ]
}

/** Plugin commands join the same palette so one shortcut reaches everything. */
export function buildPluginCommands(plugins: PluginCommandItem[]): EditorCommand[] {
  const seen = new Map<string, number>()
  for (const command of plugins) seen.set(command.id, (seen.get(command.id) ?? 0) + 1)
  return plugins.map(command => ({
    id: `plugin.${command.pluginId}.${command.id}`,
    group: 'plugin',
    label: command.name,
    hint: seen.get(command.id) === 1 ? '' : command.pluginId,
    keywords: `插件 plugin ${command.pluginId}`,
    available: () => true,
    run: command.run,
  }))
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
  const rank = (name: string) => {
    const index = (GROUP_ORDER as readonly string[]).indexOf(name)
    return index === -1 ? GROUP_ORDER.length : index
  }
  return groups.sort((left, right) => rank(left.name) - rank(right.name))
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
  if (context.mode === 'source') return '源码模式'
  return context.mode === 'edit' ? '编辑 · 所见即所得' : '预览 · 只读'
}

/** Bottom toast copy shown after a mode switch. */
export function modeSwitchLabel(mode: EditorMode): string {
  if (mode === 'source') return '源码模式'
  return mode === 'edit' ? '编辑模式' : '预览模式'
}

/** Header chip copy for the mode the note is shown in. */
export function modeChipLabel(mode: EditorMode): string {
  if (mode === 'source') return '源码'
  return mode === 'edit' ? '编辑中' : '预览中'
}

export function clampFontSize(size: number): number {
  if (!Number.isFinite(size)) return DEFAULT_FONT_SIZE
  return Math.max(FONT_MIN, Math.min(FONT_MAX, Math.round(size)))
}
