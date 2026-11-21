import {
  Plugin,
  type EditorProviderSpec,
  type PluginCommand,
  type PluginDataScope,
  type PluginManifest,
  type RibbonIconSpec,
  type SettingTabSpec,
  type ThemeApi,
  type VaultAdapter,
  type ViewSpec,
  type WorkspaceApi,
} from '@v5notes/vault-plugin-api'
import { attachDataMethods, createPluginApi } from './createPluginApi'
import { emptyCommunityPlugins, parseCommunityPlugins, type CommunityPluginsFile } from './communityPlugins'
import { DailyNotesPlugin, DAILY_NOTES_MANIFEST } from './core/dailyNotes'
import { PlainEditorPlugin, PLAIN_EDITOR_MANIFEST } from './core/plainEditor'
import { TemplatesPlugin, TEMPLATES_MANIFEST } from './core/templates'
import { V5EditorPlugin, V5_EDITOR_ID, V5_EDITOR_MANIFEST } from './core/v5Editor'
import { parseManifestJson, satisfiesMinAppVersion } from './manifest'
import { loadSafeMode, saveSafeMode } from './safeMode'

const APP_VERSION = '2.1.0'
export const ACTIVE_EDITOR_STORAGE_KEY = 'v5notes.vault.active-editor'

export type PluginStatus = 'loaded' | 'failed' | 'disabled' | 'skipped-safe-mode'

export interface PluginRuntimeInfo {
  id: string
  name: string
  version: string
  core: boolean
  status: PluginStatus
  error?: string
  permissions: string[]
}

export interface HostCommand {
  pluginId: string
  id: string
  name: string
  run: () => void | Promise<void>
}

export interface HostRibbon {
  pluginId: string
  id: string
  title: string
  icon: string
  run: () => void | Promise<void>
}

export interface HostSettingTab {
  pluginId: string
  id: string
  name: string
  display: (containerEl: HTMLElement) => void | Promise<void>
}

export interface HostView {
  pluginId: string
  type: string
  name: string
  mount: (containerEl: HTMLElement) => void | Promise<void>
  unmount?: () => void
}

export interface HostEditorProvider {
  pluginId: string
  id: string
  name: string
  mount: EditorProviderSpec['mount']
}

export interface VaultPluginPackage {
  id: string
  manifest: PluginManifest
  /** Raw main.js source (CJS style for Function loader). */
  mainSource?: string
}

export interface PluginHostDeps {
  vault: VaultAdapter
  workspace: WorkspaceApi
  theme: ThemeApi
  readCommunityPlugins: () => Promise<CommunityPluginsFile>
  writeCommunityPlugins: (file: CommunityPluginsFile) => Promise<void>
  loadPluginData: (scope: PluginDataScope, pluginId: string) => Promise<unknown>
  savePluginData: (scope: PluginDataScope, pluginId: string, data: unknown) => Promise<void>
  listVaultPlugins: () => Promise<VaultPluginPackage[]>
  onNotice?: (message: string) => void
}

type CoreFactory = new (app: import('@v5notes/vault-plugin-api').App, manifest: PluginManifest) => Plugin

const CORE_REGISTRY: { manifest: PluginManifest; Factory: CoreFactory }[] = [
  { manifest: V5_EDITOR_MANIFEST, Factory: V5EditorPlugin },
  { manifest: PLAIN_EDITOR_MANIFEST, Factory: PlainEditorPlugin },
  { manifest: DAILY_NOTES_MANIFEST, Factory: DailyNotesPlugin },
  { manifest: TEMPLATES_MANIFEST, Factory: TemplatesPlugin },
]

const ALWAYS_ON_CORE = new Set<string>([V5_EDITOR_ID])

function readStoredEditorId(): string {
  try {
    return localStorage.getItem(ACTIVE_EDITOR_STORAGE_KEY) || V5_EDITOR_ID
  } catch {
    return V5_EDITOR_ID
  }
}

