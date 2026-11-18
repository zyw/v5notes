import {
  Plugin,
  type App,
  type PluginCommand,
  type PluginManifest,
  type RibbonIconSpec,
  type SettingTabSpec,
  type ThemeApi,
  type VaultAdapter,
  type ViewSpec,
  type WorkspaceApi,
} from '@v5notes/vault-plugin-api'
import { assertPermission } from './permissions'
import { safeNetworkRequest } from './networkSafe'

export interface PluginHostHooks {
  vault: VaultAdapter
  workspace: WorkspaceApi
  theme: ThemeApi
  getEnabledIds: () => string[]
  isSafeMode: () => boolean
  /** Persist plugin data.json — never tokens. */
  loadData: (pluginId: string) => Promise<unknown>
  saveData: (pluginId: string, data: unknown) => Promise<void>
  /** Register command with host (namespaced). */
  registerCommand: (pluginId: string, command: PluginCommand) => void
  registerRibbon?: (pluginId: string, spec: RibbonIconSpec) => void
  registerSettingTab?: (pluginId: string, spec: SettingTabSpec) => void
  registerView?: (pluginId: string, spec: ViewSpec) => void
}

/**
 * Build a permission-proxied App for one plugin.
 * Account/Sync tokens must never appear on this object or its prototype chain.
 */
export function createPluginApi(hooks: PluginHostHooks, manifest: PluginManifest): App {
  const granted = manifest.permissions || []

  const vault: VaultAdapter = {
    async list(path) {
      assertPermission(granted, 'vault:read', '列出文件')
      return hooks.vault.list(path)
    },
    async read(path) {
      assertPermission(granted, 'vault:read', '读取文件')
      return hooks.vault.read(path)
    },
    async write(path, data) {
      assertPermission(granted, 'vault:write', '写入文件')
      return hooks.vault.write(path, data)
    },
    async delete(path) {
      assertPermission(granted, 'vault:write', '删除文件')
      return hooks.vault.delete(path)
    },
    async rename(from, to) {
      assertPermission(granted, 'vault:write', '重命名文件')
      return hooks.vault.rename(from, to)
    },
    async exists(path) {
      assertPermission(granted, 'vault:read', '检查文件')
      return hooks.vault.exists(path)
    },
  }

  const workspace: WorkspaceApi = {
    openNotice(message) {
      hooks.workspace.openNotice(message)
    },
    getActiveFile() {
      return hooks.workspace.getActiveFile()
    },
    async openFile(path) {
      if (hooks.workspace.openFile) await hooks.workspace.openFile(path)
    },
  }

  const app: App = {
    vault,
    workspace,
    theme: {
      list: () => hooks.theme.list(),
      getActive: () => hooks.theme.getActive(),
      setActive: async (id) => {
        assertPermission(granted, 'ui:theme', '切换主题')
        await hooks.theme.setActive(id)
      },
      getCssVariables: () => hooks.theme.getCssVariables(),
    },
    plugins: {
      getEnabledIds: () => hooks.getEnabledIds(),
      isSafeMode: () => hooks.isSafeMode(),
    },
  }

  if (granted.includes('network:safe')) {
    const allowlist = manifest.networkAllowlist || []
    app.network = {
      async request(url, options) {
        assertPermission(granted, 'network:safe', '发起网络请求')
        return safeNetworkRequest(url, allowlist, {
          method: options?.method,
          headers: options?.headers,
          body: options?.body,
        })
      },
    }
  }

  // Hardening: strip accidental token-like keys if a future caller mutates the object.
  for (const key of Object.keys(app) as (keyof App)[]) {
    Object.defineProperty(app, key, { enumerable: true, configurable: false, writable: false })
  }

  return app
}

export function attachDataMethods(
  instance: Plugin,
  hooks: PluginHostHooks,
  pluginId: string,
): void {
  instance.loadData = async <T = unknown>() => {
    const data = await hooks.loadData(pluginId)
    return (data as T) ?? null
  }
  instance.saveData = async (data: unknown) => {
    await hooks.saveData(pluginId, data)
  }

  const originalAdd = instance.addCommand.bind(instance)
  instance.addCommand = (command: PluginCommand) => {
    assertPermission(instance.manifest.permissions || [], 'ui:commands', '注册命令')
    originalAdd(command)
    hooks.registerCommand(pluginId, command)
  }

  const originalRibbon = instance.addRibbonIcon.bind(instance)
  instance.addRibbonIcon = (spec: RibbonIconSpec) => {
    assertPermission(instance.manifest.permissions || [], 'ui:ribbon', '注册 Ribbon')
    originalRibbon(spec)
    hooks.registerRibbon?.(pluginId, spec)
  }

  const originalTab = instance.addSettingTab.bind(instance)
  instance.addSettingTab = (spec: SettingTabSpec) => {
    assertPermission(instance.manifest.permissions || [], 'ui:settings', '注册设置页')
    originalTab(spec)
    hooks.registerSettingTab?.(pluginId, spec)
  }

  const originalView = instance.registerView.bind(instance)
  instance.registerView = (spec: ViewSpec) => {
    assertPermission(instance.manifest.permissions || [], 'ui:views', '注册视图')
    originalView(spec)
    hooks.registerView?.(pluginId, spec)
  }
}

/** Unit-test helper: ensure no token-shaped keys are enumerable on App. */
export function assertNoTokenLeak(app: App): void {
  const blob = JSON.stringify(app)
  const forbidden = [/token/i, /accessToken/i, /refreshToken/i, /authorization/i, /bearer/i]
  for (const re of forbidden) {
    if (re.test(blob)) {
      throw new Error(`插件 App 对象疑似泄漏凭证字段 (${re})`)
    }
  }
  const walk = (obj: object, depth: number) => {
    if (depth > 4) return
    for (const key of Reflect.ownKeys(obj)) {
      const name = String(key)
      if (/token|password|secret|authorization/i.test(name)) {
        throw new Error(`插件 App 含敏感键: ${name}`)
      }
      try {
        const val = (obj as Record<PropertyKey, unknown>)[key as keyof typeof obj]
        if (val && typeof val === 'object') walk(val as object, depth + 1)
      } catch {
        /* ignore */
      }
    }
  }
  walk(app, 0)
}
