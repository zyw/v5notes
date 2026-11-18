/**
 * @v5notes/vault-plugin-api — stable types for Vault Client plugins (Phase 6–7).
 * Host injects runtime; plugins must not bundle this package into main.js.
 */

export type PluginPermission =
  | 'vault:read'
  | 'vault:write'
  | 'ui:commands'
  | 'ui:ribbon'
  | 'ui:status'
  | 'ui:settings'
  | 'ui:views'
  | 'ui:theme'
  | 'editor:extend'
  | 'editor:provide'
  | 'network:safe'
  | 'clipboard'

/** Never granted to third parties. */
export type ForbiddenPermission =
  | 'network'
  | 'publish'
  | 'publish:*'
  | 'sync:control'
  | 'fs:arbitrary'
  | 'shell'

export type PluginKind = 'plugin' | 'theme'

export interface PluginManifest {
  id: string
  name: string
  kind?: PluginKind
  version: string
  minAppVersion?: string
  description?: string
  author?: string
  authorUrl?: string
  isDesktopOnly?: boolean
  permissions?: PluginPermission[]
  main?: string
  theme?: string
  themeMeta?: string
  /** Required when requesting `network:safe` (exact host or `*.example.com`). */
  networkAllowlist?: string[]
  /** Catalog / review tags; host rejects `publishing`. */
  tags?: string[]
}

export interface PluginCommand {
  id: string
  name: string
  callback: () => void | Promise<void>
}

export interface ThemeInfo {
  id: string
  name: string
  version?: string
  description?: string
  author?: string
  builtin: boolean
  source: 'builtin' | 'vault' | 'core'
}

export interface ThemeApi {
  list(): ThemeInfo[]
  getActive(): string
  setActive(id: string): Promise<void>
  getCssVariables(): Record<string, string>
}

export interface VaultAdapter {
  list(path: string): Promise<string[]>
  read(path: string): Promise<string>
  write(path: string, data: string): Promise<void>
  delete(path: string): Promise<void>
  rename(from: string, to: string): Promise<void>
  exists(path: string): Promise<boolean>
}

export interface WorkspaceApi {
  openNotice(message: string): void
  getActiveFile(): { path: string } | null
  openFile?(path: string): Promise<void>
}

export interface AppPluginsApi {
  getEnabledIds(): string[]
  isSafeMode(): boolean
}

/** Phase 7: host-proxied fetch under `network:safe`. */
export type SafeRequestMethod = 'GET' | 'HEAD' | 'POST'

export interface SafeRequestOptions {
  method?: SafeRequestMethod
  headers?: Record<string, string>
  /** POST body only; size-capped by host; must not be a silent full-vault dump. */
  body?: string
}

export interface SafeRequestResult {
  ok: boolean
  status: number
  headers: Record<string, string>
  /** Text body truncated to host max response size. */
  text: string
}

export interface NetworkSafeApi {
  request(url: string, options?: SafeRequestOptions): Promise<SafeRequestResult>
}

export interface App {
  vault: VaultAdapter
  workspace: WorkspaceApi
  theme: ThemeApi
  plugins: AppPluginsApi
  /** Present only when plugin was granted `network:safe`. */
  network?: NetworkSafeApi
}

export type Disposer = () => void

export interface RibbonIconSpec {
  id: string
  title: string
  /** Short label shown in host ribbon (emoji/text ok; host may map to SVG later). */
  icon: string
  callback: () => void | Promise<void>
}

export interface SettingTabSpec {
  id: string
  name: string
  /** Host mounts a container element; plugin fills it. */
  display: (containerEl: HTMLElement) => void | Promise<void>
}

export interface ViewSpec {
  type: string
  name: string
  /** Host mounts a leaf container; plugin fills it. */
  mount: (containerEl: HTMLElement) => void | Promise<void>
  unmount?: () => void
}

export interface EditorOutlineEntry {
  depth: number
  text: string
  start: number
}

