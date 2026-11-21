<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import AccountPanel from '../components/AccountPanel.vue'
import brandIcon from '../assets/brand-icon.png'
import type { AccountState } from '../account'
import type { SyncCoordinatorHandles } from '../sync'
import {
  applyAppearance,
  BUILTIN_THEMES,
  loadAppearancePrefs,
  saveAppearancePrefs,
  type AppearancePrefs,
  type ColorMode,
} from '../appearance/themes'
import {
  VAULT_COLOR_PALETTE,
  applyVaultColorForPath,
  resolveVaultColor,
  setVaultColor,
  setVaultColorFromVault,
  type VaultColorSwatch,
} from '../appearance/vaultColors'
import { readAppearanceFile, updateAppearanceFile } from '../theme-host'
import { BUNDLED_THEMES } from '../theme-host/samples/bundled'
import { stripCssComments } from '../theme-host/cssValidate'
import TOKENS_CSS from '../styles/tokens.css?raw'
import type { OpenedVault } from '../vault/types'
import type { ThemeInfo } from '@v5notes/vault-plugin-api'
import type { HostEditorKind, HostSettingTab, PluginRuntimeInfo } from '../plugin-host'
import { docKindById } from '../vault/docKinds'
import { loadSafeMode } from '../plugin-host/safeMode'
import { importExtensionZip, listImportedExtensions, removeImportedExtension } from '../catalog'
import { open } from '@tauri-apps/plugin-dialog'
import {
  getPluginHost,
  getThemeHost,
  installFromCatalog,
  installFromPending,
  uninstallPlugin,
  uninstallTheme,
  listDocKinds,
  listHostSettingTabs,
  listPluginInfos,
  setSafeModeAndReload,
  startExtensionRuntime,
} from '../extension/runtime'
import {
  buildSettingsVaultRows,
  decideRuntimeBoot,
  resolveInitialScope,
  type SettingsScope,
} from './settingsRuntime'
import { hydrateVaultRegistry, listVaultRegistry, removeRecentVault, unregisterVault } from '../vault/recent'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { vaultWorkspace } from '../vault/workspace'
import { fetchCatalogList, type CatalogItem } from '../catalog'
import {
  MIGRATION_EXPLICIT_LINE,
  MIGRATION_STEPS_HELP,
  backupVaultToZip,
} from '../backup'
import {
  assertOfficialPublishChannel,
  loadOfficialPublishDraft,
  saveOfficialPublishDraft,
  type OfficialPublishDraft,
  type OfficialPublishVisibility,
} from '../publish'

const props = defineProps<{
  account: AccountState
  vault?: OpenedVault | null
  sync?: SyncCoordinatorHandles
  currentVersion?: string
  updateChecking?: boolean
  offeredVersion?: string | null
  releaseNotesAvailable?: boolean
}>()

const emit = defineEmits<{
  'check-update': []
  'show-release-notes': []
  /** Requests the vault picker; the shell owns opening a vault. */
  'open-vault': []
  /** Asks the shell to make this vault the open one. */
  'switch-vault': [rootPath: string]
  /** The vault record was removed; the shell decides what to show next. */
  'delete-vault': [rootPath: string]
  /** Requests the 所有库 registry panel; the shell owns opening a vault. */
  'open-registry': []
}>()

const prefs = ref<AppearancePrefs>(loadAppearancePrefs())
const safeMode = ref(loadSafeMode())
const themes = ref<ThemeInfo[]>([])
const plugins = ref<PluginRuntimeInfo[]>([])
/** One row per document kind: its active editor and the providers it may swap to. */
const editorKinds = ref<HostEditorKind[]>([])
const settingTabs = ref<HostSettingTab[]>([])
const catalogItems = ref<CatalogItem[]>([])
/** 卸载确认：只记录目标，真正删除在确认后。 */
const uninstallPluginTarget = ref<PluginRuntimeInfo | null>(null)
const uninstallThemeTarget = ref<ThemeInfo | null>(null)
const uninstallBusy = ref(false)
/** 本机导入、还没安装的扩展包；它们排在同一张列表的最前面。 */
const importedItems = ref<CatalogItem[]>([])
const catalogSource = ref<'server' | 'bundled' | ''>('')
const catalogBusy = ref(false)
const extensionBusy = ref(false)
/** Errors land in the panel where the user acted, never in a distant status line. */
const pluginMessage = ref('')
const catalogMessage = ref('')
const themeError = ref<string | null>(null)
const pluginTabHosts: Ref<Record<string, HTMLElement | null>> = ref({})
const backupBusy = ref(false)
const backupResult = ref('')
const backupError = ref('')
/** Guide opens in place once acknowledged; no separate confirmation round-trip. */
const migrationOpen = ref(false)
const publishDraft = ref<OfficialPublishDraft>(loadOfficialPublishDraft(props.vault?.rootPath))
const publishSaved = ref(false)
const publishError = ref('')


/** 版本号来自壳；浏览器预览没有壳，退回打包时的版本。 */
const versionLabel = computed(() => props.currentVersion || '2.1.0')

/**
 * 全局与库分开：库设置只针对当前打开的库，没有一个打开的库就不出现这一区。
 * 页面本身记住用户停在哪一区，回到设置时接着看。
 */
const scope = ref<SettingsScope>(resolveInitialScope(Boolean(props.vault?.rootPath)))
const registryRows = ref<
  { rootPath: string; name: string; updatedAt?: number | null; registeredAt?: string }[]
>([])
const activeVaultRow = computed(() => {
  const path = props.vault?.rootPath
  if (!path) return null
  return { rootPath: path, name: props.vault?.name || path }
})

/**
 * 列表顺序是一次快照：进入设置时排好，之后只看「谁是当前库」把标记挪过去。
 * 不能把当前库从数组里摘出来再拼到末尾——那样每点一个库，它都会跳到最前面。
 */
const orderedVaults = ref<{ rootPath: string; name: string }[]>([])
const vaultRows = computed(() =>
  buildSettingsVaultRows(orderedVaults.value, activeVaultRow.value),
)

const publishOptions: { id: OfficialPublishVisibility; label: string }[] = [
  { id: 'private', label: '私有' },
  { id: 'unlisted', label: '不公开链接' },
  { id: 'public', label: '公开' },
]

/**
 * 库色只属于当前库；没有库时为 null。
 * 它以库内文件为准，读盘是异步的，所以这里必须是显式状态：
 * 读盘和写入后都要同步更新，否则选中描边和读数不会跟着变。
 */
const vaultSwatch = ref<VaultColorSwatch | null>(null)
const colorError = ref('')

async function loadVaultColor(path: string | null | undefined): Promise<void> {
  if (!path) {
    vaultSwatch.value = null
    return
  }
  try {
    const stored = (await readAppearanceFile(path))?.vaultColor
    if (path !== props.vault?.rootPath) return
    setVaultColorFromVault(stored, path)
  } catch {
    /* 读不到就用本机回退 */
  }
  vaultSwatch.value = resolveVaultColor(path)
}
void loadVaultColor(props.vault?.rootPath)

/**
 * 库列表的色条按「每个库自己的库色」画，所以每个库都要读一次库内文件。
 * 读完把结果记进 vaultColors 的按库缓存，再戳一下版本号让模板重算。
 */
const colorRowVersion = ref(0)

async function loadListedVaultColors(paths: string[]): Promise<void> {
  await Promise.all(
    paths.map(async (path) => {
      try {
        const stored = (await readAppearanceFile(path))?.vaultColor
        setVaultColorFromVault(stored, path)
      } catch {
        /* 读不到就用本机回退 */
      }
    }),
  )
  colorRowVersion.value += 1
}

/** Sidebar stripes read this so a color change or a fresh disk read repaints them. */
function rowColor(path: string): string {
  void colorRowVersion.value
  return resolveVaultColor(path).color
}

function showScope(next: SettingsScope): void {
  scope.value = next
}

/**
 * 每次打开设置时按「库内容最近修改」排一次序；进入后顺序固定，
 * 看设置不等于改库，列表不能在眼前跳动。
 */
const rowsOrdered = ref(false)

onMounted(() => {
  // 重新进入设置时再算一次先后，所以每次都要重置。
  rowsOrdered.value = false
})

async function hydrateRows(): Promise<void> {
  let entries: { rootPath: string; name: string; openedAt?: string }[]
  try {
    entries = await hydrateVaultRegistry()
  } catch {
    entries = listVaultRegistry()
  }
  registryRows.value = entries.map((entry) => ({
    rootPath: entry.rootPath,
    name: entry.name,
    registeredAt: entry.openedAt,
  }))
  if (rowsOrdered.value) {
    // 顺序已定：只更新名字，不重排。
    orderedVaults.value = orderedVaults.value.map((row) => {
      const fresh = entries.find((entry) => entry.rootPath === row.rootPath)
      return fresh && fresh.name !== row.name ? { ...row, name: fresh.name } : row
    })
    void loadListedVaultColors(orderedVaults.value.map((row) => row.rootPath))
    return
  }

  const withModified = await Promise.all(
    entries.map(async (entry) => {
      let updatedAt: number | null = null
      try {
        updatedAt = await vaultWorkspace.lastNoteChange(entry.rootPath)
      } catch {
        updatedAt = null
      }
      return { rootPath: entry.rootPath, name: entry.name, registeredAt: entry.openedAt, updatedAt }
    }),
  )
  registryRows.value = withModified
  // 快照：此后不再随当前库变化。
  orderedVaults.value = buildSettingsVaultRows(withModified, null).map(({ rootPath, name }) => ({
    rootPath,
    name,
  }))
  rowsOrdered.value = true
  void loadListedVaultColors(orderedVaults.value.map((row) => row.rootPath))
}

/**
 * 库列表里点一个库 = 把它打开；打开后设置自动停在这个库的页面。
 * 外壳负责真正打开（校验目录、注册最近库），这里只负责请求与忙碌态。
 */
/** 全局区默认展开；收起与否只看用户自己点了什么。 */
const globalOpen = ref(true)

const switchingTo = ref<string | null>(null)
const switchError = ref('')

let switchTimer: ReturnType<typeof setTimeout> | null = null

function stopSwitchTimer(): void {
  if (switchTimer) clearTimeout(switchTimer)
  switchTimer = null
}

function activateVault(row: { rootPath: string; active: boolean; missing?: boolean }) {
  if (row.missing) return
  if (row.active) {
    showScope('vault')
    return
  }
  switchError.value = ''
  switchingTo.value = row.rootPath
  emit('switch-vault', row.rootPath)
  // 外壳一定会回话（成功时库变化、失败时 reportSwitchFailure）；
  // 万一两者都没来，也不能让列表永远锁在忙碌态。
  stopSwitchTimer()
  switchTimer = setTimeout(() => {
    switchingTo.value = null
  }, 15000)
}

onBeforeUnmount(stopSwitchTimer)

function clearSwitching(): void {
  stopSwitchTimer()
  switchingTo.value = null
}

/** 外壳打开失败时把错误摆在列表里，不让点击看起来像没反应。 */
function reportSwitchFailure(message: string): void {
  stopSwitchTimer()
  switchingTo.value = null
  switchError.value = message
}

defineExpose({ clearSwitching, reportSwitchFailure })

/**
 * 删除库 = 从这台机器上删掉这条库记录，不碰磁盘上的笔记。
 * 不可逆的是「记录」，所以要说清楚，并给一次确认。
 */
const deleteOpen = ref(false)
const deleteBusy = ref(false)
const deleteError = ref('')

function askDeleteVault(): void {
  deleteError.value = ''
  deleteOpen.value = true
}

function confirmDeleteVault(): void {
  const path = props.vault?.rootPath
  if (!path) {
    deleteOpen.value = false
    return
  }
  deleteBusy.value = true
  try {
    unregisterVault(path)
    removeRecentVault(path)
    // 列表离开这个库；外壳负责把工作区从它上面摘下来。
    orderedVaults.value = orderedVaults.value.filter((row) => row.rootPath !== path)
    deleteOpen.value = false
    emit('delete-vault', path)
  } catch (error) {
    deleteError.value = error instanceof Error ? error.message : String(error)
  } finally {
    deleteBusy.value = false
  }
}

/** 设置里只改当前库；没有打开的库时从这里去挑一个。 */
function requestVault() {
  emit('open-vault')
}
function requestRegistry() {
  emit('open-registry')
}

/** 一个按钮说清现状：空闲是「检查更新」，查到新版本就变成「可更新至 x.y.z」。 */
const updateAction = computed(() => {
  if (props.updateChecking) return { label: '正在检查…' }
  if (props.offeredVersion) return { label: '可更新至 ' + props.offeredVersion }
  return { label: '检查更新' }
})

