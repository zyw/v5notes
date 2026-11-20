<script setup lang="ts">
import { computed, onMounted, ref, watch, type Ref } from 'vue'
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
import type { OpenedVault } from '../vault/types'
import type { ThemeInfo } from '@v5notes/vault-plugin-api'
import type { HostCommand, HostEditorProvider, HostSettingTab, PluginRuntimeInfo } from '../plugin-host'
import { loadSafeMode } from '../plugin-host/safeMode'
import {
  ensureSampleExtensions,
  getPluginHost,
  getThemeHost,
  installFromCatalog,
  listHostCommands,
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
import { hydrateVaultRegistry, listVaultRegistry } from '../vault/recent'
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
  /** Requests the 所有库 registry panel; the shell owns opening a vault. */
  'open-registry': []
}>()

const prefs = ref<AppearancePrefs>(loadAppearancePrefs())
const safeMode = ref(loadSafeMode())
const themes = ref<ThemeInfo[]>([])
const plugins = ref<PluginRuntimeInfo[]>([])
const editors = ref<HostEditorProvider[]>([])
const activeEditorId = ref('v5-editor')
const commands = ref<HostCommand[]>([])
const settingTabs = ref<HostSettingTab[]>([])
const catalogItems = ref<CatalogItem[]>([])
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
const registryRows = ref<{ rootPath: string; name: string }[]>([])
const activeVaultRow = computed(() => {
  const path = props.vault?.rootPath
  if (!path) return null
  return { rootPath: path, name: props.vault?.name || path }
})
const vaultRows = computed(() =>
  buildSettingsVaultRows(
    registryRows.value.filter((row) => row.rootPath !== props.vault?.rootPath),
    activeVaultRow.value,
  ),
)
const hasVault = computed(() => Boolean(props.vault?.rootPath))
/** 库设置的四个页签；一次只看一块，页签和下面的卡片说同一件事。 */
type VaultTab = 'colors' | 'sync' | 'backup' | 'publish'
const vaultTab = ref<VaultTab>('colors')
const vaultTabs: { id: VaultTab; label: string; title: string }[] = [
  { id: 'colors', label: '库色', title: '库色' },
  { id: 'sync', label: '同步', title: '同步' },
  { id: 'backup', label: '备份与迁移', title: '备份与迁移' },
  { id: 'publish', label: '发布', title: '官方发布 / 分享' },
]
watch(
  () => props.vault?.rootPath,
  () => {
    vaultTab.value = 'colors'
  },
)

const publishOptions: { id: OfficialPublishVisibility; label: string }[] = [
  { id: 'private', label: '私有' },
  { id: 'unlisted', label: '不公开链接' },
  { id: 'public', label: '公开' },
]

/** 发布卡上的读数；在脚本里算，模板属性里不写箭头函数。 */
const publishVisibilityLabel = computed(
  () => publishOptions.find((option) => option.id === publishDraft.value.visibility)?.label ?? '私有',
)

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
    setVaultColorFromVault(stored)
  } catch {
    /* 读不到就用本机回退 */
  }
  vaultSwatch.value = resolveVaultColor(path)
}
void loadVaultColor(props.vault?.rootPath)

function showScope(next: SettingsScope): void {
  scope.value = next
}

async function hydrateRows(): Promise<void> {
  try {
    const entries = await hydrateVaultRegistry()
    registryRows.value = entries.map((entry) => ({
      rootPath: entry.rootPath,
      name: entry.name,
    }))
  } catch {
    registryRows.value = listVaultRegistry().map((entry) => ({
      rootPath: entry.rootPath,
      name: entry.name,
    }))
  }
}

/**
 * 库列表里点一个库 = 把它打开；打开后设置自动停在这个库的页面。
 * 外壳负责真正打开（校验目录、注册最近库），这里只负责请求与忙碌态。
 */
const switchingTo = ref<string | null>(null)
const switchError = ref('')

function activateVault(row: { rootPath: string; active: boolean; missing?: boolean }) {
  if (row.missing) return
  if (row.active) {
    showScope('vault')
    return
  }
  switchError.value = ''
  switchingTo.value = row.rootPath
  emit('switch-vault', row.rootPath)
}

function clearSwitching(): void {
  switchingTo.value = null
}

/** 外壳打开失败时把错误摆在列表里，不让点击看起来像没反应。 */
function reportSwitchFailure(message: string): void {
  switchingTo.value = null
  switchError.value = message
}

