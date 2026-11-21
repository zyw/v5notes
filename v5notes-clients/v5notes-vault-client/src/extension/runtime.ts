/**
 * Shared PluginHost + ThemeHost lifecycle.
 *
 * Extensions are app-level: one installed set and one enabled set shared by
 * every vault. The vault only supplies what plugin code may read and write.
 * Tokens stay in account/session modules — never passed into hosts.
 */

import type {
  PluginHost,
  PluginRuntimeInfo,
  HostCommand,
  HostRibbon,
  HostSettingTab,
  HostView,
  HostEditorProvider,
  HostEditorKind,
} from '../plugin-host'
import {
  CORE_REGISTRY,
  createPluginHost,
  createVaultAdapter,
  createWorkspaceApi,
  saveSafeMode,
} from '../plugin-host'
import type { ThemeHost } from '../theme-host'
import { createThemeHost, readAppearanceFile, writeAppearanceFile } from '../theme-host'
import { installCatalogItem, installImportedPackage, type CatalogItem } from '../catalog'
import {
  forgetGlobalPlugin,
  listGlobalPluginPackages,
  readGlobalCommunityPlugins,
  removeGlobalPluginPackage,
  writeGlobalCommunityPlugins,
} from './globalPlugins'
import { listGlobalThemes, removeGlobalTheme } from './globalThemes'
import {
  readPluginData,
  removeVaultPluginData,
  writePluginData,
} from './pluginData'

let pluginHost: PluginHost | null = null
let themeHost: ThemeHost | null = null
let activeRoot: string | null = null
let noticeHandler: (message: string) => void = (m) => console.info('[vault]', m)
let activeFileGetter: () => string | null = () => null
let openFileHandler: ((path: string) => Promise<void>) | undefined

export function setExtensionNoticeHandler(handler: (message: string) => void) {
  noticeHandler = handler
}

export function setExtensionWorkspaceHandlers(options: {
  getActivePath: () => string | null
  openFile?: (path: string) => Promise<void>
}) {
  activeFileGetter = options.getActivePath
  openFileHandler = options.openFile
}

export function getThemeHost(): ThemeHost | null {
  return themeHost
}

export function getPluginHost(): PluginHost | null {
  return pluginHost
}

/** The vault plugin code currently reads and writes; null before one is opened. */
export function getExtensionRuntimeRoot(): string | null {
  return activeRoot
}

/**
 * Bind the already-running extension hosts to a vault.
 *
 * Extensions are app-level, so opening a new vault must not restart them or
 * drop what plugins already registered; only the data source changes.
 */
export function attachExtensionRuntimeVault(rootPath: string | null): void {
  activeRoot = rootPath
}

/**
 * Start the extension hosts. Extension code and enable state are app-level, so
 * this works before any vault is open; the vault is only the plugin data source.
 */
export async function startExtensionRuntime(rootPath: string | null): Promise<void> {
  await stopExtensionRuntime()
  activeRoot = rootPath
  const vaultRoot = rootPath

  themeHost = createThemeHost({
    // Theme choice and vault colour are per vault; installed themes are not.
    readAppearanceFile: vaultRoot ? () => readAppearanceFile(vaultRoot) : undefined,
    writeAppearanceFile: vaultRoot ? (prefs) => writeAppearanceFile(vaultRoot, prefs) : undefined,
    listInstalledThemes: () => listGlobalThemes(),
    onNotice: (m) => noticeHandler(m),
    isSafeMode: () => pluginHost?.isSafeMode() ?? false,
  })

  pluginHost = createPluginHost({
    // A vault that is not open yet answers empty reads instead of failing the host.
    vault: vaultRoot ? createVaultAdapter(vaultRoot) : createDetachedVaultAdapter(),
    workspace: createWorkspaceApi({
      getActivePath: () => activeFileGetter(),
      openFile: openFileHandler,
      onNotice: (m) => noticeHandler(m),
    }),
    theme: themeHost,
    readCommunityPlugins: () => readGlobalCommunityPlugins(),
    writeCommunityPlugins: (file) => writeGlobalCommunityPlugins(file),
    // Settings are layered: app-wide ones follow the app, vault ones follow the vault.
    loadPluginData: (scope, id) => readPluginData(scope, vaultRoot, id),
    savePluginData: (scope, id, data) => writePluginData(scope, vaultRoot, id, data),
    listVaultPlugins: () => listGlobalPluginPackages(),
    onNotice: (m) => noticeHandler(m),
  })

  await themeHost.start()
  // Enable core plugins if the app has never recorded a choice.
  const community = await readGlobalCommunityPlugins()
  if (community.enabled.length === 0) {
    await pluginHost.enableCoreDefaults()
  } else {
    await pluginHost.start()
  }

  // Safe Mode was on before start(): re-apply the current choice so the host
  // knows to skip community code. The theme itself (内置默认 / 暮色 / 明暗) stays.
  if (pluginHost.isSafeMode()) {
    await themeHost.setActive(themeHost.getActive())
  }
}