const colorModes: { id: ColorMode; label: string }[] = [
  { id: 'system', label: '跟随系统' },
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' },
]

/** Header state line: what the two controls below currently resolve to. */
const activeThemeLabel = computed(() => {
  const theme = themes.value.find((t) => t.id === prefs.value.theme)
  return theme ? themeLabel(theme) : '默认'
})
const activeColorModeLabel = computed(
  () => colorModes.find((m) => m.id === prefs.value.colorMode)?.label ?? '跟随系统',
)

/** 已渲染过内容的 tab：key → 当时写入的宿主节点，用节点身份挡住重复渲染。 */
const renderedTabs = new Map<string, HTMLElement>()

function setPluginTabHost(pluginId: string, tabId: string, el: unknown): void {
  const key = pluginId + ':' + tabId
  const node = (el as HTMLElement | null) ?? null
  pluginTabHosts.value[key] = node
  const tab = settingTabs.value.find((t) => t.pluginId === pluginId && t.id === tabId)
  if (!node) {
    // 插件被禁用或卸载后 tab 已不在注册表里，连同渲染标记一起清掉。
    if (!tab) renderedTabs.delete(key)
    return
  }
  if (!tab || renderedTabs.get(key) === node) return
  renderedTabs.set(key, node)
  tab.display(node)
}

/** An empty plugin list means different things before and after the host starts. */
const hostReady = ref(false)

/**
 * Row state is a dot + one word. Raw status ids ('skipped-safe-mode') were noise
 * next to the name; the dot carries enabled/disabled/failed at a glance.
 */
function pluginStatus(plugin: PluginRuntimeInfo): { label: string; tone: string } {
  if (plugin.status === 'loaded') return { label: '已启用', tone: 'on' }
  if (plugin.status === 'failed') return { label: '加载失败', tone: 'off' }
  if (plugin.status === 'skipped-safe-mode') return { label: '安全模式跳过', tone: 'off' }
  return { label: '已停用', tone: 'off' }
}

function permissionSummary(plugin: PluginRuntimeInfo): string {
  return plugin.permissions.length ? plugin.permissions.join(' · ') : '无'
}

function pickVaultColor(id: string) {
  const path = props.vault?.rootPath
  if (!path) return
  // 先套到窗口上再落盘：两个函数都会同步 --vault，选完立刻可见。
  applyVaultColorForPath(path)
  vaultSwatch.value = setVaultColor(path, id)
  // 列表里这个库的色条跟着走：setVaultColor 已按库记下，这里只需让模板重算。
  colorRowVersion.value += 1
  // 库色跟着库走：写进库内的 .v5notes/appearance.json，换台机器打开仍是这个颜色。
  void updateAppearanceFile(path, { vaultColor: vaultSwatch.value.id }).catch((error) => {
    colorError.value = error instanceof Error ? error.message : String(error)
  })
}

/**
 * 主题列表顺序：内置（默认 / 暮色）→ 随应用内置的示例 → 用户安装的。
 * 安装的排在最后，因为它们才是会变、会卸载的那一组。
 */
const THEME_SOURCE_ORDER: Record<ThemeInfo['source'], number> = { builtin: 0, core: 1, vault: 2 }

function sortThemes(list: ThemeInfo[]): ThemeInfo[] {
  return [...list].sort(
    (a, b) => (THEME_SOURCE_ORDER[a.source] ?? 9) - (THEME_SOURCE_ORDER[b.source] ?? 9),
  )
}

function refreshExtensionState() {
  const th = getThemeHost()
  if (th) {
    prefs.value = th.getPrefs()
    themes.value = sortThemes(th.list())
    themeError.value = th.getLastError()
  } else {
    prefs.value = loadAppearancePrefs()
    themes.value = BUILTIN_THEMES.map((t) => ({
      id: t.id,
      name: t.label,
      description: t.description,
      builtin: true,
      source: 'builtin' as const,
    }))
    themeError.value = null
  }
  const host = getPluginHost()
  plugins.value = listPluginInfos()
  hostReady.value = host !== null
  editorKinds.value = host?.listEditorKinds() ?? []
  settingTabs.value = listHostSettingTabs()
  safeMode.value = getPluginHost()?.isSafeMode() ?? loadSafeMode()
}

/** 导入的待装包排在前面；同 id 已在待装区时以 pending 那份为准。 */
const catalogRows = computed<CatalogItem[]>(() => {
  const imported = new Set(importedItems.value.map((i) => i.id))
  return [...importedItems.value, ...catalogItems.value.filter((i) => !imported.has(i.id))]
})

function isPendingImport(item: CatalogItem): boolean {
  return importedItems.value.some((i) => i.id === item.id)
}

/**
 * 本条的安装状态：按它自己的 id 去真实的已装插件 / 主题列表里查。
 * 以前用一份被整张列表共享的 id 数组来判断，装一条就可能连带影响其它行。
 */
function isCatalogInstalled(item: CatalogItem): boolean {
  if (!item.id) return false
  if (item.kind === 'plugin') return plugins.value.some((p) => p.id === item.id)
  // 只有用户装到磁盘上的主题才可卸载；内置示例本来就在，不算这条装过。
  return themes.value.some((t) => t.id === item.id && t.source === 'vault')
}

/**
 * 目录行的按钮：未装只有「安装」，装好后按钮消失（不再提供行内卸载）。
 * 卸载仍走各自的既有入口：主题卡的删除、已安装扩展里的插件卸载。
 * 导入的待装包保持原行为：始终只有「安装」，装完从待装区消失。
 */
function catalogAction(item: CatalogItem): 'install' | 'none' {
  if (isPendingImport(item)) return 'install'
  return isCatalogInstalled(item) ? 'none' : 'install'
}

async function loadCatalog() {
  catalogBusy.value = true
  try {
    const [catalog, pending] = await Promise.all([fetchCatalogList(), listImportedExtensions()])
    catalogItems.value = catalog.list.items
    catalogSource.value = catalog.source
    importedItems.value = pending
  } catch (error) {
    catalogMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    catalogBusy.value = false
  }
}

/** 「安装」：本机导入的从 pending 装，种子/服务器的走 catalog。 */
/** 卸载：核心插件拿不到入口，这里再挡一次。 */
async function confirmUninstallPlugin() {
  const target = uninstallPluginTarget.value
  if (!target) return
  uninstallBusy.value = true
  pluginMessage.value = ''
  try {
    await uninstallPlugin(target.id, props.vault?.rootPath ?? null)
    uninstallPluginTarget.value = null
    refreshExtensionState()
  } catch (error) {
    uninstallPluginTarget.value = null
    pluginMessage.value = error instanceof Error ? error.message : String(error)
    // 不管成败都重新对一次真实状态：文件可能已经删掉。
    refreshExtensionState()
  } finally {
    uninstallBusy.value = false
  }
}

async function confirmUninstallTheme() {
  const target = uninstallThemeTarget.value
  if (!target) return
  uninstallBusy.value = true
  themeError.value = null
  try {
    await uninstallTheme(target.id)
    uninstallThemeTarget.value = null
    refreshExtensionState()
  } catch (error) {
    uninstallThemeTarget.value = null
    themeError.value = error instanceof Error ? error.message : String(error)
    refreshExtensionState()
  } finally {
    uninstallBusy.value = false
  }
}

async function installCatalog(item: CatalogItem) {
  extensionBusy.value = true
  catalogMessage.value = ''
  try {
    if (importedItems.value.some((i) => i.id === item.id)) {
      await installFromPending(item.id)
      importedItems.value = importedItems.value.filter((i) => i.id !== item.id)
    } else {
      await installFromCatalog(item)
    }
    refreshExtensionState()
    // 装好后这一行的按钮切到「卸载」，与其它行无关。
    catalogMessage.value = `已安装 ${item.name}`
  } catch (error) {
    catalogMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    extensionBusy.value = false
  }
}

/** 选择一个 zip 放进待装列表；此时还没有装进「插件与安全」。 */
async function importExtensionZipFile() {
  extensionBusy.value = true
  catalogMessage.value = ''
  try {
    const picked = await open({ multiple: false, directory: false, title: '导入扩展包', filters: [{ name: '扩展包', extensions: ['zip'] }] })
    if (!picked || Array.isArray(picked)) return
    const item = await importExtensionZip(picked)
    importedItems.value = [...importedItems.value.filter((i) => i.id !== item.id), item]
    catalogMessage.value = `已导入 ${item.name}`
  } catch (error) {
    catalogMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    extensionBusy.value = false
  }
}

/** 把导入错了的包移出列表；不影响已安装的扩展。 */
async function discardImported(item: CatalogItem) {
  extensionBusy.value = true
  catalogMessage.value = ''
  try {
    await removeImportedExtension(item.id)
    importedItems.value = importedItems.value.filter((i) => i.id !== item.id)
    catalogMessage.value = `已移出 ${item.name}`
  } catch (error) {
    catalogMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    extensionBusy.value = false
  }
}

async function commitLocal(next: AppearancePrefs) {
  prefs.value = next
  saveAppearancePrefs(next)
  applyAppearance(next)
}

/**
 * Theme card previews: each card shows its own palette instead of the colours
 * currently on screen. Without this every card looked the same, and switching
 * 明暗 gave no feedback about what a theme would look like in the dark.
 */
const PREVIEW_BUILTIN_THEMES: Record<string, string> = { default: TOKENS_CSS, dusk: TOKENS_CSS }

/**
 * 随应用内置的主题（林墨 / 晚晴 / Catalog Moss）以包为单位：名字、说明和
 * 预览用的 CSS 都从这里取，避免再按 id 硬编码一份。
 */
const BUNDLED_THEME_BY_ID = new Map(BUNDLED_THEMES.map((theme) => [theme.id, theme]))

/**
 * 只有用户安装的主题（extensions/themes/ 里、且不是内置）才能卸载。
 * builtin（默认 / 暮色）与内置主题随应用提供，不给卸载入口；内置主题即使
 * 磁盘上还留着旧目录，ThemeHost 也会把它归到 core 而不是 vault。
 */
function isRemovableTheme(theme: ThemeInfo): boolean {
  return !theme.builtin && theme.source === 'vault'
}

function themeLabel(theme: ThemeInfo): string {
  return BUNDLED_THEME_BY_ID.get(theme.id)?.name ?? theme.name
}

function themeDescription(theme: ThemeInfo): string | undefined {
  return BUNDLED_THEME_BY_ID.get(theme.id)?.description ?? theme.description
}

function parseCssTokens(css: string, selector: string): Record<string, string> {
  const re = new RegExp(
    selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}',
  )
  const block = re.exec(stripCssComments(css))?.[1] ?? ''
  const out: Record<string, string> = {}
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim()
  return out
}

function builtinPalette(themeId: string, dark: boolean): Record<string, string> {
  // tokens.css spells light as "[data-color-mode='light'], :not([data-color-mode])";
  // the light block also carries the theme's shared fonts and radii.
  const light = parseCssTokens(TOKENS_CSS, `:root[data-theme='${themeId}'][data-color-mode='light']`)
  const darkBlock = parseCssTokens(TOKENS_CSS, `:root[data-theme='${themeId}'][data-color-mode='dark']`)
  if (!dark) return Object.keys(light).length ? light : darkBlock
  return { ...(Object.keys(light).length ? light : darkBlock), ...darkBlock }
}

function previewPalette(themeId: string, dark: boolean): Record<string, string> {
  if (PREVIEW_BUILTIN_THEMES[themeId]) return builtinPalette(themeId, dark)
  const css = BUNDLED_THEME_BY_ID.get(themeId)?.css
  if (!css) return builtinPalette('default', dark)
  const scoped = `:root[data-community-theme='${themeId}']`
  const base = parseCssTokens(css, scoped)
  if (!dark) return base
  // A sample's dark palette lives under the same scope plus [data-color-mode='dark'].
  return { ...base, ...parseCssTokens(css, `${scoped}[data-color-mode='dark']`) }
}

/** Preview follows the resolved appearance, so toggling 深色 updates every card. */
const previewDark = computed(() => {
  if (prefs.value.colorMode === 'dark') return true
  if (prefs.value.colorMode === 'light') return false
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches)
})

function themePreviewStyle(themeId: string): Record<string, string> {
  const p = previewPalette(themeId, previewDark.value)
  return {
    '--pv-bg': p['--bg'] ?? '#f3efe4',
    '--pv-panel': p['--panel'] ?? '#fbf7ee',
    '--pv-line': p['--line'] ?? '#d8d0c4',
    '--pv-accent': p['--accent'] ?? '#2f5b48',
    '--pv-surface': p['--surface'] ?? '#ebe4d4',
  }
}

async function setTheme(themeId: string) {
  themeError.value = null
  const th = getThemeHost()
  if (th) {
    await th.setActive(themeId)
    refreshExtensionState()
    return
  }
  await commitLocal({ ...prefs.value, theme: themeId })
}