export interface EditorFindOptions {
  caseSensitive?: boolean
  wholeWord?: boolean
  regexp?: boolean
}

export interface EditorFindResult {
  hit: { from: number; to: number; index: number; total: number } | null
  error: string | null
}

export interface EditorMountOptions {
  markdown: string
  editable: boolean
  placeholder?: string
  locale?: string
  theme?: string
  onChange: (markdown: string) => void
  onFindRequest?: () => void
  onReady?: () => void
}

/**
 * One mounted note editor. The host toggles preview/edit via `setEditable`
 * and must not remount, so undo history stays on this instance.
 */
export interface EditorSession {
  getMarkdown(): string
  setMarkdown(markdown: string): void
  setEditable(editable: boolean): void
  focus(): void
  focusAt(offset: number): void
  getOutline(): EditorOutlineEntry[]
  selectFindMatch(from: number, to: number): void
  replaceNextMatch(query: string, replacement: string, options?: EditorFindOptions): EditorFindResult
  replaceAllMatches(query: string, replacement: string, options?: EditorFindOptions): EditorFindResult
  destroy(): void
}

/** Requires `editor:provide`. One active provider paints the note canvas. */
export interface EditorProviderSpec {
  id: string
  name: string
  mount(container: HTMLElement, options: EditorMountOptions): EditorSession | Promise<EditorSession>
}

export abstract class Plugin {
  readonly app: App
  readonly manifest: PluginManifest
  private readonly _disposers: Disposer[] = []
  private readonly _commands: PluginCommand[] = []
  private readonly _ribbons: RibbonIconSpec[] = []
  private readonly _settingTabs: SettingTabSpec[] = []
  private readonly _views: ViewSpec[] = []
  private readonly _editors: EditorProviderSpec[] = []

  constructor(app: App, manifest: PluginManifest) {
    this.app = app
    this.manifest = manifest
  }

  abstract onload(): void | Promise<void>

  onunload(): void {
    /* optional */
  }

  /** Optional: first enable in this vault (not every open). */
  onUserEnable?(): void | Promise<void>

  register(disposer: Disposer): void {
    this._disposers.push(disposer)
  }

  addCommand(command: PluginCommand): void {
    this._commands.push(command)
  }

  /** Requires `ui:ribbon`. */
  addRibbonIcon(spec: RibbonIconSpec): void {
    this._ribbons.push(spec)
  }

  /** Requires `ui:settings`. */
  addSettingTab(spec: SettingTabSpec): void {
    this._settingTabs.push(spec)
  }

  /** Requires `ui:views`. */
  registerView(spec: ViewSpec): void {
    this._views.push(spec)
  }

  /** Requires `editor:provide`. Replaces the note canvas when the user selects this id. */
  registerEditorProvider(spec: EditorProviderSpec): void {
    this._editors.push(spec)
  }

  /** Host-only: registered commands before unload. */
  getRegisteredCommands(): readonly PluginCommand[] {
    return this._commands
  }

  /** Host-only. */
  getRegisteredRibbons(): readonly RibbonIconSpec[] {
    return this._ribbons
  }

  /** Host-only. */
  getRegisteredSettingTabs(): readonly SettingTabSpec[] {
    return this._settingTabs
  }

  /** Host-only. */
  getRegisteredViews(): readonly ViewSpec[] {
    return this._views
  }

  /** Host-only. */
  getRegisteredEditorProviders(): readonly EditorProviderSpec[] {
    return this._editors
  }

  /** Host-only: run all disposers. */
  __disposeAll(): void {
    while (this._disposers.length) {
      try {
        this._disposers.pop()?.()
      } catch {
        /* ignore disposer errors */
      }
    }
  }

  async loadData<T = unknown>(): Promise<T | null> {
    throw new Error('loadData is provided by the host')
  }

  async saveData(_data: unknown): Promise<void> {
    throw new Error('saveData is provided by the host')
  }
}
