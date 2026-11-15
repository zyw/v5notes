/**
 * Shared PluginHost + ThemeHost lifecycle for the open vault.
 * Tokens stay in account/session modules — never passed into hosts.
 */

import type {
  PluginHost,
  PluginRuntimeInfo,
  HostCommand,
  HostRibbon,
  HostSettingTab,
  HostView,
} from '../plugin-host'
import {
  createPluginHost,
  createVaultAdapter,
  createWorkspaceApi,
  listVaultPluginPackages,
  loadPluginDataFile,
  readCommunityPluginsFile,
  savePluginDataFile,
  saveSafeMode,
  writeCommunityPluginsFile,
  writeSamplePlugin,
} from '../plugin-host'
import type { ThemeHost } from '../theme-host'
import {
  createThemeHost,
  installForestInkSample,
  listVaultThemes,
  readAppearanceFile,
  writeAppearanceFile,
} from '../theme-host'
import { HELLO_WORLD_MAIN_JS, HELLO_WORLD_MANIFEST } from '../plugin-host/samples/helloWorld'
import { SAFE_FETCH_MAIN_JS, SAFE_FETCH_MANIFEST } from '../plugin-host/samples/safeFetch'
import { installCatalogItem, type CatalogItem } from '../catalog'

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

export async function startExtensionRuntime(rootPath: string): Promise<void> {
  await stopExtensionRuntime()
  activeRoot = rootPath

  themeHost = createThemeHost({
    readAppearanceFile: () => readAppearanceFile(rootPath),
    writeAppearanceFile: (prefs) => writeAppearanceFile(rootPath, prefs),
    listVaultThemes: () => listVaultThemes(rootPath),
    onNotice: (m) => noticeHandler(m),
    isSafeMode: () => pluginHost?.isSafeMode() ?? false,
  })

  const vault = createVaultAdapter(rootPath)
  const workspace = createWorkspaceApi({
    getActivePath: () => activeFileGetter(),
    openFile: openFileHandler,
    onNotice: (m) => noticeHandler(m),
  })

  pluginHost = createPluginHost({
    vault,
    workspace,
    theme: themeHost,
    readCommunityPlugins: () => readCommunityPluginsFile(rootPath),
    writeCommunityPlugins: (file) => writeCommunityPluginsFile(rootPath, file),
    loadPluginData: (id) => loadPluginDataFile(rootPath, id),
    savePluginData: (id, data) => savePluginDataFile(rootPath, id, data),
    listVaultPlugins: () => listVaultPluginPackages(rootPath),
    onNotice: (m) => noticeHandler(m),
  })

  await themeHost.start()
  // Enable core plugins on first open if nothing enabled yet.
  const community = await readCommunityPluginsFile(rootPath)
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

export async function ensureSampleExtensions(): Promise<void> {
  if (!activeRoot || !pluginHost || !themeHost) {
    throw new Error('请先打开 Vault')
  }
  await writeSamplePlugin(activeRoot, {
    id: 'hello-world',
    manifestJson: JSON.stringify(HELLO_WORLD_MANIFEST, null, 2),
    mainJs: HELLO_WORLD_MAIN_JS,
  })
  await writeSamplePlugin(activeRoot, {
    id: SAFE_FETCH_MANIFEST.id,
    manifestJson: JSON.stringify(SAFE_FETCH_MANIFEST, null, 2),
    mainJs: SAFE_FETCH_MAIN_JS,
  })
  await installForestInkSample(activeRoot)
  await pluginHost.setEnabled('hello-world', true)
  await pluginHost.setEnabled(SAFE_FETCH_MANIFEST.id, true)
  // Refresh theme discovery
  await themeHost.start()
}

/** Install from catalog into the open vault, then enable plugins / refresh themes. */
export async function installFromCatalog(item: CatalogItem): Promise<void> {
  if (!activeRoot || !pluginHost || !themeHost) {
    throw new Error('请先打开 Vault')
  }
  const result = await installCatalogItem(activeRoot, item)
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