async function setColorMode(colorMode: ColorMode) {
  const th = getThemeHost()
  if (th) {
    await th.setColorMode(colorMode)
    refreshExtensionState()
    return
  }
  await commitLocal({ ...prefs.value, colorMode })
}

async function toggleSafeMode() {
  extensionBusy.value = true
  pluginMessage.value = ''
  try {
    const next = !safeMode.value
    await setSafeModeAndReload(next)
    refreshExtensionState()
  } catch (error) {
    pluginMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    extensionBusy.value = false
  }
}

function editorKindLabel(docKind: string): string {
  return listDocKinds().find(kind => kind.id === docKind)?.label ?? docKindById(docKind)?.label ?? docKind
}

async function chooseEditor(id: string) {
  const host = getPluginHost()
  if (!host) {
    pluginMessage.value = '请先打开 Vault'
    return
  }
  extensionBusy.value = true
  try {
    host.setActiveEditor(id)
    refreshExtensionState()
  } catch (error) {
    pluginMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    extensionBusy.value = false
  }
}

async function togglePlugin(id: string, enabled: boolean) {
  const host = getPluginHost()
  if (!host) {
    pluginMessage.value = '请先打开 Vault'
    return
  }
  extensionBusy.value = true
  try {
    await host.setEnabled(id, enabled)
    refreshExtensionState()
  } catch (error) {
    pluginMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    extensionBusy.value = false
  }
}

async function runBackup() {
  if (!props.vault?.rootPath) {
    backupError.value = '请先打开 Vault'
    return
  }
  backupBusy.value = true
  backupError.value = ''
  backupResult.value = ''
  try {
    const result = await backupVaultToZip(props.vault.rootPath, {
      vaultName: props.vault.name,
    })
    if (result) {
      backupResult.value = `已保存 ${result.fileCount} 个文件 · ${Math.round(result.bytes / 1024)} KiB · ${result.savedPath}`
    }
  } catch (error) {
    backupError.value = error instanceof Error ? error.message : String(error)
  } finally {
    backupBusy.value = false
  }
}

/** The guide expands under the row that opens it; consequence stays visible while it does. */
function toggleMigrationGuide() {
  migrationOpen.value = !migrationOpen.value
}

function setPublishVisibility(visibility: OfficialPublishVisibility) {
  publishDraft.value = { ...publishDraft.value, visibility }
  publishSaved.value = false
}

function onPublishTitleInput() {
  publishSaved.value = false
}

function savePublishDraft() {
  publishError.value = ''
  try {
    assertOfficialPublishChannel(publishDraft.value.channel)
    publishDraft.value = saveOfficialPublishDraft(props.vault?.rootPath, publishDraft.value)
    publishSaved.value = true
  } catch (error) {
    publishError.value = error instanceof Error ? error.message : String(error)
  }
}

async function ensureExtensionRuntime(): Promise<void> {
  // Extensions are app-level: installed add-ons and their on/off state are the
  // same in every vault, and settings must list them before a vault is open.
  const decision = decideRuntimeBoot({ hostPresent: getPluginHost() !== null })
  if (decision === 'reuse') return
  extensionBusy.value = true
  try {
    await startExtensionRuntime(props.vault?.rootPath ?? null)
  } catch (error) {
    pluginMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    extensionBusy.value = false
  }
}

onMounted(async () => {
  await hydrateRows()
  await ensureExtensionRuntime()
  refreshExtensionState()
  void loadCatalog()
})
watch(
  () => props.vault?.rootPath,
  async (path) => {
    // A vault section without a vault would be a guess; follow the page that exists.
    if (path) scope.value = 'vault'
    else if (scope.value === 'vault') scope.value = 'global'
    await ensureExtensionRuntime()
    refreshExtensionState()
    // 只刷新名字等元数据；顺序已经在进入设置时定住了。
    await hydrateRows()
    // 换库完成：列表退出忙碌态，错误清空。
    stopSwitchTimer()
    switchingTo.value = null
    switchError.value = ''
    // Vault colour belongs to the vault too; its file may name a colour the
    // local fallback did not know about.
    colorError.value = ''
    await loadVaultColor(path)
    // Drafts belong to a vault: opening another one shows its own site title.
    publishDraft.value = loadOfficialPublishDraft(path)
    publishSaved.value = false
    publishError.value = ''
  },
)

watch(publishDraft, () => {
  publishSaved.value = false
}, { deep: true })
</script>