function createDetachedVaultAdapter(): ReturnType<typeof createVaultAdapter> {
  return {
    async list() {
      return []
    },
    async read() {
      throw new Error('打开库后可读写笔记')
    },
    async write() {
      throw new Error('打开库后可读写笔记')
    },
    async delete() {
      throw new Error('打开库后可读写笔记')
    },
    async rename() {
      throw new Error('打开库后可读写笔记')
    },
    async exists() {
      return false
    },
  }
}

export async function stopExtensionRuntime(): Promise<void> {
  if (pluginHost) {
    await pluginHost.stop()
    pluginHost = null
  }
  if (themeHost) {
    themeHost.stop()
    themeHost = null
  }
  activeRoot = null
}

export function listPluginInfos(): PluginRuntimeInfo[] {
  return pluginHost?.list() ?? []
}

export function listHostCommands(): HostCommand[] {
  return pluginHost?.listCommands() ?? []
}

export function listHostRibbons(): HostRibbon[] {
  return pluginHost?.listRibbons() ?? []
}

export function listHostSettingTabs(): HostSettingTab[] {
  return pluginHost?.listSettingTabs() ?? []
}

export function listHostViews(): HostView[] {
  return pluginHost?.listViews() ?? []
}

export function listEditorProviders(): HostEditorProvider[] {
  return pluginHost?.listEditorProviders() ?? []
}

export function getActiveEditorProvider(docKind?: string): HostEditorProvider | null {
  return pluginHost?.getActiveEditor(docKind) ?? null
}

/** One row per document kind backed by a loaded editor provider. */
export function listEditorKinds(): HostEditorKind[] {
  return pluginHost?.listEditorKinds() ?? []
}

/** Write an installed package, then enable a plugin or reload the theme host. */
async function activateInstalled(result: { id: string; kind: 'plugin' | 'theme' }): Promise<void> {
  if (!pluginHost || !themeHost) {
    throw new Error('扩展宿主尚未启动')
  }
  if (result.kind === 'plugin') {
    await pluginHost.setEnabled(result.id, true)
  } else {
    await themeHost.start()
  }
}

/** Install from catalog into the app, then enable plugins / refresh themes. */
export async function installFromCatalog(item: CatalogItem): Promise<void> {
  if (!pluginHost || !themeHost) {
    throw new Error('扩展宿主尚未启动')
  }
  await activateInstalled(await installCatalogItem(item))
}

/**
 * 安装本机导入的包：从 pending/ 复制到 plugins/ 或 themes/，再启用。
 * 与 catalog 安装走同一条落盘路径，只是包来自用户选的 zip。
 */
export async function installFromPending(id: string): Promise<void> {
  if (!pluginHost || !themeHost) {
    throw new Error('扩展宿主尚未启动')
  }
  await activateInstalled(await installImportedPackage(id))
}

/** Core plugins ship inside the app and have no folder to delete. */
export function isCorePluginId(id: string): boolean {
  return CORE_REGISTRY.some((entry) => entry.manifest.id === id)
}

/**
 * Remove an installed community plugin.
 *
 * Order matters: stop the code first, then delete the folder, then forget the
 * enable entry. If the folder step fails nothing else changes, so the plugin
 * keeps working; if only the bookkeeping fails the next start simply finds no
 * package and ignores the stale id.
 */
export async function uninstallPlugin(id: string, vaultRoot: string | null): Promise<void> {
  if (isCorePluginId(id)) {
    throw new Error('核心插件不能卸载')
  }
  if (!pluginHost) {
    throw new Error('扩展宿主尚未启动')
  }
  await pluginHost.unload(id)
  await removeGlobalPluginPackage(id)
  let bookkeepingError: string | null = null
  try {
    await forgetGlobalPlugin(id)
    if (vaultRoot) {
      await removeVaultPluginData(vaultRoot, id)
    }
  } catch (error) {
    bookkeepingError = error instanceof Error ? error.message : String(error)
  }
  await pluginHost.start()
  if (bookkeepingError) {
    throw new Error(`文件已删除，启用记录未清理：${bookkeepingError}`)
  }
}

/** Remove an installed community theme; falls back to the default when it was active. */
export async function uninstallTheme(id: string): Promise<void> {
  if (!themeHost) {
    throw new Error('扩展宿主尚未启动')
  }
  await removeGlobalTheme(id)
  await themeHost.start()
}

/**
 * Safe Mode blocks community plugins and community themes; it must not change
 * the user's builtin theme or 明暗. The host stops injecting community CSS while
 * the flag is on and re-applies the same theme choice when it goes off.
 */
export async function setSafeModeAndReload(enabled: boolean): Promise<void> {
  saveSafeMode(enabled)
  if (!pluginHost || !themeHost) {
    // Theme host is not running (no vault): still reflect the shell choice.
    const host = createThemeHost({ isSafeMode: () => enabled })
    await host.setActive(host.getActive())
    return
  }
  await pluginHost.setSafeMode(enabled)
  if (enabled) {
    await themeHost.setActive(themeHost.getActive())
  } else {
    await themeHost.start()
  }
}