function storeEditorId(id: string) {
  try {
    localStorage.setItem(ACTIVE_EDITOR_STORAGE_KEY, id)
  } catch {
    /* private mode / non-browser tests */
  }
}

function loadCjsPluginClass(source: string): typeof Plugin {
  const module = { exports: {} as { default?: typeof Plugin } & typeof Plugin }
  const exports = module.exports
  // Plugin is injected; sample main.js uses `extends Plugin` + module.exports = class
  const fn = new Function(
    'Plugin',
    'module',
    'exports',
    `${source}\n;return module.exports.default || module.exports;`,
  )
  const exported = fn(Plugin, module, exports)
  if (typeof exported !== 'function') {
    throw new Error('main.js 必须导出 Plugin 子类')
  }
  return exported as typeof Plugin
}

export interface PluginHost {
  start(): Promise<void>
  stop(): Promise<void>
  list(): PluginRuntimeInfo[]
  listCommands(): HostCommand[]
  listRibbons(): HostRibbon[]
  listSettingTabs(): HostSettingTab[]
  listViews(): HostView[]
  listEditorProviders(): HostEditorProvider[]
  getActiveEditor(): HostEditorProvider | null
  getActiveEditorId(): string
  setActiveEditor(id: string): void
  setSafeMode(enabled: boolean): Promise<void>
  isSafeMode(): boolean
  getEnabledIds(): string[]
  setEnabled(pluginId: string, enabled: boolean): Promise<void>
  /** Stop one plugin and drop what it registered; used before its files go away. */
  unload(pluginId: string): Promise<void>
  enableCoreDefaults(): Promise<void>
  installSampleHelloWorld(source: { manifestJson: string; mainJs: string }): Promise<void>
}