<template>
  <section class="settings-workspace" aria-labelledby="settings-title">
    <aside class="settings-side" aria-label="设置">
      <div class="side-brand">
        <img :src="brandIcon" alt="">
        <div><b>V5Notes</b></div>
      </div>
      <div class="side-title"><h1 id="settings-title">设置</h1></div>

      <div class="side-group">
        <!-- 展开/收起是读者自己的选择，不跟着「正在看库设置」变 -->
        <button
          type="button"
          class="side-group-head"
          :class="{ on: scope === 'global' }"
          :aria-expanded="globalOpen"
          aria-controls="side-global-items"
          @click="globalOpen = !globalOpen"
        >
          全局设置<span class="side-group-note">所有库</span>
          <span class="side-group-chevron" :class="{ open: globalOpen }" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m6 4 4 4-4 4"/></svg></span>
        </button>
        <div v-show="globalOpen" id="side-global-items" class="side-items" role="group" aria-label="全局设置">
          <button type="button" class="side-nav-item" :class="{ on: scope === 'global' }" @click="scope = 'global'"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5.4" r="2.4"/><path d="M3.6 13c.4-2.4 2.2-3.8 4.4-3.8s4 1.4 4.4 3.8"/></svg>账户</button>
          <a class="side-nav-item" href="#g-appearance"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.4" y="3.2" width="11.2" height="7.2" rx="1"/><path d="M6 13h4M8 10.4V13"/></svg>主题与明暗</a>
          <a class="side-nav-item" href="#g-plugins"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.2 3.2h3.6v2.4H12v3.6h-2.2v2.4H6.2v-2.4H4V5.6h2.2z"/></svg>插件与安全</a>
          <a class="side-nav-item" href="#g-catalog"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 4h9.6M3.2 8h9.6M3.2 12h6"/></svg>插件列表</a>
          <a class="side-nav-item" href="#g-about"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.4"/><path d="M8 7.2v3.2M8 5.2h.01"/></svg>关于本机</a>
        </div>
      </div>

      <div v-if="vaultRows.length" class="side-group">
        <p class="side-group-label">库设置</p>
        <div class="side-vaults">
          <button
            v-for="row in vaultRows"
            :key="row.rootPath"
            type="button"
            class="side-vault"
            :class="{ active: row.active, missing: row.missing, switching: row.rootPath === switchingTo }"
            :disabled="row.missing || switchingTo !== null"
            :aria-current="row.active && scope === 'vault' ? 'page' : undefined"
            :title="row.rootPath"
            @click="activateVault(row)"
          >
            <span class="side-vault-bar" :style="{ background: rowColor(row.rootPath) }" aria-hidden="true"></span>
            <span class="side-vault-copy">
              <b>{{ row.name }}</b>
              <span v-if="row.missing">文件夹不在</span>
            </span>
            <span v-if="row.active" class="side-vault-go" aria-hidden="true"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg></span>
            <!-- 打开中只多一个行尾小转圈：不占行高，列表不会因为换库而跳动 -->
            <span v-else-if="row.rootPath === switchingTo" class="side-vault-spin" aria-hidden="true"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.6"/></svg></span>
            <span class="side-vault-status" role="status">{{ row.rootPath === switchingTo ? '打开中' : '' }}</span>
          </button>
        </div>
        <p v-if="switchError" class="side-vaults-note side-vaults-error" role="alert">{{ switchError }}</p>
      </div>

      <div class="side-foot">
        <button type="button" class="side-vault-action" @click="requestVault"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.2v9.6M3.2 8h9.6"/></svg>打开库…</button>
        <button type="button" class="side-vault-action" @click="requestRegistry">所有库</button>
      </div>
    </aside>

    <div class="settings-main">
      <div class="settings-inner">
        <!-- ========== 全局设置 ========== -->
        <div v-if="scope === 'global'" class="global-page">
          <ul class="status-strip" aria-label="当前状态">
            <li>
              <span class="status-chip">
                <span class="status-ico" aria-hidden="true"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5.4" r="2.4"/><path d="M3.6 13c.4-2.4 2.2-3.8 4.4-3.8s4 1.4 4.4 3.8"/></svg></span>
                <span class="status-copy"><span>账号</span><b><i :class="{ g: account.loggedIn.value }"></i>{{ account.loggedIn.value ? '已登录' : '未登录' }}</b></span>
              </span>
            </li>
            <li>
              <span class="status-chip">
                <span class="status-ico" aria-hidden="true"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.2 3.2h3.6v2.4H12v3.6h-2.2v2.4H6.2v-2.4H4V5.6h2.2z"/></svg></span>
                <span class="status-copy"><span>扩展</span><b>{{ plugins.length ? plugins.length + ' 个已安装' : '未安装' }}</b></span>
              </span>
            </li>
            <li>
              <span class="status-chip">
                <span class="status-ico" aria-hidden="true" :class="{ on: safeMode }"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.6 3.6 4.6v3.3c0 2.8 1.9 4.8 4.4 5.5 2.5-.7 4.4-2.7 4.4-5.5V4.6L8 2.6z"/></svg></span>
                <span class="status-copy"><span>安全模式</span><b>{{ safeMode ? '开' : '关' }}</b></span>
              </span>
            </li>
            <li>
              <button type="button" class="status-chip" @click="requestVault">
                <span class="status-ico" aria-hidden="true"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 5.2 8 2.6l4.8 2.6v5.6L8 13.4 3.2 10.8V5.2z"/><path d="M3.2 5.2 8 7.8l4.8-2.6M8 7.8v5.6"/></svg></span>
                <span class="status-copy"><span>库</span><b>{{ vaultRows.length }} 个{{ vault?.name ? ' · ' + vault.name : '' }}</b></span>
              </button>
            </li>
          </ul>

          <div class="panel-stack">
            <section class="panel" id="g-account" aria-labelledby="g-account-title">
              <div class="p-head">
                <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5.4" r="2.4"/><path d="M3.6 13c.4-2.4 2.2-3.8 4.4-3.8s4 1.4 4.4 3.8"/></svg></span>
                <h3 id="g-account-title">账户</h3>
              </div>
              <div class="p-body">
                <AccountPanel :account="account" :vault="vault" :sync="sync" mode="account" />
              </div>
            </section>

            <section class="panel" id="g-appearance" aria-labelledby="g-appearance-title">
              <div class="p-head">
                <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.4" y="3.2" width="11.2" height="7.2" rx="1"/><path d="M6 13h4M8 10.4V13"/></svg></span>
                <h3 id="g-appearance-title">主题与明暗</h3>
                <span class="state">{{ activeThemeLabel }} · {{ activeColorModeLabel }}</span>
              </div>
              <div class="p-body">
                <div class="book-theme-grid" role="group" aria-label="主题">
                  <div
                    v-for="theme in themes"
                    :key="theme.id"
                    class="book-theme"
                    :class="{ on: prefs.theme === theme.id, 'is-removable': isRemovableTheme(theme) }"
                  >
                    <button
                      class="book-theme-pick"
                      type="button"
                      :disabled="safeMode && !theme.builtin"
                      :aria-pressed="prefs.theme === theme.id"
                      @click="setTheme(theme.id)"
                    >
                      <div
                        class="book-theme-preview"
                        :style="themePreviewStyle(theme.id)"
                        :data-mode="previewDark ? 'dark' : 'light'"
                        aria-hidden="true"
                      >
                        <span class="rail"></span><span class="bar b1"></span><span class="bar b2"></span><span class="bar b3"></span><span class="dot"></span><span class="page"></span>
                      </div>
                      <div class="book-theme-name">{{ themeLabel(theme) }}<span class="check">✓</span></div>
                      <div v-if="themeDescription(theme)" class="book-theme-desc">{{ themeDescription(theme) }}</div>
                    </button>
                    <div v-if="isRemovableTheme(theme)" class="book-theme-foot">
                      <button
                        class="book-row-discard book-theme-discard"
                        type="button"
                        :disabled="extensionBusy || uninstallBusy"
                        :aria-label="`卸载主题 ${themeLabel(theme)}`"
                        :title="`卸载主题 ${themeLabel(theme)}`"
                        @click="uninstallThemeTarget = theme"
                      >
                        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.4h10"/><path d="M6.4 4.4V3.2h3.2v1.2"/><path d="M4.4 4.4l.6 8.1a1 1 0 0 0 1 .9h4a1 1 0 0 0 1-.9l.6-8.1"/><path d="M6.8 6.8v4.4M9.2 6.8v4.4"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
                <div class="book-row">
                  <div class="book-row-copy">
                    <strong>色模式</strong>
                    <p class="book-hint">跟随系统，或固定浅色 / 深色</p>
                  </div>
                  <div class="book-seg" role="group" aria-label="色模式">
                    <button v-for="mode in colorModes" :key="mode.id" type="button" :class="{ on: prefs.colorMode === mode.id }" @click="setColorMode(mode.id)">{{ mode.label }}</button>
                  </div>
                </div>
                <p v-if="themeError" class="book-small" role="status">{{ themeError }}</p>
              </div>
            </section>

            <section class="panel" id="g-plugins" aria-labelledby="g-plugins-title">
              <div class="p-head">
                <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.2 3.2h3.6v2.4H12v3.6h-2.2v2.4H6.2v-2.4H4V5.6h2.2z"/></svg></span>
                <h3 id="g-plugins-title">插件与安全</h3>
              </div>
              <div class="p-body">
                <div class="book-list-row book-guard-row">
                  <div class="book-plugin-main">
                    <div class="book-plugin-line">
                      <strong>安全模式</strong>
                      <span class="book-plugin-state" :class="safeMode ? 'on' : 'off'"><i aria-hidden="true"></i>{{ safeMode ? '仅核心' : '关' }}</span>
                    </div>
                    <div class="book-plugin-perms">
                      <span class="book-plugin-perm">社区扩展与社区主题暂停加载；默认 / 暮色与明暗照常生效</span>
                    </div>
                  </div>
                  <button class="book-switch" :class="{ on: safeMode }" type="button" role="switch" :aria-checked="safeMode" :disabled="extensionBusy" aria-label="安全模式" @click="toggleSafeMode"><span></span></button>
                </div>
                <p class="book-sub book-guard-gap">已安装扩展</p>
                <ul v-if="plugins.length" class="book-list">
                  <li v-for="p in plugins" :key="p.id" class="book-list-row">
                    <div class="book-plugin-main">
                      <div class="book-plugin-line">
                        <strong>{{ p.name }}</strong>
                        <span class="book-plugin-state" :class="pluginStatus(p).tone">
                          <i aria-hidden="true"></i>{{ pluginStatus(p).label }}
                        </span>
                      </div>
                      <div class="book-plugin-meta">
                        <code>{{ p.id }}</code>
                        <span>{{ p.core ? '核心' : '本地' }}</span>
                      </div>
                      <div class="book-plugin-perms">
                        <span class="book-plugin-perm">{{ permissionSummary(p) }}</span>
                      </div>
                      <div v-if="p.error" class="book-danger">{{ p.error }}</div>
                    </div>
                    <div class="book-row-actions">
                      <button
                        v-if="!p.core"
                        class="book-row-discard"
                        type="button"
                        :disabled="extensionBusy || uninstallBusy"
                        :aria-label="`卸载 ${p.name}`"
                        :title="`卸载 ${p.name}`"
                        @click="uninstallPluginTarget = p"
                      >
                        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.4h10"/><path d="M6.4 4.4V3.2h3.2v1.2"/><path d="M4.4 4.4l.6 8.1a1 1 0 0 0 1 .9h4a1 1 0 0 0 1-.9l.6-8.1"/><path d="M6.8 6.8v4.4M9.2 6.8v4.4"/></svg>
                      </button>
                      <button
                        v-if="p.id !== 'v5-editor'"
                        class="book-row-btn"
                        :class="{ on: p.status !== 'loaded' }"
                        type="button"
                        :disabled="extensionBusy || (safeMode && !p.core)"
                        @click="togglePlugin(p.id, p.status !== 'loaded')"
                      >{{ p.status === 'loaded' ? '禁用' : '启用' }}</button>
                      <span v-else class="book-plugin-fixed">始终启用</span>
                    </div>
                  </li>
                </ul>
                <p v-if="!hostReady" class="book-small">扩展宿主未能启动。</p>
                <p v-else-if="!plugins.length" class="book-small">暂无已安装扩展，可安装下方插件列表中的扩展。</p>
                <div v-for="row in editorKinds" :key="row.docKind" class="book-cmd-row">
                  <p class="book-sub">{{ editorKindLabel(row.docKind) }}</p>
                  <button
                    v-for="ed in row.providers"
                    :key="ed.id"
                    class="book-cmd"
                    :class="{ 'is-on': ed.id === row.active.id }"
                    type="button"
                    :aria-pressed="ed.id === row.active.id"
                    :disabled="extensionBusy"
                    @click="chooseEditor(ed.id)"
                  >
                    <strong>{{ ed.name }}</strong><span>{{ ed.pluginId }}</span>
                  </button>
                </div>
                <div v-if="settingTabs.length" class="book-plugin-tabs">
                  <p class="book-sub">插件设置</p>
                  <div v-for="tab in settingTabs" :key="tab.pluginId + ':' + tab.id" class="book-plugin-tab">
                    <strong>{{ tab.name }}</strong>
                    <div class="book-plugin-tab-host" :ref="el => setPluginTabHost(tab.pluginId, tab.id, el)"></div>
                  </div>
                </div>
                <p v-if="pluginMessage" class="book-small book-danger-text" role="alert">{{ pluginMessage }}</p>
              </div>
            </section>

            <section class="panel" id="g-catalog" aria-labelledby="g-catalog-title">
              <div class="p-head">
                <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 4h9.6M3.2 8h9.6M3.2 12h6"/></svg></span>
                <h3 id="g-catalog-title">插件列表</h3>
                <span class="state">{{ catalogSource === 'server' ? '服务器' : '本地种子' }}</span>
                <button type="button" class="p-head-action" :disabled="extensionBusy" aria-label="导入扩展包" title="导入扩展包" @click="importExtensionZipFile">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.6 9.6v2.2a1 1 0 0 0 1 1h8.8a1 1 0 0 0 1-1V9.6"/><path d="M8 2.6v6.2M5.3 6.1 8 8.8l2.7-2.7"/></svg>
                </button>
                <button type="button" class="p-head-action" :disabled="catalogBusy" :aria-label="catalogBusy ? '刷新中' : '刷新目录'" :title="catalogBusy ? '刷新中' : '刷新目录'" @click="loadCatalog">
                  <svg viewBox="0 0 16 16" aria-hidden="true" :class="{ spinning: catalogBusy }"><path d="M12.9 8.5A5.1 5.1 0 1 1 11.2 4.1"/><path d="M11.6 1.9v3h-3"/></svg>
                </button>
              </div>
              <div class="p-body">
                <div v-if="catalogRows.length" class="book-catalog-list">
                  <div v-for="item in catalogRows" :key="item.id" class="book-catalog-row">
                    <div>
                      <strong>{{ item.name }}</strong><span class="book-mono"> · {{ item.kind }} · {{ item.version }}</span>
                      <p>{{ item.description }}</p>
                      <div class="book-tags">
                        <span v-if="importedItems.some(i => i.id === item.id)" class="book-tag book-tag--local">本机</span>
                        <span v-for="tag in item.tags || []" :key="tag" class="book-tag">{{ tag }}</span>
                        <span v-if="item.networkAllowlist?.length" class="book-tag">allowlist: {{ item.networkAllowlist.join(', ') }}</span>
                      </div>
                    </div>
                    <div class="book-catalog-actions">
                      <button
                        v-if="importedItems.some(i => i.id === item.id)"
                        class="book-row-discard"
                        type="button"
                        :disabled="extensionBusy"
                        aria-label="移出列表"
                        title="移出列表"
                        @click="discardImported(item)"
                      >
                        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2"/></svg>
                      </button>
                      <button
                        v-if="catalogAction(item) === 'install'"
                        class="book-ghost book-ghost--sm"
                        type="button"
                        :disabled="extensionBusy || safeMode"
                        :title="safeMode ? '安全模式下不可安装' : undefined"
                        @click="installCatalog(item)"
                      >
                        安装
                      </button>
                    </div>
                  </div>
                </div>
                <p v-if="catalogMessage" class="book-small" role="status">{{ catalogMessage }}</p>
              </div>
            </section>

            <section class="panel" id="g-about" aria-labelledby="g-about-title">
              <div class="p-head">
                <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.4"/><path d="M8 7.2v3.2M8 5.2h.01"/></svg></span>
                <h3 id="g-about-title">关于本机</h3>
              </div>
              <div class="p-body">
                <dl class="book-meta book-meta--about">
                  <div><dt>版本</dt><dd>V5Notes Vault <code>{{ versionLabel }}</code></dd></div>
                  <div><dt>Bundle ID</dt><dd><code>xin.v5ai.v5notes.vault</code></dd></div>
                  <div><dt>Deep link</dt><dd><code>v5notes-vault://</code></dd></div>
                </dl>
                <div class="book-about-actions">
                  <button v-if="releaseNotesAvailable" class="book-ghost book-ghost--sm" type="button" @click="emit('show-release-notes')">
                    本版更新说明
                  </button>
                  <button
                    class="book-about-check"
                    :class="{ 'is-offered': Boolean(offeredVersion) }"
                    type="button"
                    :disabled="updateChecking"
                    :aria-busy="updateChecking"
                    @click="emit('check-update')"
                  >
                    <svg v-if="updateChecking" class="spinning" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 8a4.8 4.8 0 0 1 8.2-3.4M12.8 8a4.8 4.8 0 0 1-8.2 3.4"/><path d="M11.2 2.8v2.6H8.6M4.8 13.2v-2.6h2.6"/></svg>
                    <svg v-else viewBox="0 0 16 16" aria-hidden="true"><path d="M8 9.4V2.8M5.2 5.6 8 2.8l2.8 2.8"/><path d="M3.2 11.2v1.6h9.6v-1.6"/></svg>
                    {{ updateAction.label }}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>

        <!-- ========== 库设置：当前打开的库 ========== -->
        <div v-else-if="vault" class="vault-page">
          <header class="vault-head">
            <span class="vault-head-bar" :style="{ background: vaultSwatch?.color || 'var(--vault)' }" aria-hidden="true"></span>
            <div class="vault-head-copy">
              <h2>{{ vault.name }}</h2>
              <span :title="vault.rootPath">{{ vault.rootPath }}</span>
            </div>

          </header>


          <section id="v-colors" class="panel" aria-labelledby="v-colors-title">
            <div class="p-head">
              <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.4"/><path d="M8 2.6v10.8M2.6 8h10.8"/></svg></span>
              <h3 id="v-colors-title">库色</h3>
              <span class="state">{{ vaultSwatch ? vaultSwatch.term + ' · ' + vaultSwatch.name : '' }}</span>
            </div>
            <div class="p-body">
              <div class="book-swatches" role="group" aria-label="库色">
                <button
                  v-for="swatch in VAULT_COLOR_PALETTE"
                  :key="swatch.id"
                  type="button"
                  class="book-swatch"
                  :class="{ on: vaultSwatch?.id === swatch.id }"
                  :aria-pressed="vaultSwatch?.id === swatch.id"
                  :title="swatch.term + ' · ' + swatch.name"
                  @click="pickVaultColor(swatch.id)"
                >
                  <span class="book-swatch-bar" :style="{ background: swatch.color }"></span>
                  <span class="book-swatch-label"><b>{{ swatch.term }}</b><br>{{ swatch.name }}</span>
                </button>
              </div>
              <p class="book-small">侧栏与窗口标题用它辨认这个库；随库保存，换台机器打开仍是这个颜色。</p>
              <p v-if="colorError" class="book-small book-danger-text" role="alert">{{ colorError }}</p>
            </div>
          </section>

          <section id="v-sync" class="panel" aria-labelledby="v-sync-title">
            <div class="p-head">
              <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 8a4.8 4.8 0 0 1 8.2-3.4M12.8 8a4.8 4.8 0 0 1-8.2 3.4"/><path d="M11.2 2.8v2.6H8.6M4.8 13.2v-2.6h2.6"/></svg></span>
              <h3 id="v-sync-title">同步</h3>
              <span v-if="account.useOfficialServer.value" class="state">官方服务器</span>
              <span v-else-if="account.server.value" class="state" :title="account.server.value">{{ account.server.value.replace(/^https?:\/\//, '') }}</span>
            </div>
            <div class="p-body">
              <AccountPanel :account="account" :vault="vault" :sync="sync" mode="sync" subject="同步" hide-server />
            </div>
          </section>

          <section id="v-backup" class="panel" aria-labelledby="v-backup-title">
            <div class="p-head">
              <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.8v6.4M5.6 7.2 8 9.6l2.4-2.4M3 12.4h10"/></svg></span>
              <h3 id="v-backup-title">备份与迁移</h3>
            </div>
            <div class="p-body">
              <div class="book-actions">
                <button class="book-action" type="button" :disabled="backupBusy" @click="runBackup">
                  <span class="book-action-icon"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.8v6.4M5.6 7.2 8 9.6l2.4-2.4M3 12.4h10"/></svg></span>
                  <span class="book-action-copy">
                    <strong>{{ backupBusy ? '正在打包…' : '导出整库 zip' }}</strong>
                    <span v-if="vault?.name">{{ vault.name }}</span>
                  </span>
                  <span class="book-action-go" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.2 8h7M7.2 5l3 3-3 3M12.8 4v8"/></svg></span>
                </button>
                <p v-if="backupResult" class="book-small" role="status">{{ backupResult }}</p>
                <p v-if="backupError" class="book-small book-danger-text" role="alert">{{ backupError }}</p>

                <button class="book-action" type="button" :class="{ open: migrationOpen }" :aria-expanded="migrationOpen" aria-controls="migration-guide" @click="toggleMigrationGuide">
                  <span class="book-action-icon"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5.4h9.2M10 3.2l2.2 2.2L10 7.6M13 10.6H3.8M6 8.4l-2.2 2.2L6 12.8"/></svg></span>
                  <span class="book-action-copy">
                    <strong>Cloud ↔ Vault 迁移</strong>
                    <span>{{ migrationOpen ? '隐去步骤' : '查看迁移步骤' }}</span>
                  </span>
                  <span class="book-action-go book-action-chevron" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m6 4 4 4-4 4"/></svg></span>
                </button>
                <div v-if="migrationOpen" id="migration-guide" class="book-note">
                  <p>{{ MIGRATION_EXPLICIT_LINE }}</p>
                  <p>{{ MIGRATION_STEPS_HELP }}</p>
                </div>
              </div>
            </div>
          </section>

          <section id="v-publish" class="panel" aria-labelledby="v-publish-title">
            <div class="p-head">
              <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 9.4V3.2M5.8 5.4 8 3.2l2.2 2.2M3 11.4h10"/></svg></span>
              <h3 id="v-publish-title">官方发布 / 分享</h3>
            </div>
            <div class="p-body">
              <label class="book-field">
                <span>站点标题</span>
                <input v-model="publishDraft.siteTitle" type="text" maxlength="100" placeholder="例如：公开读书笔记" autocomplete="off" @input="onPublishTitleInput">
              </label>
              <div class="book-field-label">可见性</div>
              <div class="book-seg book-seg--three" role="group" aria-label="可见性">
                <button v-for="opt in publishOptions" :key="opt.id" type="button" :aria-pressed="publishDraft.visibility === opt.id" :class="{ on: publishDraft.visibility === opt.id }" @click="setPublishVisibility(opt.id)">{{ opt.label }}</button>
              </div>
              <div class="book-inline">
                <button class="book-primary" type="button" :class="{ saved: publishSaved }" @click="savePublishDraft">
                  <span class="book-primary-ico" aria-hidden="true">
                    <svg v-if="publishSaved" viewBox="0 0 16 16"><path d="m3.6 8.4 3 3 5.8-6.4"/></svg>
                    <svg v-else viewBox="0 0 16 16"><path d="M3.6 2.6h7.2l1.6 1.6v9.2H3.6z"/><path d="M5.6 2.6v3.4h4.6V2.6M5.6 10.2h4.8"/></svg>
                  </span>
                  {{ publishSaved ? '已保存' : '保存设置' }}
                </button>
              </div>
              <p v-if="publishError" class="book-small book-danger-text" role="alert">{{ publishError }}</p>
            </div>
          </section>

          <!-- 删除放在最底部：先读完这个库的全部设置，再决定是否删除 -->
          <section class="panel panel-danger" aria-labelledby="v-delete-title">
            <div class="p-head">
              <span class="ico ico-danger"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 4.6h9.6M6.4 4.6V3.2h3.2v1.4M4.4 4.6l.6 8h6l.6-8"/></svg></span>
              <h3 id="v-delete-title">删除库</h3>
              <span class="state">{{ vault.name }}</span>
            </div>
            <div class="p-body">
              <div class="pref-row">
                <div class="pref-copy">
                  <strong>从这台机器上移除「{{ vault.name }}」</strong>
                  <span>{{ vault.rootPath }}</span>
                </div>
                <button type="button" class="book-danger-btn" :disabled="deleteBusy" @click="askDeleteVault">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 4.6h9.6M6.4 4.6V3.2h3.2v1.4M4.4 4.6l.6 8h6l.6-8"/></svg>
                  删除库
                </button>
              </div>
              <p class="book-small">只删除这里的库记录；文件夹和笔记原样保留，之后仍可从「所有库」重新打开。</p>
              <p v-if="deleteError" class="book-small book-danger-text" role="alert">{{ deleteError }}</p>
            </div>
          </section>
        </div>

        <!-- 没有打开的库就不出现库页：只能停在全局，入口在左栏底部。 -->
        <div v-else class="vault-empty">
          <span class="vault-empty-ico" aria-hidden="true"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 5.2 8 2.6l4.8 2.6v5.6L8 13.4 3.2 10.8V5.2z"/><path d="M3.2 5.2 8 7.8l4.8-2.6M8 7.8v5.6"/></svg></span>
          <p class="vault-empty-copy">还没打开库</p>
          <button type="button" class="side-vault-action" @click="requestVault"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.2v9.6M3.2 8h9.6"/></svg>打开库…</button>
        </div>
      </div>
    </div>

    <ConfirmDialog
      :open="uninstallPluginTarget !== null"
      :title="`卸载「${uninstallPluginTarget?.name ?? ''}」？`"
      message="将从这台机器删除插件文件、全局设置，以及当前库中它的设置。该插件在所有库中都不可用，笔记不受影响。"
      confirm-label="卸载"
      danger
      :busy="uninstallBusy"
      @cancel="uninstallPluginTarget = null"
      @confirm="confirmUninstallPlugin"
    />
    <ConfirmDialog
      :open="uninstallThemeTarget !== null"
      :title="`卸载主题「${uninstallThemeTarget ? themeLabel(uninstallThemeTarget) : ''}」？`"
      :message="`将从这台机器删除这个主题的文件。${uninstallThemeTarget && prefs.theme === uninstallThemeTarget.id ? '当前正在使用它，卸载后会切回「默认」。' : '已安装的笔记不受影响。'}`"
      confirm-label="卸载"
      danger
      :busy="uninstallBusy"
      @cancel="uninstallThemeTarget = null"
      @confirm="confirmUninstallTheme"
    />
    <ConfirmDialog
      :open="deleteOpen"
      :title="`删除「${vault?.name ?? ''}」？`"
      :message="`将在这台机器上移除这个库的记录，不再出现在库列表和最近打开里。文件夹 ${vault?.rootPath ?? ''} 中的笔记不会被删除或改动。`"
      confirm-label="删除记录"
      danger
      :busy="deleteBusy"
      @cancel="deleteOpen = false"
      @confirm="confirmDeleteVault"
    />
  </section>
</template>
<style scoped>
/* ============================================================
   Settings · dir-6 layout
   02 sidebar + 01 single-column content + 02 panels.
   ============================================================ */

.settings-workspace {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: 232px minmax(0, 1fr);
  background: transparent;
  color: var(--ink);
  font-family: var(--font-ui);
  -webkit-font-smoothing: antialiased;
}

.settings-workspace button,
.settings-workspace input {
  font-family: inherit;
  color: inherit;
}

.settings-workspace button:focus-visible,
.settings-workspace input:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 65%, transparent);
  outline-offset: 2px;
}

/* ---------- sidebar ---------- */
.settings-side {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 22px 16px 18px;
  background: color-mix(in srgb, var(--panel) 60%, var(--bg));
  border-right: 1px solid var(--line);
}

.side-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 6px;
}
.side-brand img {
  width: 28px;
  height: 28px;
  border-radius: 8px;
}
.side-brand b {
  font-family: var(--font-display);
  font-size: 14px;
  letter-spacing: -0.02em;
  font-weight: 700;
}

