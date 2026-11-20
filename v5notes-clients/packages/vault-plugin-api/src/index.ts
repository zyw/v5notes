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

/**
 * Where a plugin's own settings belong.
 *
 * - 'vault'  (default) follows the notes of the vault that is open: per-vault
 *   templates, last opened note, anything naming content that lives here.
 * - 'global' follows the app: one copy shared by every vault, e.g. how the
 *   plugin itself behaves or a user-configured endpoint.
 */
export type PluginDataScope = 'global' | 'vault'

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
  /** Store an image and return a URL usable inside the note's Markdown. */
  onUploadImage?: (file: File) => string | Promise<string>
  /** Handles the toolbar image button; return false to keep the system file picker. */
  onPickImage?: () => void | false
  /** Resolve a vault-relative resource path to a displayable URL, or '' when missing. */
  resolveVaultAsset?: (relativePath: string) => Promise<string>
  onReady?: () => void
}

/** A stored image the host offers for insertion (vault attachment manager). */
export interface PickedImage {
  /** Alt text shown in the inserted Markdown link. */
  name: string
  /** Markdown URL text — relative (`attachments/x.png`) or absolute. */
  url: string
}

/**
 * One mounted note editor. The host toggles preview/edit via `setEditable`
 * and must not remount, so undo history stays on this instance.
 */
export interface EditorSession {
  getMarkdown(): string
  setMarkdown(markdown: string): void
  setEditable(editable: boolean): void
  /** Optional: swap between the rendered view and the Markdown source. */
  setSourceMode?(enabled: boolean): void
  isSourceMode?(): boolean
  focus(): void
  focusAt(offset: number): void
  /** Insert an image at the caret; hosts may offer this after a pick dialog. */
  insertImage(image: PickedImage): void
  getOutline(): EditorOutlineEntry[]
  selectFindMatch(from: number, to: number): void
  replaceNextMatch(query: string, replacement: string, options?: EditorFindOptions): EditorFindResult
  replaceAllMatches(query: string, replacement: string, options?: EditorFindOptions): EditorFindResult
  /** Optional: switch the v5md theme without remounting the instance. */
  setTheme?(theme: string): void
  /** Optional: the rendered note body, for export snapshots. */
  getContentElement?(): HTMLElement | null
  /** Optional: resolve once visible images have loaded (or the wait times out). */
  waitForImages?(timeoutMs?: number): Promise<void>
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

  /** Optional: first enable on this machine (not every open, not per vault). */
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

  /** Settings for the open vault. Null when nothing is saved or no vault is open. */
  async loadData<T = unknown>(_scope: PluginDataScope = 'vault'): Promise<T | null> {
    throw new Error('loadData is provided by the host')
  }

  /** Saved per vault by default; pass 'global' for app-wide settings. */
  async saveData(_data: unknown, _scope: PluginDataScope = 'vault'): Promise<void> {
    throw new Error('saveData is provided by the host')
  }
}