export function createPluginHost(deps: PluginHostDeps): PluginHost {
  let safeMode = loadSafeMode()
  let community = emptyCommunityPlugins()
  const instances = new Map<string, Plugin>()
  const infos = new Map<string, PluginRuntimeInfo>()
  const commands = new Map<string, HostCommand>()
  const ribbons = new Map<string, HostRibbon>()
  const settingTabs = new Map<string, HostSettingTab>()
  const views = new Map<string, HostView>()
  const editors = new Map<string, HostEditorProvider>()

  function clearSurfaceFor(pluginId: string) {
    for (const key of [...commands.keys()]) {
      if (key.startsWith(`${pluginId}:`)) commands.delete(key)
    }
    for (const key of [...ribbons.keys()]) {
      if (key.startsWith(`${pluginId}:`)) ribbons.delete(key)
    }
    for (const key of [...settingTabs.keys()]) {
      if (key.startsWith(`${pluginId}:`)) settingTabs.delete(key)
    }
    for (const key of [...views.keys()]) {
      if (key.startsWith(`${pluginId}:`)) views.delete(key)
    }
    for (const [key, editor] of [...editors.entries()]) {
      if (editor.pluginId === pluginId) editors.delete(key)
    }
  }

  async function unloadOne(id: string) {
    const inst = instances.get(id)
    if (!inst) return
    try {
      inst.onunload()
    } catch {
      /* ignore */
    }
    for (const view of inst.getRegisteredViews()) {
      try {
        view.unmount?.()
      } catch {
        /* ignore */
      }
    }
    inst.__disposeAll()
    instances.delete(id)
    clearSurfaceFor(id)
  }

  async function unloadAll() {
    for (const id of [...instances.keys()]) {
      await unloadOne(id)
    }
  }

  function hooks() {
    return {
      vault: deps.vault,
      workspace: deps.workspace,
      theme: deps.theme,
      getEnabledIds: () => [...community.enabled],
      isSafeMode: () => safeMode,
      loadData: deps.loadPluginData,
      saveData: deps.savePluginData,
      registerCommand: (pluginId: string, command: PluginCommand) => {
        const namespaced = `${pluginId}:${command.id}`
        commands.set(namespaced, {
          pluginId,
          id: command.id,
          name: command.name,
          run: command.callback,
        })
      },
      registerRibbon: (pluginId: string, spec: RibbonIconSpec) => {
        ribbons.set(`${pluginId}:${spec.id}`, {
          pluginId,
          id: spec.id,
          title: spec.title,
          icon: spec.icon,
          run: spec.callback,
        })
      },
      registerSettingTab: (pluginId: string, spec: SettingTabSpec) => {
        settingTabs.set(`${pluginId}:${spec.id}`, {
          pluginId,
          id: spec.id,
          name: spec.name,
          display: spec.display,
        })
      },
      registerView: (pluginId: string, spec: ViewSpec) => {
        views.set(`${pluginId}:${spec.type}`, {
          pluginId,
          type: spec.type,
          name: spec.name,
          mount: spec.mount,
          unmount: spec.unmount,
        })
      },
      registerEditorProvider: (pluginId: string, spec: EditorProviderSpec) => {
        editors.set(spec.id, {
          pluginId,
          id: spec.id,
          name: spec.name,
          mount: spec.mount,
        })
      },
    }
  }

  async function loadInstance(
    manifest: PluginManifest,
    Factory: typeof Plugin | (new (app: import('@v5notes/vault-plugin-api').App, m: PluginManifest) => Plugin),
    core: boolean,
  ) {
    const app = createPluginApi(hooks(), manifest)
    const instance = new (Factory as new (
      app: import('@v5notes/vault-plugin-api').App,
      m: PluginManifest,
    ) => Plugin)(app, manifest)
    attachDataMethods(instance, hooks(), manifest.id)

    const seen = community.userEnableSeen?.[manifest.id]
    if (!seen && typeof instance.onUserEnable === 'function') {
      await instance.onUserEnable()
      community = {
        ...community,
        userEnableSeen: { ...(community.userEnableSeen || {}), [manifest.id]: true },
      }
      await deps.writeCommunityPlugins(community)
    }

    await instance.onload()
    instances.set(manifest.id, instance)
    infos.set(manifest.id, {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      core,
      status: 'loaded',
      permissions: [...(manifest.permissions || [])],
    })
  }

  async function loadCore() {
    for (const { manifest, Factory } of CORE_REGISTRY) {
      const alwaysOn = ALWAYS_ON_CORE.has(manifest.id)
      if (!alwaysOn && !community.enabled.includes(manifest.id)) {
        infos.set(manifest.id, {
          id: manifest.id,
          name: manifest.name,
          version: manifest.version,
          core: true,
          status: 'disabled',
          permissions: [...(manifest.permissions || [])],
        })
        continue
      }
      if (safeMode) {
        // Safe Mode still allows core plugins.
      }
      try {
        await loadInstance(manifest, Factory, true)
      } catch (error) {
        infos.set(manifest.id, {
          id: manifest.id,
          name: manifest.name,
          version: manifest.version,
          core: true,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          permissions: [...(manifest.permissions || [])],
        })
        deps.onNotice?.(`核心插件 ${manifest.id} 加载失败`)
      }
    }
  }

  async function loadVaultPlugins() {
    const packages = await deps.listVaultPlugins()
    for (const pkg of packages.sort((a, b) => a.id.localeCompare(b.id))) {
      const { manifest } = pkg
      if (manifest.kind === 'theme') continue
      if (CORE_REGISTRY.some((c) => c.manifest.id === manifest.id)) continue

      if (safeMode) {
        infos.set(manifest.id, {
          id: manifest.id,
          name: manifest.name,
          version: manifest.version,
          core: false,
          status: 'skipped-safe-mode',
          permissions: [...(manifest.permissions || [])],
        })
        continue
      }

      if (!community.enabled.includes(manifest.id)) {
        infos.set(manifest.id, {
          id: manifest.id,
          name: manifest.name,
          version: manifest.version,
          core: false,
          status: 'disabled',
          permissions: [...(manifest.permissions || [])],
        })
        continue
      }

      try {
        if (!satisfiesMinAppVersion(manifest.minAppVersion, APP_VERSION)) {
          throw new Error(`需要应用版本 >= ${manifest.minAppVersion}`)
        }
        // Re-validate permissions (Phase 7 allows network:safe with allowlist; still forbids publish/fs:arbitrary).
        parseManifestJson(manifest)
        if (!pkg.mainSource) throw new Error('缺少 main.js')
        const Factory = loadCjsPluginClass(pkg.mainSource)
        await loadInstance(manifest, Factory, false)
      } catch (error) {
        infos.set(manifest.id, {
          id: manifest.id,
          name: manifest.name,
          version: manifest.version,
          core: false,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          permissions: [...(manifest.permissions || [])],
        })
        deps.onNotice?.(`插件 ${manifest.id} 已禁用: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  async function reload() {
    await unloadAll()
    infos.clear()
    commands.clear()
    ribbons.clear()
    settingTabs.clear()
    views.clear()
    editors.clear()
    community = await deps.readCommunityPlugins()
    await loadCore()
    await loadVaultPlugins()
  }

  return {
    async start() {
      safeMode = loadSafeMode()
      await reload()
    },
    async stop() {
      await unloadAll()
      infos.clear()
      commands.clear()
      ribbons.clear()
      settingTabs.clear()
      views.clear()
      editors.clear()
    },
    list() {
      return [...infos.values()].sort((a, b) => Number(b.core) - Number(a.core) || a.id.localeCompare(b.id))
    },
    listCommands() {
      return [...commands.values()]
    },
    listRibbons() {
      return [...ribbons.values()]
    },
    listSettingTabs() {
      return [...settingTabs.values()]
    },
    listViews() {
      return [...views.values()]
    },
    listEditorProviders() {
      return [...editors.values()].sort((a, b) => Number(b.id === V5_EDITOR_ID) - Number(a.id === V5_EDITOR_ID) || a.name.localeCompare(b.name))
    },
    getActiveEditor() {
      const stored = readStoredEditorId()
      return editors.get(stored) || editors.get(V5_EDITOR_ID) || [...editors.values()][0] || null
    },
    getActiveEditorId() {
      return this.getActiveEditor()?.id ?? V5_EDITOR_ID
    },
    setActiveEditor(id: string) {
      if (!editors.has(id)) throw new Error(`没有编辑器 ${id}`)
      storeEditorId(id)
    },
    isSafeMode() {
      return safeMode
    },
    async setSafeMode(enabled: boolean) {
      safeMode = enabled
      saveSafeMode(enabled)
      await reload()
      if (enabled) {
        deps.onNotice?.('安全模式：仅核心插件；主题回退内置')
      }
    },
    getEnabledIds() {
      return [...community.enabled]
    },
    async unload(pluginId: string) {
      await unloadOne(pluginId)
      infos.delete(pluginId)
    },
    async setEnabled(pluginId: string, enabled: boolean) {
      if (pluginId === V5_EDITOR_ID && !enabled) {
        deps.onNotice?.('默认编辑器不能禁用')
        return
      }
      const set = new Set(community.enabled)
      if (enabled) set.add(pluginId)
      else set.delete(pluginId)
      community = { ...community, enabled: [...set] }
      await deps.writeCommunityPlugins(community)
      await reload()
    },
    async enableCoreDefaults() {
      const set = new Set(community.enabled)
      for (const { manifest } of CORE_REGISTRY) {
        if (manifest.id === PLAIN_EDITOR_MANIFEST.id) continue
        set.add(manifest.id)
      }
      community = { ...community, enabled: [...set] }
      await deps.writeCommunityPlugins(community)
      await reload()
    },
    async installSampleHelloWorld(source) {
      // Discovery is caller's job (write files); here we just enable after parse check.
      const manifest = parseManifestJson(source.manifestJson)
      if (manifest.id !== 'hello-world') {
        throw new Error('示例插件 id 必须为 hello-world')
      }
      await this.setEnabled('hello-world', true)
    },
  }
}

export { CORE_REGISTRY, parseCommunityPlugins, emptyCommunityPlugins }