.side-title {
  margin: 26px 6px 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.side-title h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 25px;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.side-nav {
  margin-top: 18px;
  display: grid;
  gap: 2px;
}
/* ---------- sidebar: 全局设置 + 每个库 ---------- */
.side-group { margin-top: 22px; display: grid; gap: 2px; }
.side-group:first-of-type { margin-top: 18px; }
.side-group-head {
  display: flex;
  align-items: baseline;
  gap: 7px;
  padding: 0 9px 6px;
  color: var(--ink);
  font-size: 11px;
  font-weight: 600;
  text-align: left;
  transition: color 0.14s ease;
}
.side-group-head:hover { color: var(--accent); }
.side-group-chevron {
  width: 12px;
  height: 12px;
  margin-left: auto;
  align-self: center;
  display: inline-grid;
  place-items: center;
  color: var(--muted);
  transition: transform 0.16s ease, color 0.14s ease;
}
.side-group-chevron svg {
  width: 11px;
  height: 11px;
  display: block;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.side-group-chevron.open { transform: rotate(90deg); }
.side-group-head:hover .side-group-chevron { color: var(--accent); }
@media (prefers-reduced-motion: reduce) {
  .side-group-chevron { transition: none; }
}
.side-group-note,
.side-group-label + .side-vaults-note {
  font-family: var(--font-mono);
  font-size: 8.5px;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: color-mix(in srgb, var(--muted) 82%, transparent);
}
.side-group-note { margin-left: 2px; }
.side-group-label {
  margin: 0 0 6px;
  padding: 0 9px;
  font-size: 11px;
  font-weight: 600;
  color: var(--ink);
}
.side-items { display: grid; gap: 2px; }
/* 组内的锚点沿用同一套行，只是不是当前页 */
.side-nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 30px;
  padding: 0 9px;
  border-radius: 7px;
  color: var(--muted);
  text-align: left;
  font-size: 12px;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.14s ease, color 0.14s ease;
}
/* 图标按行高固定，否则 SVG 会按默认 300×150 撑满整栏 */
.side-nav-item svg {
  width: 14px;
  height: 14px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.55;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.side-nav-item:hover {
  background: color-mix(in srgb, var(--panel) 65%, var(--surface));
  color: var(--ink);
}
.side-nav-item.on {
  background: color-mix(in srgb, var(--accent) 11%, var(--panel));
  color: var(--accent);
  font-weight: 600;
}
a.side-nav-item:visited { color: var(--muted); }

.side-vaults { display: grid; gap: 3px; }
.side-vault {
  position: relative;
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  text-align: left;
  transition: background 0.14s ease, border-color 0.14s ease;
}
.side-vault:hover:not(:disabled) { background: color-mix(in srgb, var(--panel) 70%, var(--surface)); }
.side-vault.active {
  border-color: color-mix(in srgb, var(--accent) 34%, var(--line));
  background: color-mix(in srgb, var(--accent) 9%, var(--panel));
}
.side-vault.missing { opacity: 0.5; cursor: default; }
.side-vault-bar { width: 5px; height: 20px; border-radius: 2px; flex: none; }
.side-vault-copy { min-width: 0; flex: 1; }
.side-vault-copy b {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.side-vault.active .side-vault-copy b { font-weight: 600; }
.side-vault-copy span {
  display: block;
  margin-top: 1px;
  font-family: var(--font-mono);
  font-size: 8px;
  color: var(--muted);
}
.side-vault-go { width: 12px; height: 12px; color: var(--accent); flex: none; }
.side-vault-go svg { width: 12px; height: 12px; display: block; }
/* 与右侧箭头同尺寸，切换时只换图标，不改变行的宽高 */
.side-vault-spin { width: 12px; height: 12px; color: var(--accent); flex: none; }
.side-vault-spin svg {
  width: 12px;
  height: 12px;
  display: block;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-dasharray: 26 10;
  animation: settings-spin 0.8s linear infinite;
}
.side-vault-status {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  .side-vault-spin svg { animation-duration: 1.8s; }
}
.side-vaults-note { margin: 4px 9px 0; font-size: 8.5px; color: color-mix(in srgb, var(--muted) 82%, transparent); }

/* 库的入口常驻左栏底部：设置里换库从这里走，而不是猜一个库出来 */
.side-foot {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--line);
  display: flex;
  gap: 6px;
}
.side-vault-action {
  height: 28px;
  padding: 0 10px;
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
  border-radius: 7px;
  background: var(--panel);
  color: var(--ink);
  font-size: 10.5px;
  transition: border-color 0.14s ease, background 0.14s ease, color 0.14s ease;
}
.side-vault-action:hover {
  border-color: color-mix(in srgb, var(--accent) 38%, var(--line));
  color: var(--accent);
}
.side-vault-action svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* ---------- 库设置页 ---------- */
/* ---------- 库设置：与全局设置同构，一页铺开 ---------- */
/* 库名与路径作为这一页的头，下面的面板按「库色 → 同步 → 备份 → 发布 → 删除」纵向排列 */
.vault-page .panel-stack { display: flex; flex-direction: column; gap: 18px; }

/* 偏好行：左侧标题与说明，右侧控件 */
.pref-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.pref-copy { min-width: 0; }
.pref-copy strong { display: block; font-size: 11.5px; font-weight: 600; color: var(--ink); }
.pref-copy span {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 危险区：只在「删除库」那块上用朱砂色，不污染其他面板 */
.panel-danger { border-color: color-mix(in srgb, var(--danger) 34%, var(--line)); }
.panel-danger .ico-danger {
  background: color-mix(in srgb, var(--danger) 10%, var(--panel));
  color: var(--danger);
}
/* 警示动作：静止态就是警告色填充，一眼看出这是破坏性操作；
   悬停时再压暗一档。深色模式下 danger 是浅色，文字改用深色保证对比度。
   选择器必须带上 .settings-workspace：上面 .settings-workspace button
   { color: inherit } 的优先级（0,2,0）会盖掉单独的 .book-danger-btn（0,1,0），
   否则白字被继承的墨色顶掉。 */
.settings-workspace button.book-danger-btn {
  height: 32px;
  padding: 0 13px;
  gap: 6px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--danger);
  border-radius: 7px;
  background: var(--danger);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  transition: background 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--danger) 28%, transparent);
}
/* 图标与文字同色，尺寸跟按钮字号走 */
.book-danger-btn svg {
  width: 12px;
  height: 12px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.book-danger-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--danger) 86%, #000);
  border-color: color-mix(in srgb, var(--danger) 86%, #000);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--danger) 32%, transparent);
}
.book-danger-btn:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--danger) 52%, transparent);
  outline-offset: 2px;
}
/* 深色模式下 --danger 是浅朱砂，纯白字几乎看不清：这里改用深色字。 */
:root[data-color-mode='dark'] .settings-workspace button.book-danger-btn {
  color: #1c1512;
}
:root[data-color-mode='dark'] .book-danger-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--danger) 80%, #000);
  border-color: color-mix(in srgb, var(--danger) 80%, #000);
}
.book-danger-btn:disabled { opacity: 0.5; cursor: default; box-shadow: none; }

