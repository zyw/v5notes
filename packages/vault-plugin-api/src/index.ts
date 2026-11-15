/**
 * @v5notes/vault-plugin-api — stable types for Vault Client plugins (Phase 6).
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
  networkAllowlist?: string[]
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

export interface App {
  vault: VaultAdapter
  workspace: WorkspaceApi
  theme: ThemeApi
  plugins: AppPluginsApi
}

export type Disposer = () => void

export abstract class Plugin {
  readonly app: App
  readonly manifest: PluginManifest
  private readonly _disposers: Disposer[] = []
  private readonly _commands: PluginCommand[] = []

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

  /** Host-only: registered commands before unload. */
  getRegisteredCommands(): readonly PluginCommand[] {
    return this._commands
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