defineExpose({ clearSwitching, reportSwitchFailure })

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
const activeThemeLabel = computed(
  () => themes.value.find((t) => t.id === prefs.value.theme)?.name ?? '默认',
)
const activeColorModeLabel = computed(
  () => colorModes.find((m) => m.id === prefs.value.colorMode)?.label ?? '跟随系统',
)

function setPluginTabHost(pluginId: string, tabId: string, el: unknown): void {
  pluginTabHosts.value[pluginId + ':' + tabId] = (el as HTMLElement | null) ?? null
}

/** An empty plugin list means different things before and after the host starts. */
const hostReady = ref(false)

function pickVaultColor(id: string) {
  const path = props.vault?.rootPath
  if (!path) return
  // 先套到窗口上再落盘：两个函数都会同步 --vault，选完立刻可见。
  applyVaultColorForPath(path)
  vaultSwatch.value = setVaultColor(path, id)
  // 库色跟着库走：写进库内的 .v5notes/appearance.json，换台机器打开仍是这个颜色。
  void updateAppearanceFile(path, { vaultColor: vaultSwatch.value.id }).catch((error) => {
    colorError.value = error instanceof Error ? error.message : String(error)
  })
}

function refreshExtensionState() {
  const th = getThemeHost()
  if (th) {
    prefs.value = th.getPrefs()
    themes.value = th.list()
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
  editors.value = host?.listEditorProviders() ?? []
  activeEditorId.value = host?.getActiveEditorId() ?? 'v5-editor'
  commands.value = listHostCommands()
  settingTabs.value = listHostSettingTabs()
  safeMode.value = getPluginHost()?.isSafeMode() ?? loadSafeMode()
}

async function loadCatalog() {
  catalogBusy.value = true
  try {
    const { list, source } = await fetchCatalogList()
    catalogItems.value = list.items
    catalogSource.value = source
  } catch (error) {
    catalogMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    catalogBusy.value = false
  }
}

async function installCatalog(item: CatalogItem) {
  if (!hasVault.value) {
    catalogMessage.value = '请先打开 Vault'
    return
  }
  extensionBusy.value = true
  catalogMessage.value = ''
  try {
    await installFromCatalog(item)
    refreshExtensionState()
    // The installed item now appears under 已安装扩展; the row keeps its own outcome.
    catalogMessage.value = `已安装 ${item.name}`
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

async function installSamples() {
  extensionBusy.value = true
  pluginMessage.value = ''
  try {
    await ensureSampleExtensions()
    refreshExtensionState()
  } catch (error) {
    pluginMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    extensionBusy.value = false
  }
}

async function runCommand(cmd: HostCommand) {
  try {
    await cmd.run()
  } catch (error) {
    pluginMessage.value = error instanceof Error ? error.message : String(error)
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
    await hydrateRows()
    // 换库完成：列表退出忙碌态，错误清空。
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
        <button type="button" class="side-group-head" :class="{ on: scope === 'global' }" :aria-expanded="scope === 'global'" @click="showScope('global')">
          全局设置<span class="side-group-note">所有库</span>
        </button>
        <div v-show="scope === 'global'" class="side-items" role="group" aria-label="全局设置">
          <button type="button" class="side-nav-item" :class="{ on: scope === 'global' }" @click="scope = 'global'"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5.4" r="2.4"/><path d="M3.6 13c.4-2.4 2.2-3.8 4.4-3.8s4 1.4 4.4 3.8"/></svg>账户</button>
          <a class="side-nav-item" href="#g-appearance"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.4" y="3.2" width="11.2" height="7.2" rx="1"/><path d="M6 13h4M8 10.4V13"/></svg>主题与明暗</a>
          <a class="side-nav-item" href="#g-plugins"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.2 3.2h3.6v2.4H12v3.6h-2.2v2.4H6.2v-2.4H4V5.6h2.2z"/></svg>插件与安全</a>
          <a class="side-nav-item" href="#g-security"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.6 3.6 4.6v3.3c0 2.8 1.9 4.8 4.4 5.5 2.5-.7 4.4-2.7 4.4-5.5V4.6L8 2.6z"/></svg>安全模式</a>
          <a class="side-nav-item" href="#g-catalog"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 4h9.6M3.2 8h9.6M3.2 12h6"/></svg>插件目录</a>
          <a class="side-nav-item" href="#g-about"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.4"/><path d="M8 7.2v3.2M8 5.2h.01"/></svg>关于本机</a>
        </div>
      </div>

      <div v-if="vaultRows.length" class="side-group">
        <p class="side-group-label">库列表</p>
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
            <span class="side-vault-bar" :style="{ background: resolveVaultColor(row.rootPath).color }" aria-hidden="true"></span>
            <span class="side-vault-copy">
              <b>{{ row.name }}</b>
              <span v-if="row.missing">文件夹不在</span>
              <span v-else-if="row.rootPath === switchingTo">打开中…</span>
            </span>
            <span v-if="row.active" class="side-vault-go" aria-hidden="true"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg></span>
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
                  <button
                    v-for="theme in themes"
                    :key="theme.id"
                    class="book-theme"
                    type="button"
                    :class="{ on: prefs.theme === theme.id }"
                    :disabled="safeMode && !theme.builtin"
                    @click="setTheme(theme.id)"
                  >
                    <div class="book-theme-preview" :class="{ dusk: theme.id === 'dusk', community: theme.id !== 'default' && theme.id !== 'dusk' }">
                      <span class="rail"></span><span class="bar b1"></span><span class="bar b2"></span><span class="bar b3"></span><span class="dot"></span><span class="page"></span>
                    </div>
                    <div class="book-theme-name">{{ theme.name }}<span class="check">✓</span></div>
                    <div v-if="theme.description" class="book-theme-desc">{{ theme.description }}</div>
                  </button>
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
                <div class="book-subhead">
                  <strong>已安装扩展</strong>
                  <button class="book-ghost book-ghost--sm" type="button" :disabled="extensionBusy" @click="installSamples">
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.2v9.6M3.2 8h9.6"/></svg>
                    安装示例扩展
                  </button>
                </div>
                <ul v-if="plugins.length" class="book-list">
                  <li v-for="p in plugins" :key="p.id" class="book-list-row">
                    <div>
                      <strong>{{ p.name }}</strong><span class="book-muted"> · {{ p.id }} · {{ p.core ? '核心' : '本地' }} · {{ p.status }}</span>
                      <div class="book-mono">权限: {{ p.permissions.join(', ') || '（无）' }}</div>
                      <div v-if="p.error" class="book-danger">{{ p.error }}</div>
                    </div>
                    <button
                      v-if="p.id !== 'v5-editor'"
                      class="book-text-btn"
                      type="button"
                      :disabled="extensionBusy || (safeMode && !p.core)"
                      @click="togglePlugin(p.id, p.status !== 'loaded')"
                    >{{ p.status === 'loaded' ? '禁用' : '启用' }}</button>
                    <span v-else class="book-text-btn is-fixed">始终启用</span>
                  </li>
                </ul>
                <p v-if="!hostReady" class="book-small">扩展宿主未能启动。</p>
                <p v-else-if="!plugins.length" class="book-small">暂无已安装扩展，可安装下方插件目录中的扩展。</p>
                <div v-if="editors.length" class="book-cmd-row">
                  <p class="book-sub">笔记编辑器</p>
                  <p class="book-small">同一时间只用一个，切换后回到笔记生效；预览和编辑仍复用当前实例。默认 V5 编辑器不可禁用。</p>
                  <button
                    v-for="ed in editors"
                    :key="ed.id"
                    class="book-cmd"
                    :class="{ 'is-on': ed.id === activeEditorId }"
                    type="button"
                    :aria-pressed="ed.id === activeEditorId"
                    :disabled="extensionBusy"
                    @click="chooseEditor(ed.id)"
                  >
                    <strong>{{ ed.name }}</strong><span>{{ ed.pluginId }}</span>
                  </button>
                </div>
                <div v-if="commands.length" class="book-cmd-row">
                  <p class="book-sub">已注册命令</p>
                  <button v-for="cmd in commands" :key="cmd.pluginId + ':' + cmd.id" class="book-cmd" type="button" @click="runCommand(cmd)">
                    <strong>{{ cmd.name }}</strong><span>{{ cmd.pluginId }}:{{ cmd.id }}</span>
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

            <section class="panel" id="g-security" aria-labelledby="g-security-title">
              <div class="p-head">
                <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.6 3.6 4.6v3.3c0 2.8 1.9 4.8 4.4 5.5 2.5-.7 4.4-2.7 4.4-5.5V4.6L8 2.6z"/></svg></span>
                <h3 id="g-security-title">安全模式</h3>
                <span class="state">{{ safeMode ? '开' : '关' }}</span>
              </div>
              <div class="p-body">
                <div class="book-pref-row">
                  <div class="book-pref-copy">
                    <strong>安全模式</strong>
                    <span>{{ safeMode ? '已开启：仅核心插件与内置主题生效，社区扩展全部跳过。' : '开启后仅加载核心插件与内置主题，社区扩展全部跳过。对所有库生效。' }}</span>
                  </div>
                  <button class="book-switch" :class="{ on: safeMode }" type="button" role="switch" :aria-checked="safeMode" :disabled="extensionBusy" aria-label="安全模式" @click="toggleSafeMode"><span></span></button>
                </div>
              </div>
            </section>

            <section class="panel" id="g-catalog" aria-labelledby="g-catalog-title">
              <div class="p-head">
                <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 4h9.6M3.2 8h9.6M3.2 12h6"/></svg></span>
                <h3 id="g-catalog-title">插件目录</h3>
                <span class="state">{{ catalogSource === 'server' ? '服务器' : '本地种子' }}</span>
                <button type="button" class="p-head-action" :disabled="catalogBusy" :aria-label="catalogBusy ? '刷新中' : '刷新目录'" :title="catalogBusy ? '刷新中' : '刷新目录'" @click="loadCatalog">
                  <svg viewBox="0 0 16 16" aria-hidden="true" :class="{ spinning: catalogBusy }"><path d="M3.2 8a4.8 4.8 0 0 1 8.2-3.4M12.8 8a4.8 4.8 0 0 1-8.2 3.4"/><path d="M11.2 2.8v2.6H8.6M4.8 13.2v-2.6h2.6"/></svg>
                </button>
              </div>
              <div class="p-body">
                <div v-if="catalogItems.length" class="book-catalog-list">
                  <div v-for="item in catalogItems" :key="item.id" class="book-catalog-row">
                    <div>
                      <strong>{{ item.name }}</strong><span class="book-mono"> · {{ item.kind }} · {{ item.version }}</span>
                      <p>{{ item.description }}</p>
                      <div class="book-tags">
                        <span v-for="tag in item.tags || []" :key="tag" class="book-tag">{{ tag }}</span>
                        <span v-if="item.networkAllowlist?.length" class="book-tag">allowlist: {{ item.networkAllowlist.join(', ') }}</span>
                      </div>
                    </div>
                    <button
                      class="book-ghost book-ghost--sm"
                      type="button"
                      :disabled="extensionBusy || safeMode || !hasVault"
                      :title="safeMode ? '安全模式下不可安装' : (!hasVault ? '选择库后返回这里安装' : undefined)"
                      @click="installCatalog(item)"
                    >
                      安装
                    </button>
                  </div>
                </div>
                <p v-if="!hasVault" class="book-small">安装需要先打开一个库，装好后所有库共用。</p>
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
            <nav class="vault-tabs" role="tablist" aria-label="库设置">
              <button
                v-for="tab in vaultTabs"
                :key="tab.id"
                type="button"
                role="tab"
                :id="'vtab-' + tab.id"
                :aria-selected="vaultTab === tab.id"
                :aria-controls="`vpanel-${tab.id}`"
                :class="{ on: vaultTab === tab.id }"
                @click="vaultTab = tab.id"
              >{{ tab.label }}</button>
            </nav>
          </header>

          <!-- 四块卡是这一库的状态摘要，点哪块就展开哪块；页签只是同一件事的第二个入口。 -->
          <div class="vault-tiles">
            <button type="button" class="vault-tile" :class="{ on: vaultTab === 'colors' }" :aria-pressed="vaultTab === 'colors'" @click="vaultTab = 'colors'">
              <span class="vault-tile-ico" aria-hidden="true"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.4"/><path d="M8 2.6v10.8M2.6 8h10.8"/></svg></span>
              <span class="vault-tile-copy"><b>库色</b><span>{{ vaultSwatch ? vaultSwatch.term + ' · ' + vaultSwatch.name : '' }}</span></span>
            </button>
            <button type="button" class="vault-tile" :class="{ on: vaultTab === 'sync' }" :aria-pressed="vaultTab === 'sync'" @click="vaultTab = 'sync'">
              <span class="vault-tile-ico" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.2 8a4.8 4.8 0 0 1 8.2-3.4M12.8 8a4.8 4.8 0 0 1-8.2 3.4"/><path d="M11.2 2.8v2.6H8.6M4.8 13.2v-2.6h2.6"/></svg></span>
              <span class="vault-tile-copy"><b>同步</b><span>{{ account.loggedIn.value ? '已登录' : '未登录' }}</span></span>
            </button>
            <button type="button" class="vault-tile" :class="{ on: vaultTab === 'backup' }" :aria-pressed="vaultTab === 'backup'" @click="vaultTab = 'backup'">
              <span class="vault-tile-ico" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M8 2.8v6.4M5.6 7.2 8 9.6l2.4-2.4M3 12.4h10"/></svg></span>
              <span class="vault-tile-copy"><b>备份与迁移</b><span>{{ backupResult ? '已导出' : '未导出' }}</span></span>
            </button>
            <button type="button" class="vault-tile" :class="{ on: vaultTab === 'publish' }" :aria-pressed="vaultTab === 'publish'" @click="vaultTab = 'publish'">
              <span class="vault-tile-ico" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M8 9.4V3.2M5.8 5.4 8 3.2l2.2 2.2M3 11.4h10"/></svg></span>
              <span class="vault-tile-copy"><b>发布</b><span>{{ publishVisibilityLabel }}</span></span>
            </button>
          </div>

          <section v-show="vaultTab === 'colors'" id="vpanel-colors" class="panel" role="tabpanel" aria-labelledby="vtab-colors">
            <div class="p-head">
              <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.4"/><path d="M8 2.6v10.8M2.6 8h10.8"/></svg></span>
              <h3>库色</h3>
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

          <section v-show="vaultTab === 'sync'" id="vpanel-sync" class="panel" role="tabpanel" aria-labelledby="vtab-sync">
            <div class="p-head">
              <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 8a4.8 4.8 0 0 1 8.2-3.4M12.8 8a4.8 4.8 0 0 1-8.2 3.4"/><path d="M11.2 2.8v2.6H8.6M4.8 13.2v-2.6h2.6"/></svg></span>
              <h3>同步</h3>
              <span v-if="account.useOfficialServer.value" class="state">官方服务器</span>
              <span v-else-if="account.server.value" class="state" :title="account.server.value">{{ account.server.value.replace(/^https?:\/\//, '') }}</span>
            </div>
            <div class="p-body">
              <AccountPanel :account="account" :vault="vault" :sync="sync" mode="sync" subject="同步" hide-server />
            </div>
          </section>

          <section v-show="vaultTab === 'backup'" id="vpanel-backup" class="panel" role="tabpanel" aria-labelledby="vtab-backup">
            <div class="p-head">
              <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.8v6.4M5.6 7.2 8 9.6l2.4-2.4M3 12.4h10"/></svg></span>
              <h3>备份与迁移</h3>
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

          <section v-show="vaultTab === 'publish'" id="vpanel-publish" class="panel" role="tabpanel" aria-labelledby="vtab-publish">
            <div class="p-head">
              <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 9.4V3.2M5.8 5.4 8 3.2l2.2 2.2M3 11.4h10"/></svg></span>
              <h3>官方发布 / 分享</h3>
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
        </div>

        <!-- 没有打开的库就不出现库页：只能停在全局，入口在左栏底部。 -->
        <div v-else class="vault-empty">
          <span class="vault-empty-ico" aria-hidden="true"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 5.2 8 2.6l4.8 2.6v5.6L8 13.4 3.2 10.8V5.2z"/><path d="M3.2 5.2 8 7.8l4.8-2.6M8 7.8v5.6"/></svg></span>
          <p class="vault-empty-copy">还没打开库</p>
          <button type="button" class="side-vault-action" @click="requestVault"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.2v9.6M3.2 8h9.6"/></svg>打开库…</button>
        </div>
      </div>
    </div>
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
}
.side-group-head:hover { color: var(--accent); }
.side-group-note,
.side-group-label + .side-vaults-note {
  font-family: var(--font-mono);
  font-size: 8.5px;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: color-mix(in srgb, var(--muted) 82%, transparent);
}
.side-group-note { margin-left: auto; }
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
/* 库设置页：库名 + 路径在左、页签靠右，下面一条四块状态卡，一次只展开一块 */
.vault-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
  align-content: start;
  /* 设计图里库页占满整栏；设置页本身再宽也不把它缩成一条居中窄条 */
  width: 100%;
  max-width: none;
}
.vault-page > * { min-width: 0; }
/* 打开库页时，内层不再按全局的 860px 收窄 */
.settings-inner:has(> .vault-page) { width: 100%; max-width: none; }
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
.book-list { list-style: none; margin: 6px 0 0; padding: 0; }
.book-list-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid color-mix(in srgb, var(--line) 82%, transparent); }
.book-list-row strong { font-size: 11px; font-weight: 600; }
.book-cmd-row { margin-top: 12px; }
.book-cmd { padding: 6px 8px; margin: 0 5px 5px 0; border: 1px solid color-mix(in srgb, var(--line) 90%, transparent); border-radius: 6px; background: var(--panel); text-align: left; }
.book-cmd.is-on { border-color: var(--accent); }
.book-cmd strong { display: block; font-size: 10px; font-weight: 600; }
.book-cmd span { display: block; margin-top: 1px; font-family: var(--font-mono); font-size: 8px; color: var(--muted); }
.book-plugin-tabs { margin-top: 12px; }
.book-plugin-tab { padding: 8px 0; border-top: 1px solid color-mix(in srgb, var(--line) 82%, transparent); }
.book-plugin-tab strong { font-size: 10px; font-weight: 600; }
.book-plugin-tab-host { margin-top: 6px; font-size: 10px; color: var(--muted); }
.book-catalog-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: start; padding: 10px 0; border-bottom: 1px solid color-mix(in srgb, var(--line) 82%, transparent); }
.book-catalog-row strong { font-size: 11px; font-weight: 600; }
.book-catalog-row p { margin: 4px 0 0; font-size: 10px; line-height: 1.5; color: var(--muted); }
.book-tags { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 5px; }
.book-tag { padding: 1px 4px; border: 1px solid color-mix(in srgb, var(--line) 90%, transparent); border-radius: 3px; font-family: var(--font-mono); font-size: 8px; color: var(--muted); }

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
  min-width: 0;
  padding: 7px;
  border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
  border-radius: 8px;
  background: var(--panel);
  text-align: left;
  transition: border-color 0.14s ease, box-shadow 0.14s ease;
}
.book-theme:hover:not(:disabled) { border-color: color-mix(in srgb, var(--muted) 55%, var(--line)); }
.book-theme.on {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 16%, transparent);
}
.book-theme:disabled { opacity: 0.55; cursor: default; }
.book-theme-preview {
  position: relative;
  height: 58px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--line) 86%, transparent);
  background: var(--bg);
}
.book-theme-preview.dusk { background: #252b24; border-color: #3b4239; }
.book-theme-preview.community { background: color-mix(in srgb, var(--accent) 8%, var(--bg)); }
.book-theme-preview .rail {
  position: absolute;
  inset: 0 auto 0 0;
  width: 8px;
  background: color-mix(in srgb, var(--panel) 80%, var(--surface));
}
.book-theme-preview.dusk .rail { background: #1c211c; }
.book-theme-preview .bar {
  position: absolute;
  left: 16px;
  height: 3px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--line) 88%, transparent);
}
.book-theme-preview .b1 { top: 13px; width: 42%; background: var(--accent); }
.book-theme-preview .b2 { top: 21px; width: 55%; }
.book-theme-preview .b3 { top: 29px; width: 33%; }
.book-theme-preview .dot { position: absolute; left: 16px; bottom: 9px; width: 23px; height: 4px; background: var(--vault); }
.book-theme-preview.dusk .dot { background: #c4a882; }
.book-theme-preview .page {
  position: absolute;
  right: 8px;
  top: 9px;
  width: 26px;
  height: 39px;
  border-radius: 2px;
  background: var(--panel);
  border: 1px solid color-mix(in srgb, var(--line) 76%, transparent);
}
.book-theme-preview.dusk .page { background: #222b24; border-color: #3b4239; }
.book-theme-preview .page::before {
  content: '';
  position: absolute;
  left: 5px;
  right: 5px;
  top: 8px;
  height: 2px;
  background: color-mix(in srgb, var(--line) 88%, transparent);
  box-shadow: 0 5px 0 color-mix(in srgb, var(--line) 76%, transparent);
}
.book-theme-preview.dusk .page::before { background: #485242; box-shadow: 0 5px 0 #3e4739; }
.book-theme-name {
  display: flex;
  align-items: center;
  padding: 5px 2px 1px;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--ink);
}
.book-theme-name .check {
  margin-left: auto;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
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
  .settings-inner:has(> .vault-page) { width: 100%; max-width: none; }
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
  color: var(--muted);
  transition: background 0.14s ease, color 0.14s ease;
}
.p-head-action:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 9%, transparent);
  color: var(--accent);
}
.p-head-action svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.p-head-action svg.spinning { animation: settings-spin 0.8s linear infinite; }
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