/* 库设置页：库名 + 路径在左、页签靠右，下面一条四块状态卡，一次只展开一块 */
/* 库页与全局设置同一宽度：由 .settings-inner 收窄到 860px 并居中。
   纵向排列：库色 → 同步 → 备份与迁移 → 发布 → 删除库。 */
.vault-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  min-width: 0;
}
.vault-page > * { min-width: 0; }
.vault-head {
  display: flex;
  align-items: center;
  gap: 12px;
  /* 设计图里库名、四块卡、面板左边缘垂直对齐，所以头部不再加左右内缩 */
  padding: 0;
  min-width: 0;
}
.vault-head-bar { width: 8px; height: 40px; border-radius: 3px; flex: none; }
.vault-head-copy { min-width: 0; flex: 1; }
.vault-head-copy h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vault-head-copy span {
  display: block;
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  color: var(--muted);  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vault-tabs {
  flex: none;
  display: inline-flex;
  margin-left: auto;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  /* 设计图里这组按钮有一块浅砂底，和纸白背景明确分开 */
  background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--line) 60%, transparent);
}
.vault-tabs button {
  height: 28px;
  padding: 0 14px;
  border-radius: 7px;
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
  transition: background 0.14s ease, color 0.14s ease, box-shadow 0.14s ease;
}
.vault-tabs button:hover:not(.on) {
  color: var(--ink);
  background: color-mix(in srgb, var(--panel) 55%, transparent);
}
.vault-tabs button.on {
  background: var(--panel);
  color: var(--ink);
  font-weight: 600;
  box-shadow: 0 1px 2px color-mix(in srgb, #000 10%, transparent);
}

.vault-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.vault-tile {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
  padding: 13px 14px;
  border: 1px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-radius: 12px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--panel) 94%, #fff 6%), var(--panel));
  text-align: left;
  transition: border-color 0.14s ease, box-shadow 0.14s ease, background 0.14s ease;
}
.vault-tile:hover:not(.on) { border-color: color-mix(in srgb, var(--muted) 48%, var(--line)); }
.vault-tile.on {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
  background: color-mix(in srgb, var(--accent) 7%, var(--panel));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent);
}
.vault-tile-ico {
  width: 26px;
  height: 26px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 7px;
  color: var(--accent);
}
.vault-tile-ico svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.vault-tile-copy { min-width: 0; }
.vault-tile-copy b { display: block; font-size: 13px; font-weight: 600; color: var(--ink); }
.vault-tile-copy span {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vault-page .panel { scroll-margin-top: 16px; }
.vault-page :deep(.account-panel) { margin: 0; }

.vault-empty { display: grid; place-items: center; gap: 12px; padding: 80px 0; }
.vault-empty-copy { margin: 0; font-size: 12px; color: var(--muted); }
.vault-empty .side-vault-action { flex: 0 0 auto; padding: 0 14px; }

/* ---------- 内容区共享部件 ---------- */
.book-small { margin: 10px 0 0; font-size: 10px; line-height: 1.6; color: var(--muted); }
.book-small:empty { display: none; }
.book-muted { color: var(--muted); }
.book-danger { margin-top: 4px; color: var(--danger); font-size: 9.5px; }
.book-danger-text { color: var(--danger); }
.book-mono { font-family: var(--font-mono); font-size: 8.5px; letter-spacing: 0.02em; color: color-mix(in srgb, var(--muted) 88%, transparent); }
.book-sub { margin: 0 0 6px; font-family: var(--font-mono); font-size: 8.5px; letter-spacing: 0.02em; color: color-mix(in srgb, var(--muted) 88%, transparent); }
.book-note {
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
  border-left: 2px solid color-mix(in srgb, var(--muted) 48%, var(--line));
  background: color-mix(in srgb, var(--panel) 72%, var(--surface));
  font-size: 11px;
  line-height: 1.65;
  color: var(--muted);
}
.book-note p { margin: 0; }
.book-note p + p { margin-top: 6px; }
.book-meta { margin: 0; display: grid; border-top: 1px solid color-mix(in srgb, var(--line) 86%, transparent); }
.book-meta > div {
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr);
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 76%, transparent);
  font-size: 11px;
}
.book-meta dt { color: color-mix(in srgb, var(--muted) 82%, transparent); }
.book-meta dd { margin: 0; color: var(--ink); }
.book-meta code { font-family: var(--font-mono); font-size: 10px; color: var(--ink); }
.book-field { display: grid; gap: 5px; margin-top: 14px; }
.book-field > span, .book-field-label { font-size: 10px; letter-spacing: 0.04em; color: var(--muted); }
.book-field-label { display: block; margin: 13px 0 7px; }
.book-field input, .book-input {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
  border-radius: 6px;
  background: var(--panel);
  color: var(--ink);
  font-size: 12px;
  box-shadow: inset 0 1px 2px color-mix(in srgb, #000 5%, transparent);
  transition: border-color 0.14s ease, box-shadow 0.14s ease;
}
.book-field input::placeholder { color: color-mix(in srgb, var(--muted) 65%, transparent); }
.book-field input:focus {
  border-color: color-mix(in srgb, var(--accent) 50%, var(--line));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent);
  outline: none;
}

