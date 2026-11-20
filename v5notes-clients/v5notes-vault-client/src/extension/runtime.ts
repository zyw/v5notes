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
} from '../plugin-host'
import {
  createPluginHost,
  createVaultAdapter,
  createWorkspaceApi,
  saveSafeMode,
} from '../plugin-host'
import type { ThemeHost } from '../theme-host'
import { createThemeHost, readAppearanceFile, writeAppearanceFile } from '../theme-host'
import { HELLO_WORLD_MAIN_JS, HELLO_WORLD_MANIFEST } from '../plugin-host/samples/helloWorld'
import { SAFE_FETCH_MAIN_JS, SAFE_FETCH_MANIFEST } from '../plugin-host/samples/safeFetch'
import { installCatalogItem, type CatalogItem } from '../catalog'
import {
  listGlobalPluginPackages,
  readGlobalCommunityPlugins,
  writeGlobalCommunityPlugins,
  writeGlobalPluginPackage,
} from './globalPlugins'
import { installGlobalForestInkSample, listGlobalThemes } from './globalThemes'
import { readPluginData, writePluginData } from './pluginData'

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

  // If Safe Mode flipped theme, re-apply.
  if (pluginHost.isSafeMode()) {
    await themeHost.setActive('default')
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

export function getActiveEditorProvider(): HostEditorProvider | null {
  return pluginHost?.getActiveEditor() ?? null
}

/** The sample extension the settings button installs. */
export const SAMPLE_EXTENSION_ID = 'hello-world'

/** Samples install into the app, not into a vault, so no vault is needed. */
export async function ensureSampleExtensions(): Promise<void> {
  await writeGlobalPluginPackage({
    id: SAMPLE_EXTENSION_ID,
    manifestJson: JSON.stringify(HELLO_WORLD_MANIFEST, null, 2),
    mainJs: HELLO_WORLD_MAIN_JS,
  })
  await writeGlobalPluginPackage({
    id: SAFE_FETCH_MANIFEST.id,
    manifestJson: JSON.stringify(SAFE_FETCH_MANIFEST, null, 2),
    mainJs: SAFE_FETCH_MAIN_JS,
  })
  await installGlobalForestInkSample()
  if (!pluginHost || !themeHost) return
  await pluginHost.setEnabled(SAMPLE_EXTENSION_ID, true)
  await pluginHost.setEnabled(SAFE_FETCH_MANIFEST.id, true)
  // Refresh theme discovery
  await themeHost.start()
}

/** Install from catalog into the app, then enable plugins / refresh themes. */
export async function installFromCatalog(item: CatalogItem): Promise<void> {
  if (!pluginHost || !themeHost) {
    throw new Error('扩展宿主尚未启动')
  }
  const result = await installCatalogItem(item)
  if (result.kind === 'plugin') {
    await pluginHost.setEnabled(result.id, true)
  } else {
    await themeHost.start()
  }
}

export async function setSafeModeAndReload(enabled: boolean): Promise<void> {
  if (!pluginHost || !themeHost) {
    // Still persist preference without vault.
    saveSafeMode(enabled)
    if (enabled) {
      const host = createThemeHost({ isSafeMode: () => true })
      await host.setActive('default')
    }
    return
  }
  await pluginHost.setSafeMode(enabled)
  if (enabled) {
    await themeHost.setActive('default')
  } else {
    await themeHost.start()
  }
}