.book-seg { display: inline-flex; gap: 2px; padding: 2px; border-radius: 6px; background: color-mix(in srgb, var(--surface) 60%, var(--panel)); }
.book-seg button { height: 27px; padding: 0 10px; border-radius: 4px; font-size: 10.5px; color: var(--muted); white-space: nowrap; }
.book-seg button.on { background: var(--panel); color: var(--ink); font-weight: 600; box-shadow: 0 1px 2px color-mix(in srgb, #000 8%, transparent); }
.book-seg--three { display: grid; grid-template-columns: repeat(3, 1fr); width: 100%; }
.book-seg--three button { height: 30px; font-size: 11px; }
.book-inline { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
.book-primary {
  height: 34px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  line-height: 1;
  border: 1px solid color-mix(in srgb, var(--accent-hover) 55%, transparent);
  border-radius: 8px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 88%, #fff 12%), var(--accent));
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  box-shadow: 0 1px 2px color-mix(in srgb, #000 16%, transparent), inset 0 1px 0 color-mix(in srgb, #fff 22%, transparent);
  transition: background 0.14s ease, box-shadow 0.14s ease, transform 0.14s ease;
}
.settings-workspace button.book-primary { color: #fff; }
.settings-workspace button.book-primary:hover:not(:disabled) {
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent-hover) 80%, #fff 20%), var(--accent-hover));
  transform: translateY(-0.5px);
}
.book-primary-ico { width: 16px; height: 16px; display: inline-grid; place-items: center; flex: none; }
.book-primary-ico svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.book-ghost {
  height: 30px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  line-height: 1;
  border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
  border-radius: 6px;
  background: var(--panel);
  color: var(--ink);
  font-size: 10.5px;
  font-weight: 500;
}
.book-ghost:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--muted) 60%, var(--line));
  background: color-mix(in srgb, var(--panel) 70%, var(--surface));
}
.book-ghost--sm { height: 26px; padding: 0 9px; font-size: 10px; }
.book-ghost:disabled { opacity: 0.5; cursor: default; }
.book-ghost svg { width: 12px; height: 12px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.book-text-btn { font-size: 10px; color: var(--accent); border-bottom: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); padding-bottom: 1px; white-space: nowrap; }
.book-text-btn:hover:not(:disabled) { border-color: var(--accent); }
.book-text-btn:disabled { opacity: 0.45; cursor: default; }
.book-text-btn.is-fixed { color: var(--muted); border-bottom-color: transparent; }

.book-actions { display: grid; gap: 8px; }
.book-action {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 9px 10px;
  border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
  border-radius: 8px;
  background: var(--panel);
  text-align: left;
  transition: border-color 0.14s ease, background 0.14s ease;
}
.book-action:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--muted) 55%, var(--line));
  background: color-mix(in srgb, var(--panel) 70%, var(--surface));
}
.book-action:disabled { opacity: 0.5; cursor: default; }
.book-action.open { border-color: color-mix(in srgb, var(--accent) 40%, var(--line)); }
.book-action-icon {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: color-mix(in srgb, var(--surface) 60%, var(--panel));
  color: var(--accent);
}
.book-action-icon svg, .book-action-go svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.book-action-copy strong { display: block; font-size: 11px; font-weight: 600; color: var(--ink); }
.book-action-copy span {
  display: block;
  margin-top: 2px;
  font-size: 9.5px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.book-action-go {
  width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  color: color-mix(in srgb, var(--muted) 76%, transparent);
  transition: color 0.14s ease, transform 0.16s ease;
}
.book-action:hover:not(:disabled) .book-action-go { color: var(--accent); }
.book-action.open .book-action-chevron { transform: rotate(90deg); color: var(--accent); }
.book-actions .book-note { margin: 0; border-radius: 0 0 8px 8px; border-top: 0; }
.book-guard-row { margin-top: -2px; }
.book-guard-gap { display: block; margin-top: 14px; }
.book-subhead { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.book-subhead strong { font-size: 10px; letter-spacing: 0.04em; color: var(--muted); }
.book-pref-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.book-pref-copy { display: block; min-width: 0; }
.book-pref-copy strong { display: block; font-size: 11px; font-weight: 600; }
.book-pref-copy span { display: block; margin-top: 2px; font-size: 10px; line-height: 1.5; color: var(--muted); }

.book-switch {
  position: relative;
  width: 34px;
  height: 19px;
  flex: 0 0 34px;
  border-radius: 99px;
  background: color-mix(in srgb, var(--line) 80%, var(--muted));
  box-shadow: inset 0 1px 2px color-mix(in srgb, #000 10%, transparent);
  transition: background 0.16s ease;
}
.book-switch span {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--panel);
  box-shadow: 0 1px 2px color-mix(in srgb, #000 18%, transparent);
  transition: transform 0.16s cubic-bezier(0.2, 0.7, 0.2, 1);
}
.book-switch.on { background: var(--accent); }
.book-switch.on span { transform: translateX(15px); }
.book-switch:disabled { opacity: 0.5; cursor: default; }
/*
 * Plugin list: a name-first row. Title and row action sit on one line; the id,
 * 核心/本地 origin and permission scopes are quiet supporting text below, so the
 * list scans as names instead of a wall of monospace.
 */
.book-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: grid;
  gap: 2px;
}
.book-list-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 9px 10px;
  margin: 0 -10px;
  border-radius: 8px;
  transition: background 0.14s ease;
}
.book-list-row + .book-list-row {
  position: relative;
}
.book-list-row + .book-list-row::before {
  content: '';
  position: absolute;
  left: 10px;
  right: 10px;
  top: 0;
  height: 1px;
  background: color-mix(in srgb, var(--line) 62%, transparent);
}
.book-list-row:hover { background: color-mix(in srgb, var(--accent) 5%, transparent); }
.book-plugin-main { min-width: 0; flex: 1; }
.book-plugin-line { display: flex; align-items: center; gap: 8px; min-width: 0; }
.book-plugin-line strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.005em;
  color: var(--ink);
}
.book-plugin-state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  font-size: 10px;
  line-height: 1;
  color: var(--muted);
  white-space: nowrap;
}
.book-plugin-state i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--muted) 70%, transparent);
}
.book-plugin-state.on { color: var(--accent); }
.book-plugin-state.on i { background: var(--accent); }
.book-plugin-state.off { color: var(--muted); }
.book-plugin-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  min-width: 0;
  font-size: 10px;
  line-height: 1.3;
  color: var(--muted);
}
.book-plugin-meta code {
  font-family: var(--font-mono);
  font-size: 9.5px;
  color: color-mix(in srgb, var(--muted) 88%, transparent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.book-plugin-meta span {
  flex: none;
  padding: 0 5px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--surface) 65%, var(--panel));
  color: color-mix(in srgb, var(--muted) 92%, var(--ink));
}
.book-plugin-perms {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 5px;
}
.book-plugin-perm {
  font-family: var(--font-mono);
  font-size: 9px;
  line-height: 1.6;
  padding: 0 5px;
  border-radius: 4px;
  border: 1px solid color-mix(in srgb, var(--line) 82%, transparent);
  color: color-mix(in srgb, var(--muted) 92%, transparent);
  white-space: nowrap;
}
.book-row-btn {
  flex: none;
  height: 24px;
  padding: 0 11px;
  border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
  border-radius: 999px;
  background: var(--panel);
  color: var(--muted);
  font-family: var(--font-ui);
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1;
  transition: border-color 0.14s ease, background 0.14s ease, color 0.14s ease;
}
.book-row-btn:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--muted) 55%, var(--line));
  color: var(--ink);
}
/* 「启用」是这一行唯一的可执行动作，按主操作处理；「禁用」保持安静的次要样式。 */
.book-row-btn.on {
  border-color: color-mix(in srgb, var(--accent) 70%, var(--line));
  background: var(--accent);
  color: #fffefa;
}
:root[data-color-mode='dark'] .book-row-btn.on { color: #10231b; }
.book-row-btn.on:hover:not(:disabled) {
  border-color: var(--accent-hover);
  background: var(--accent-hover);
  /* 通用 :hover 会把文字压成深色，这里必须还原，否则深绿底上看不见。 */
  color: #fffefa;
}
:root[data-color-mode='dark'] .book-row-btn.on:hover:not(:disabled) { color: #10231b; }
.book-row-btn:disabled { opacity: 0.5; cursor: default; }
.book-plugin-fixed { flex: none; font-size: 10px; color: color-mix(in srgb, var(--muted) 85%, transparent); }
.book-cmd-row { margin-top: 12px; }
.book-cmd { padding: 6px 8px; margin: 0 5px 5px 0; border: 1px solid color-mix(in srgb, var(--line) 90%, transparent); border-radius: 6px; background: var(--panel); text-align: left; }
.book-cmd.is-on { border-color: var(--accent); }
.book-cmd strong { display: block; font-size: 10px; font-weight: 600; }
.book-cmd span { display: block; margin-top: 1px; font-family: var(--font-mono); font-size: 8px; color: var(--muted); }
.book-plugin-tabs { margin-top: 12px; }
.book-plugin-tab { padding: 8px 0; border-top: 1px solid color-mix(in srgb, var(--line) 82%, transparent); }
.book-plugin-tab strong { font-size: 11px; font-weight: 600; }
.book-plugin-tab-host { margin-top: 6px; font-size: 10px; color: var(--muted); }
.book-plugin-tab-host p { margin: 0 0 4px; font-size: 10px; line-height: 1.5; }
.book-plugin-tab-host > :last-child { margin-bottom: 0; }
.book-catalog-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: start; padding: 10px 0; border-bottom: 1px solid color-mix(in srgb, var(--line) 82%, transparent); }
.book-catalog-row strong { font-size: 11px; font-weight: 600; }
.book-catalog-row p { margin: 4px 0 0; font-size: 10px; line-height: 1.5; color: var(--muted); }
.book-tags { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 5px; }
.book-tag { padding: 1px 4px; border: 1px solid color-mix(in srgb, var(--line) 90%, transparent); border-radius: 3px; font-family: var(--font-mono); font-size: 8px; color: var(--muted); }
/* 本机导入的包：来源与种子条目不同，只在行上标出这一点。 */
.book-tag--local { border-color: color-mix(in srgb, var(--accent) 40%, transparent); color: var(--accent); }
.book-catalog-actions { display: flex; align-items: center; gap: 4px; }
/* 插件行右侧：卸载是次要动作，悬停/聚焦才出现，不抢禁用/启用。
   但一出现就是红底白图标——悬停到行上即可见，不必再移进图标。 */
.book-row-actions { display: flex; align-items: center; gap: 4px; flex: none; }
.book-list-row:hover .book-row-discard,
.book-list-row:focus-within .book-row-discard {
  opacity: 1;
  color: #fffefa;
  background: var(--danger);
}
/* 卸载按钮悬停才出现，固定在卡片右下角；名称与描述在右侧让出它的宽度，
   文字不会从按钮底下穿过去，卡片高度也不因它变化。 */
.book-theme.is-removable .book-theme-name,
.book-theme.is-removable .book-theme-desc { padding-right: 30px; }
.book-theme-foot {
  position: absolute;
  right: 7px;
  bottom: 7px;
  display: flex;
}
.book-theme:hover .book-theme-discard,
.book-theme:focus-within .book-theme-discard,
.book-theme-discard:focus-visible {
  opacity: 1;
  color: #fffefa;
  background: var(--danger);
}
/* 移出列表只在悬停/聚焦时出现：它是导入行的次要动作。 */
.book-row-discard {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.14s ease, color 0.14s ease, background 0.14s ease;
}
/* 悬停到行上就变红：这一下会删东西，视觉上不该是轻描淡写的灰。 */
.book-catalog-row:hover .book-row-discard,
.book-row-discard:focus-visible {
  opacity: 1;
  color: #fffefa;
  background: var(--danger);
}
.book-row-discard:focus-visible { outline: none; }
.book-row-discard:disabled { cursor: default; opacity: 0; }
.book-row-discard svg {
  width: 11px;
  height: 11px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
/* 主题卡右下角的卸载按钮：与名称/描述行同高，悬停时浮现在预留的右侧空白里。 */
.book-theme-discard { width: 26px; height: 22px; }
.book-theme-discard svg { width: 13px; height: 13px; }

.book-about-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.book-about-check {
  height: 30px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  line-height: 1;
  border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
  border-radius: 7px;
  background: var(--panel);
  color: var(--ink);
  font-size: 10.5px;
  font-weight: 500;
  white-space: nowrap;
}
.book-about-check:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--muted) 60%, var(--line));
  background: color-mix(in srgb, var(--panel) 70%, var(--surface));
}
.book-about-check.is-offered {
  border-color: color-mix(in srgb, var(--accent-hover) 55%, transparent);
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 88%, #fff 12%), var(--accent));
  color: #fff;
  font-weight: 600;
}
.book-about-check:disabled { opacity: 0.6; }
.book-about-check svg { width: 13px; height: 13px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.book-about-check svg.spinning { animation: settings-spin 0.9s linear infinite; }
.book-swatches { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
.book-swatch { min-width: 0; display: grid; gap: 5px; justify-items: center; background: transparent; }
.book-swatch-bar {
  width: 100%;
  height: 34px;
  border-radius: 4px;
  border: 1px solid color-mix(in srgb, #000 8%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 16%, transparent);
  transition: transform 0.14s ease;
}
.book-swatch:hover .book-swatch-bar { transform: translateY(-2px); }
.book-swatch.on .book-swatch-bar { box-shadow: 0 0 0 1px var(--panel), 0 0 0 2px var(--ink); }
.book-swatch-label { font-size: 9px; line-height: 1.35; text-align: center; color: var(--muted); }
.book-swatch-label b { font-weight: 600; color: var(--ink); }

.book-theme-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
.book-theme {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 7px;
  border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
  border-radius: 8px;
  background: var(--panel);
  text-align: left;
  transition: border-color 0.14s ease, box-shadow 0.14s ease;
}
.book-theme:hover { border-color: color-mix(in srgb, var(--muted) 55%, var(--line)); }
.book-theme.on {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 16%, transparent);
}
/* 卡片里真正可点的部分是上半块；卸载按钮是独立的第二个控件。 */
.book-theme-pick {
  display: block;
  flex: 1;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.book-theme-pick:disabled { opacity: 0.55; cursor: default; }
.book-theme-pick:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 2px;
  border-radius: 6px;
}
/*
 * Each card paints from its own theme tokens (--pv-*, set inline from the
 * theme's light/dark palette), never from the colours currently on screen —
 * otherwise every card looked identical and 明暗 gave no visible feedback.
 */
.book-theme-preview {
  position: relative;
  height: 58px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--pv-line);
  background: var(--pv-bg);
}
.book-theme-preview .rail {
  position: absolute;
  inset: 0 auto 0 0;
  width: 8px;
  background: var(--pv-surface);
  border-right: 1px solid var(--pv-line);
}
.book-theme-preview .bar {
  position: absolute;
  left: 16px;
  height: 3px;
  border-radius: 2px;
  background: var(--pv-line);
}
.book-theme-preview .b1 { top: 13px; width: 42%; background: var(--pv-accent); }
.book-theme-preview .b2 { top: 21px; width: 55%; }
.book-theme-preview .b3 { top: 29px; width: 33%; }
.book-theme-preview .dot { position: absolute; left: 16px; bottom: 9px; width: 23px; height: 4px; border-radius: 2px; background: var(--pv-accent); }
.book-theme-preview .page {
  position: absolute;
  right: 8px;
  top: 9px;
  width: 26px;
  height: 39px;
  border-radius: 2px;
  background: var(--pv-panel);
  border: 1px solid var(--pv-line);
}
.book-theme-preview .page::before {
  content: '';
  position: absolute;
  left: 5px;
  right: 5px;
  top: 8px;
  height: 2px;
  background: var(--pv-line);
  box-shadow: 0 5px 0 color-mix(in srgb, var(--pv-line) 70%, transparent);
}
.book-theme-name {
  display: flex;
  align-items: center;
  padding: 5px 2px 1px;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--ink);
}
/* 选中标记固定在卡片右上角，压在预览缩略图的右上角上。
   它现在落在主题自己的预览底色上，所以用不透明的卡片底色 + 细边框，
   深色/浅色主题的预览里都看得清。 */
.book-theme-name .check {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--muted) 42%, transparent);
  background: var(--panel);
  box-shadow: 0 1px 3px rgb(0 0 0 / 18%);
  display: grid;
  place-items: center;
  color: transparent;
  font-size: 7px;
}
.book-theme.on .book-theme-name .check { background: var(--accent); border-color: var(--accent); color: var(--panel); }
.book-theme-desc { padding: 0 2px 1px; font-size: 9px; line-height: 1.4; color: var(--muted); }
.book-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 13px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
}
.book-row strong { font-size: 11.5px; font-weight: 600; }
.book-row:where(.book-row) > .book-seg { flex: 0 0 auto; }
.book-row-copy { min-width: 0; }
.book-hint { margin: 2px 0 0; font-size: 10px; color: var(--muted); }


/* ---------- 响应式 ---------- */
@media (max-width: 1120px) {
  .settings-workspace { grid-template-columns: 210px minmax(0, 1fr); }
  .settings-main { padding: 26px 26px 54px; }
  /* 设计图里四块卡始终一排；窗口变窄只压缩留白，不折成两行 */
  .vault-tiles { gap: 8px; }
  .vault-tile { padding: 11px 12px; gap: 9px; }
}
@media (max-width: 860px) {
  .settings-workspace { display: block; height: 100%; overflow: auto; }
  .settings-side { height: auto; border-right: 0; border-bottom: 1px solid var(--line); }
  .settings-main { overflow: visible; padding: 22px 20px 50px; }
  .settings-inner { width: 100%; }
  .status-strip { grid-template-columns: 1fr 1fr; }
  .status-strip li:nth-child(2) { border-right: 0; }
  .status-strip li:nth-child(1),
  .status-strip li:nth-child(2) { border-bottom: 1px solid var(--line); }
  .p-head { padding: 15px 16px 9px; }
  .p-head .state { display: none; }
  .p-body { padding: 0 16px 16px; }
  .book-theme-grid { grid-template-columns: 1fr; }
  .book-swatches { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .vault-head { flex-wrap: wrap; }
  .vault-tabs { width: 100%; overflow-x: auto; }
  .vault-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .settings-workspace :deep(.account-panel .login-form) { grid-template-columns: 1fr; }
}
/* 库列表在切换中：当前行压暗等待，避免连点 */
.side-vault.switching { opacity: 0.6; cursor: progress; }
.side-vaults-error { color: var(--danger); }

/* ---------- 主栏 ---------- */
.settings-main {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 30px 40px 64px;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--muted) 42%, transparent) transparent;
}
.settings-main::-webkit-scrollbar { width: 6px; }
.settings-main::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--muted) 42%, transparent);
  border-radius: 3px;
}
.settings-inner { width: min(860px, 100%); margin: 0 auto; }
.global-page { display: grid; gap: 20px; }
.panel-stack { display: flex; flex-direction: column; gap: 18px; }

/* 全局页状态条：四格读数，点击去对应面板 */
.status-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--panel) 88%, #fff 12%), var(--panel));
  overflow: hidden;
  box-shadow: 0 1px 0 color-mix(in srgb, #fff 55%, transparent) inset;
}
.status-strip li { display: flex; min-width: 0; border-right: 1px solid var(--line); }
.status-strip li:last-child { border-right: 0; }
.status-chip {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 13px;
  text-align: left;
  border-radius: 0;
  transition: background 0.14s ease;
}
button.status-chip:hover:not(:disabled) { background: color-mix(in srgb, var(--accent) 6%, transparent); }
.status-chip:focus-visible { outline-offset: -2px; }
.status-ico {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  flex: none;
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface) 72%, var(--panel));
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
}
.status-ico.on {
  background: color-mix(in srgb, var(--accent) 14%, var(--panel));
  border-color: color-mix(in srgb, var(--accent) 28%, var(--line));
}
.status-ico svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.status-copy { min-width: 0; display: grid; gap: 3px; }
.status-copy > span { display: block; font-size: 9.5px; letter-spacing: 0.06em; color: var(--muted); }
.status-copy b {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.status-copy i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--muted) 62%, transparent);
  flex: none;
}
.status-copy i.g {
  background: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 12%, transparent);
}


/* ---------- 面板 ---------- */
.panel {
  position: relative;
  width: 100%;
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-radius: 15px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--panel) 92%, #fff 8%), var(--panel));
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 18%, transparent), 0 10px 24px color-mix(in srgb, #000 5%, transparent);
  scroll-margin-top: 20px;
}
.p-head { display: flex; align-items: center; gap: 9px; padding: 18px 22px 10px; }
.p-head .ico {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--accent) 10%, var(--panel));
  color: var(--accent);
  flex: none;
}
.p-head .ico svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.55;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.p-head h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--ink);
}
.p-head .state { font-size: 10.5px; color: var(--muted); white-space: nowrap; }
.p-head::after {
  content: '';
  flex: 1 1 auto;
  min-width: 14px;
  height: 1px;
  margin: 0 4px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 16%, var(--line)), transparent);
}
.p-head-action {
  width: 28px;
  height: 28px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 7px;
  /* 常驻一点强调色：这两个是能点的动作，不该和旁边的说明文字同色。 */
  color: color-mix(in srgb, var(--accent) 72%, var(--muted));
  transition: background 0.14s ease, color 0.14s ease, transform 0.14s ease;
}
.p-head-action:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 11%, transparent);
  color: var(--accent);
}
.p-head-action:active:not(:disabled) { transform: scale(0.94); }
.p-head-action:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 1px;
  color: var(--accent);
}
.p-head-action:disabled { cursor: default; opacity: 0.38; }
.p-head-action svg {
  width: 15px;
  height: 15px;
  display: block;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
/* 旋转围绕图标盒中心，且刷新期间保持强调色，说明"正在做"。 */
.p-head-action svg.spinning {
  animation: settings-spin 0.75s linear infinite;
  transform-origin: 50% 50%;
}
.p-head-action:has(svg.spinning) { color: var(--accent); }
@keyframes settings-spin { to { transform: rotate(360deg); } }
.p-body { padding: 4px 22px 20px; }
.p-body:deep(.account-panel) { margin: 0; }


/* ---------- AccountPanel embedded in the book ---------- */
.settings-workspace :deep(.account-panel) {
  margin: 0;
  padding: 0;
  border-bottom: 0;
}
.settings-workspace :deep(.account-panel > h2),
.settings-workspace :deep(.account-panel > .settings-help.dual-product) {
  display: none;
}
.settings-workspace :deep(.account-panel .settings-help) {
  font-size: 11.5px;
  line-height: 1.6;
  margin-bottom: 12px;
}
.settings-workspace :deep(.account-panel .server-row) {
  margin-bottom: 14px;
}
.settings-workspace :deep(.account-panel .choice) {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--panel);
  border-color: color-mix(in srgb, var(--line) 92%, transparent);
  transition: border-color 0.14s ease, background 0.14s ease, box-shadow 0.14s ease;
}
.settings-workspace :deep(.account-panel .choice strong) {
  font-size: 11px;
}
.settings-workspace :deep(.account-panel .choice span) {
  font-size: 9.5px;
}
.settings-workspace :deep(.account-panel .btn-ico) {
  width: 16px;
  height: 16px;
  display: inline-grid;
  place-items: center;
  flex: none;
}
.settings-workspace :deep(.account-panel .btn-ico svg) {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.settings-workspace :deep(.account-panel .social-ico svg) {
  fill: currentColor;
  stroke: none;
}
.settings-workspace :deep(.account-panel .social-gitee .social-ico svg) {
  width: 15px;
  height: 15px;
}
.settings-workspace :deep(.account-panel .custom-server input),
.settings-workspace :deep(.account-panel .login-form input) {
  min-height: 34px;
  font-size: 12px;
  border-radius: 5px;
}
.settings-workspace :deep(.account-panel .login-form) {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 14px;
}
.settings-workspace :deep(.account-panel .login-form > .settings-help),
.settings-workspace :deep(.account-panel .login-form > .inline-error),
.settings-workspace :deep(.account-panel .login-form > .login-actions),
.settings-workspace :deep(.account-panel .login-form > .social-block),
.settings-workspace :deep(.account-panel .login-form > .social-row),
.settings-workspace :deep(.account-panel .login-form > .sync-guide) {
  grid-column: 1 / -1;
}
.settings-workspace :deep(.account-panel .password-field input) {
  padding-right: 38px;
}
.settings-workspace :deep(.account-panel .password-toggle) {
  width: 26px;
  height: 26px;
  right: 5px;
}
.settings-workspace :deep(.account-panel .password-toggle svg) {
  width: 14px;
  height: 14px;
}
.settings-workspace :deep(.account-panel .auth-sep) {
  margin: 4px 0 8px;
  font-size: 10px;
}
.settings-workspace :deep(.account-panel .login-form label) {
  font-size: 10.5px;
}
.settings-workspace :deep(.account-panel .login-actions) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
/* Third-party sign-in reads as another way in beside the primary button;
   the rule marks where its own block used to start. */
.settings-workspace :deep(.account-panel .login-actions .auth-sep) {
  margin: 0 0 0 4px;
  display: block;
}
.settings-workspace :deep(.account-panel .login-actions .auth-sep span) {
  font-size: 9.5px;
}
.settings-workspace :deep(.account-panel .login-actions .social-row) {
  display: contents;
}
.settings-workspace :deep(.account-panel .login-actions .primary),
.settings-workspace :deep(.account-panel .login-actions .ghost) {
  min-height: 34px;
  border-radius: 5px;
  font-size: 11px;
}
.settings-workspace :deep(.account-panel .sync-guide) {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
}
.settings-workspace :deep(.account-panel .sync-guide h3),
.settings-workspace :deep(.account-panel .device-panel h3),
.settings-workspace :deep(.account-panel .version-stub h3),
.settings-workspace :deep(.account-panel .plan-stub h3) {
  font-size: 11px;
}
.settings-workspace :deep(.account-panel .account-card) {
  gap: 14px;
}
.settings-workspace :deep(.account-panel .plan-grid > div) {
  padding: 8px 10px;
}
.settings-workspace :deep(.account-panel .device-row) {
  padding: 7px 0;
}
.settings-workspace :deep(.account-panel .danger) {
  min-height: 32px;
  font-size: 11px;
  color: var(--panel);
}
.settings-workspace :deep(.account-panel .server-row) {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 8px 10px;
}
.settings-workspace :deep(.account-panel .server-row > .choice) {
  width: auto;
  height: 36px;
  min-height: 36px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 8px;
}
.settings-workspace :deep(.account-panel .server-row > .choice.active) {
  border-color: color-mix(in srgb, var(--accent) 48%, var(--line));
  background: color-mix(in srgb, var(--accent) 12%, var(--panel));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
}
/* The button reports the live mode too: cloud stroke while official, a
   check once the typed address is the one in use. */
.settings-workspace :deep(.account-panel .custom-server .server-state-ico:has(.i-check)) {
  color: var(--accent);
}
.settings-workspace :deep(.account-panel .server-row > .choice strong) {
  font-size: 11px;
  font-weight: 600;
}
.settings-workspace :deep(.account-panel .server-row > .inline-error),
.settings-workspace :deep(.account-panel .server-row > .settings-help) {
  grid-column: 1 / -1;
  margin: 0;
}
.settings-workspace :deep(.account-panel .custom-server) {
  gap: 6px;
}
.settings-workspace :deep(.account-panel .custom-server .ghost) {
  min-height: 36px;
  height: 36px;
  padding: 0 12px;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 8px;
  transition: border-color 0.14s ease, background 0.14s ease, color 0.14s ease;
}
.settings-workspace :deep(.account-panel .custom-server .ghost:hover:not(:disabled)) {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--line));
  background: color-mix(in srgb, var(--accent) 8%, var(--panel));
  color: var(--accent);
}
.settings-workspace :deep(.account-panel .custom-server input) {
  height: 36px;
  min-height: 36px;
  border-radius: 8px;
}
.settings-workspace :deep(.account-panel .login-actions .primary) {
  min-width: 88px;
  padding: 0 16px;
  color: var(--panel);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border-radius: 8px;
  box-shadow: 0 1px 0 color-mix(in srgb, #fff 18%, transparent) inset;
}
.settings-workspace :deep(.account-panel .login-actions .primary:hover:not(:disabled)) {
  transform: translateY(-0.5px);
}
.settings-workspace :deep(.account-panel .primary) {
  color: var(--panel);
}
.settings-workspace :deep(.account-panel .login-actions .ghost) {
  min-height: 36px;
  padding: 0 12px;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 8px;
}
.settings-workspace :deep(.account-panel .social-row) {
  gap: 8px;
}
.settings-workspace :deep(.account-panel .social-row .ghost) {
  min-height: 36px;
  height: 36px;
  padding: 0 13px;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--panel) 70%, var(--surface));
  transition: border-color 0.14s ease, background 0.14s ease, color 0.14s ease;
}
.settings-workspace :deep(.account-panel .social-row .ghost:hover:not(:disabled)) {
  border-color: color-mix(in srgb, var(--muted) 45%, var(--line));
  background: var(--panel);
}
.settings-workspace :deep(.account-panel .social-gitee) {
  color: #c71d23;
  border-color: color-mix(in srgb, #c71d23 28%, var(--line));
}
.settings-workspace :deep(.account-panel .social-gitee:hover:not(:disabled)) {
  background: color-mix(in srgb, #c71d23 8%, var(--panel));
  border-color: color-mix(in srgb, #c71d23 42%, var(--line));
}
.settings-workspace :deep(.account-panel .social-github) {
  color: var(--ink);
  border-color: color-mix(in srgb, var(--ink) 18%, var(--line));
}
.settings-workspace :deep(.account-panel .social-github:hover:not(:disabled)) {
  background: color-mix(in srgb, var(--ink) 5%, var(--panel));
}
.settings-workspace :deep(.account-panel .sync-locked-btn) {
  min-height: 38px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  font-size: 11px;
  color: var(--muted);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface) 55%, var(--panel)), var(--panel));
  border-color: color-mix(in srgb, var(--line) 92%, transparent);
}
.settings-workspace :deep(.account-panel .sync-locked-btn .btn-ico) {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--surface) 70%, var(--panel));
  color: color-mix(in srgb, var(--muted) 80%, var(--ink));
}
</style>

