<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import AccountPanel from '../components/AccountPanel.vue'
import brandIcon from '../assets/brand-icon.png'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import type { AccountState } from '../account'
import type { SyncCoordinatorHandles } from '../sync'
import {
  CLOUD_PRODUCT_DISPLAY_NAME,
  DUAL_PRODUCT_HELP,
  DUAL_PRODUCT_LINE,
  PRODUCT_DISPLAY_NAME,
} from '../account/constants'
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
  type VaultColorSwatch,
} from '../appearance/vaultColors'
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
} from '../extension/runtime'
import { fetchCatalogList, type CatalogItem } from '../catalog'
import {
  BACKUP_NOT_SYNC_LINE,
  BACKUP_SCOPE_HELP,
  MIGRATION_EXPLICIT_LINE,
  MIGRATION_STEPS_HELP,
  backupVaultToZip,
} from '../backup'
import {
  OFFICIAL_PUBLISH_LEAD,
  OFFICIAL_PUBLISH_STUB_HELP,
  OFFICIAL_PUBLISH_TITLE,
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
const extensionMessage = ref('')
const themeError = ref<string | null>(null)
const pluginTabHosts: Ref<Record<string, HTMLElement | null>> = ref({})
const backupBusy = ref(false)
const backupMessage = ref('')
const migrationAck = ref(false)
const migrationMessage = ref('')
const publishDraft = ref<OfficialPublishDraft>(loadOfficialPublishDraft())
const publishMessage = ref('')
const showMigrationConfirm = ref(false)

const panelIds = ['p-account', 'p-backup', 'p-publish', 'p-appearance', 'p-plugins', 'p-catalog', 'p-help', 'p-about'] as const
const activePanel = ref('p-account')
const mainScroll = ref<HTMLElement | null>(null)

const publishOptions: { id: OfficialPublishVisibility; label: string }[] = [
  { id: 'private', label: '私有' },
  { id: 'unlisted', label: '不公开链接' },
  { id: 'public', label: '公开' },
]

const colorModes: { id: ColorMode; label: string }[] = [
  { id: 'system', label: '跟随系统' },
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' },
]

function setPluginTabHost(pluginId: string, tabId: string, el: unknown): void {
  pluginTabHosts.value[pluginId + ':' + tabId] = (el as HTMLElement | null) ?? null
}

function scrollToPanel(id: string): void {
  activePanel.value = id
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function onMainScroll(): void {
  const root = mainScroll.value
  if (!root) return
  const marker = root.getBoundingClientRect().top + 140
  let current: string = panelIds[0]
  for (const id of panelIds) {
    const el = document.getElementById(id)
    if (el && el.getBoundingClientRect().top <= marker) current = id
  }
  activePanel.value = current
}

const hasVault = computed(() => Boolean(props.vault?.rootPath))
const vaultSwatch = ref<VaultColorSwatch | null>(
  props.vault?.rootPath ? resolveVaultColor(props.vault.rootPath) : null,
)

watch(
  () => props.vault?.rootPath,
  path => {
    vaultSwatch.value = path ? applyVaultColorForPath(path) : null
  },
)

function pickVaultColor(id: string) {
  if (!props.vault?.rootPath) return
  vaultSwatch.value = setVaultColor(props.vault.rootPath, id)
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
  plugins.value = listPluginInfos()
  const host = getPluginHost()
  editors.value = host?.listEditorProviders() ?? []
  activeEditorId.value = host?.getActiveEditorId() ?? 'v5-editor'
  commands.value = listHostCommands()
  settingTabs.value = listHostSettingTabs()
  safeMode.value = getPluginHost()?.isSafeMode() ?? loadSafeMode()
  void nextTick(() => {
    for (const tab of settingTabs.value) {
      const key = `${tab.pluginId}:${tab.id}`
      const el = pluginTabHosts.value[key]
      if (el) {
        el.innerHTML = ''
        void tab.display(el)
      }
    }
  })
}

async function loadCatalog() {
  catalogBusy.value = true
  try {
    const { list, source } = await fetchCatalogList()
    catalogItems.value = list.items
    catalogSource.value = source
  } catch (error) {
    extensionMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    catalogBusy.value = false
  }
}

async function installCatalog(item: CatalogItem) {
  if (!hasVault.value) {
    extensionMessage.value = '请先打开 Vault'
    return
  }
  extensionBusy.value = true
  extensionMessage.value = ''
  try {
    await installFromCatalog(item)
    refreshExtensionState()
    extensionMessage.value = `已从 catalog 安装 ${item.name}（${item.kind}）`
  } catch (error) {
    extensionMessage.value = error instanceof Error ? error.message : String(error)
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
  extensionMessage.value = ''
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
  extensionMessage.value = ''
  try {
    const next = !safeMode.value
    await setSafeModeAndReload(next)
    refreshExtensionState()
    extensionMessage.value = next
      ? '已开启安全模式：社区插件跳过，主题回退内置'
      : '已关闭安全模式'
  } catch (error) {
    extensionMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    extensionBusy.value = false
  }
}

async function chooseEditor(id: string) {
  const host = getPluginHost()
  if (!host) {
    extensionMessage.value = '请先打开 Vault'
    return
  }
  extensionBusy.value = true
  try {
    host.setActiveEditor(id)
    refreshExtensionState()
    extensionMessage.value = '已切换编辑器。回到笔记后生效。'
  } catch (error) {
    extensionMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    extensionBusy.value = false
  }
}

async function togglePlugin(id: string, enabled: boolean) {
  const host = getPluginHost()
  if (!host) {
    extensionMessage.value = '请先打开 Vault'
    return
  }
  extensionBusy.value = true
  try {
    await host.setEnabled(id, enabled)
    refreshExtensionState()
  } catch (error) {
    extensionMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    extensionBusy.value = false
  }
}

async function installSamples() {
  extensionBusy.value = true
  extensionMessage.value = ''
  try {
    await ensureSampleExtensions()
    refreshExtensionState()
    extensionMessage.value = '已安装示例：hello-world、safe-fetch-demo + Forest Ink 主题'
  } catch (error) {
    extensionMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    extensionBusy.value = false
  }
}

async function runCommand(cmd: HostCommand) {
  try {
    await cmd.run()
  } catch (error) {
    extensionMessage.value = error instanceof Error ? error.message : String(error)
  }
}

async function runBackup() {
  if (!props.vault?.rootPath) {
    backupMessage.value = '请先打开 Vault'
    return
  }
  backupBusy.value = true
  backupMessage.value = ''
  try {
    const result = await backupVaultToZip(props.vault.rootPath, {
      vaultName: props.vault.name,
    })
    if (!result) {
      backupMessage.value = '已取消保存'
      return
    }
    backupMessage.value = `已备份 ${result.fileCount} 个文件（${Math.round(result.bytes / 1024)} KiB）→ ${result.savedPath}。${BACKUP_NOT_SYNC_LINE}`
  } catch (error) {
    backupMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    backupBusy.value = false
  }
}

function requestMigrationGuide() {
  migrationMessage.value = ''
  showMigrationConfirm.value = true
}

function confirmMigrationGuide() {
  showMigrationConfirm.value = false
  migrationAck.value = true
  migrationMessage.value = `${MIGRATION_EXPLICIT_LINE} ${MIGRATION_STEPS_HELP}`
}

function cancelMigrationGuide() {
  showMigrationConfirm.value = false
}

function setPublishVisibility(visibility: OfficialPublishVisibility) {
  publishDraft.value = { ...publishDraft.value, visibility }
}

function savePublishDraft() {
  publishMessage.value = ''
  try {
    assertOfficialPublishChannel(publishDraft.value.channel)
    publishDraft.value = saveOfficialPublishDraft(publishDraft.value)
    publishMessage.value =
      '已保存本机预览偏好（官方通道）。尚未创建公开站点；完整托管后仍不会对第三方插件开放 publish。'
  } catch (error) {
    publishMessage.value = error instanceof Error ? error.message : String(error)
  }
}

onMounted(() => {
  refreshExtensionState()
  void loadCatalog()
  publishDraft.value = loadOfficialPublishDraft()
  void nextTick(() => {
    mainScroll.value?.addEventListener('scroll', onMainScroll, { passive: true })
    onMainScroll()
  })
})

onUnmounted(() => {
  mainScroll.value?.removeEventListener('scroll', onMainScroll)
})
watch(
  () => props.vault?.rootPath,
  () => refreshExtensionState(),
)
</script>

<template>
  <section class="settings-workspace" aria-labelledby="settings-title">
    <aside class="settings-side">
      <div class="side-brand">
        <img :src="brandIcon" alt="">
        <div><b>V5Notes</b><small>VAULT · 2.1.0</small></div>
      </div>
      <div class="side-title"><h1 id="settings-title">设置</h1><span>08</span></div>
      <p class="side-sub">本地优先 · 本机偏好</p>

      <nav class="side-nav" aria-label="设置分区">
        <button type="button" class="side-nav-item" :class="{ on: activePanel === 'p-account' }" @click="scrollToPanel('p-account')">
          <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5.4" r="2.4"/><path d="M3.6 13c.4-2.4 2.2-3.8 4.4-3.8s4 1.4 4.4 3.8"/></svg>
          账户<span class="n">01</span>
        </button>
        <button type="button" class="side-nav-item" :class="{ on: activePanel === 'p-backup' }" @click="scrollToPanel('p-backup')">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.8v6.4M5.6 7.2 8 9.6l2.4-2.4M3 12.4h10"/></svg>
          备份与迁移<span class="n">02</span>
        </button>
        <button type="button" class="side-nav-item" :class="{ on: activePanel === 'p-publish' }" @click="scrollToPanel('p-publish')">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 9.4V3.2M5.8 5.4 8 3.2l2.2 2.2M3 11.4h10"/></svg>
          官方发布 / 分享<span class="n">03</span>
        </button>
        <button type="button" class="side-nav-item" :class="{ on: activePanel === 'p-appearance' }" @click="scrollToPanel('p-appearance')">
          <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.4"/><path d="M8 2.6v10.8M2.6 8h10.8"/></svg>
          外观<span class="n">04</span>
        </button>
        <button type="button" class="side-nav-item" :class="{ on: activePanel === 'p-plugins' }" @click="scrollToPanel('p-plugins')">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.2 3.2h3.6v2.4H12v3.6h-2.2v2.4H6.2v-2.4H4V5.6h2.2z"/></svg>
          插件与安全<span class="n">05</span>
        </button>
        <button type="button" class="side-nav-item" :class="{ on: activePanel === 'p-catalog' }" @click="scrollToPanel('p-catalog')">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 4h9.6M3.2 8h9.6M3.2 12h6"/></svg>
          插件目录<span class="n">06</span>
        </button>
        <button type="button" class="side-nav-item" :class="{ on: activePanel === 'p-help' }" @click="scrollToPanel('p-help')">
          <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.4"/><path d="M6.4 6.2a1.7 1.7 0 0 1 3.3.6c0 1.1-1.7 1.4-1.7 2.4M8 11.5h.01"/></svg>
          帮助 · 双产品<span class="n">07</span>
        </button>
        <button type="button" class="side-nav-item" :class="{ on: activePanel === 'p-about' }" @click="scrollToPanel('p-about')">
          <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.4"/><path d="M8 7.2v3.2M8 5.2h.01"/></svg>
          关于本机<span class="n">08</span>
        </button>
      </nav>

      <div class="side-sep"></div>
      <p class="side-note">账号登录可选。未登录仍可建库、写笔记与搜索；同步只在登录后启用。</p>

      <div class="side-foot">
        <span class="side-avatar">V</span>
        <div>
          <b>{{ account.loggedIn.value ? '已登录' : '未登录' }}</b>
          <span>{{ vault?.name || '未打开库' }} · {{ hasVault ? '本地编辑' : '本机模式' }}</span>
        </div>
      </div>
    </aside>

    <div ref="mainScroll" class="settings-main">
      <div class="settings-inner">
        <div class="content-meta">
          <span>SETTINGS / 本机偏好</span>
          <span class="live"><i></i>LOCAL FIRST · 无云端依赖</span>
        </div>

        <p class="lede">本地 Vault 优先。账号登录可选；插件与主题经 PluginHost / Theme API 代理，<em>非进程隔离</em>。</p>

        <ul class="status-strip" aria-label="当前状态">
          <li>
            <span class="status-ico" aria-hidden="true">
              <svg viewBox="0 0 16 16"><path d="M3.2 5.2 8 2.6l4.8 2.6v5.6L8 13.4 3.2 10.8V5.2z"/><path d="M8 7.2v3.2"/></svg>
            </span>
            <div class="status-copy">
              <span>本地库</span>
              <b><i class="g"></i>{{ vault?.name || '未打开库' }}</b>
            </div>
          </li>
          <li>
            <span class="status-ico" aria-hidden="true">
              <svg viewBox="0 0 16 16"><circle cx="8" cy="5.4" r="2.4"/><path d="M3.6 13c.4-2.4 2.2-3.8 4.4-3.8s4 1.4 4.4 3.8"/></svg>
            </span>
            <div class="status-copy">
              <span>账号</span>
              <b><i :class="{ g: account.loggedIn.value }"></i>{{ account.loggedIn.value ? '已登录' : '未登录' }}</b>
            </div>
          </li>
          <li>
            <span class="status-ico" aria-hidden="true">
              <svg viewBox="0 0 16 16"><path d="M3.2 8a4.8 4.8 0 0 1 8.2-3.4M12.8 8a4.8 4.8 0 0 1-8.2 3.4"/><path d="M11.2 2.8v2.6H8.6M4.8 13.2v-2.6h2.6"/></svg>
            </span>
            <div class="status-copy">
              <span>同步</span>
              <b><i :class="{ g: account.loggedIn.value && hasVault }"></i>{{ account.loggedIn.value && hasVault ? '已连接' : '待登录' }}</b>
            </div>
          </li>
          <li>
            <span class="status-ico" :class="{ on: safeMode }" aria-hidden="true">
              <svg viewBox="0 0 16 16"><path d="M8 2.6 3.6 4.6v3.3c0 2.8 1.9 4.8 4.4 5.5 2.5-.7 4.4-2.7 4.4-5.5V4.6L8 2.6z"/></svg>
            </span>
            <div class="status-copy">
              <span>安全模式</span>
              <b><i :class="{ g: safeMode }"></i>{{ safeMode ? '开' : '关' }}</b>
            </div>
          </li>
        </ul>

        <div class="panel-stack">
          <section class="panel p-account" id="p-account" aria-labelledby="panel-account-title">
            <div class="p-head">
              <span class="no">01</span>
              <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5.4" r="2.4"/><path d="M3.6 13c.4-2.4 2.2-3.8 4.4-3.8s4 1.4 4.4 3.8"/></svg></span>
              <h3 id="panel-account-title">账户</h3>
              <span class="state">官方服务器 · vault_client</span>
            </div>
            <div class="p-body">
              <p class="p-lead">同一账号可登录两个客户端；Cloud 笔记与 Vault 库默认不是同一份数据。Vault 始终在本机文件夹。</p>
              <AccountPanel :account="account" :vault="vault" :sync="sync" />
            </div>
          </section>

          <section class="panel p-backup" id="p-backup" aria-labelledby="panel-backup-title">
            <div class="p-head">
              <span class="no">02</span>
              <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.8v6.4M5.6 7.2 8 9.6l2.4-2.4M3 12.4h10"/></svg></span>
              <h3 id="panel-backup-title">备份与迁移</h3>
              <span class="state">非 Sync</span>
            </div>
            <div class="p-body">
              <p class="p-lead">整库 zip 仅作备份与迁机，不是日常同步。日常 Sync 走文件级增量；请勿用 zip 覆盖当作 Sync。</p>
              <div class="book-note">{{ BACKUP_SCOPE_HELP }}</div>
              <div class="book-actions">
                <button class="book-action" type="button" :disabled="backupBusy || !hasVault" @click="runBackup">
                  <span class="book-action-icon"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.8v6.4M5.6 7.2 8 9.6l2.4-2.4M3 12.4h10"/></svg></span>
                  <span class="book-action-copy">
                    <strong>{{ backupBusy ? '正在打包…' : '导出整库 zip' }}</strong>
                    <span>仅备份 · 非 Sync · {{ vault?.name || '当前库' }}</span>
                  </span>
                  <span class="book-action-go">EXPORT →</span>
                </button>
                <button class="book-action" type="button" @click="requestMigrationGuide">
                  <span class="book-action-icon"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5.4h9.2M10 3.2l2.2 2.2L10 7.6M13 10.6H3.8M6 8.4l-2.2 2.2L6 12.8"/></svg></span>
                  <span class="book-action-copy">
                    <strong>Cloud ↔ Vault 迁移说明</strong>
                    <span>显式确认 · 不自动合并</span>
                  </span>
                  <span class="book-action-go">READ →</span>
                </button>
              </div>
              <p v-if="!hasVault" class="book-small">打开 Vault 后可导出备份。</p>
              <p v-if="backupMessage" class="book-small" role="status">{{ backupMessage }}</p>
              <p v-if="migrationAck" class="book-small" role="status">{{ migrationMessage }}</p>
            </div>
          </section>

          <section class="panel p-publish" id="p-publish" aria-labelledby="panel-publish-title">
            <div class="p-head">
              <span class="no">03</span>
              <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 9.4V3.2M5.8 5.4 8 3.2l2.2 2.2M3 11.4h10"/></svg></span>
              <h3 id="panel-publish-title">官方发布 / 分享</h3>
              <span class="state">预览</span>
            </div>
            <div class="p-body">
              <p class="p-lead">站点发布与分享是 V5Notes 官方产品能力，不向社区第三方插件开放。插件无法申请 publish:*。</p>
              <div class="book-note">{{ OFFICIAL_PUBLISH_STUB_HELP }}</div>
              <label class="book-field">
                <span>站点标题（本机预览）</span>
                <input v-model="publishDraft.siteTitle" type="text" maxlength="100" placeholder="例如：公开读书笔记" autocomplete="off">
              </label>
              <div class="book-field-label">可见性</div>
              <div class="book-seg book-seg--three" role="group" aria-label="可见性预览">
                <button v-for="opt in publishOptions" :key="opt.id" type="button" :class="{ on: publishDraft.visibility === opt.id }" @click="setPublishVisibility(opt.id)">{{ opt.label }}</button>
              </div>
              <div class="book-inline">
                <button class="book-primary" type="button" @click="savePublishDraft">
                  <span class="book-primary-ico" aria-hidden="true">
                    <svg viewBox="0 0 16 16"><path d="M8 9.4V3.2M5.8 5.4 8 3.2l2.2 2.2M3 11.4h10"/></svg>
                  </span>
                  保存官方通道预览
                </button>
                <span class="book-mono">channel=product · status=preview</span>
              </div>
              <p v-if="publishMessage" class="book-small" role="status">{{ publishMessage }}</p>
            </div>
          </section>

          <section class="panel p-appearance" id="p-appearance" aria-labelledby="panel-appearance-title">
            <div class="p-head">
              <span class="no">04</span>
              <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.4"/><path d="M8 2.6v10.8M2.6 8h10.8"/></svg></span>
              <h3 id="panel-appearance-title">外观</h3>
              <span class="state">默认 · 跟随系统</span>
            </div>
            <div class="p-body">
              <p class="p-lead">内置主题始终可回退。社区主题需通过 CSS 变量校验；非法规则会回退默认并提示。</p>
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
                  <div class="book-theme-desc">{{ theme.description || (theme.builtin ? '内置' : '库内/示例主题') }}</div>
                </button>
              </div>
              <div class="book-row">
                <div><strong>色模式</strong><p class="book-hint">跟随系统，或固定浅色 / 深色。</p></div>
                <div class="book-seg" role="group" aria-label="色模式">
                  <button v-for="mode in colorModes" :key="mode.id" type="button" :class="{ on: prefs.colorMode === mode.id }" @click="setColorMode(mode.id)">{{ mode.label }}</button>
                </div>
              </div>
              <div v-if="hasVault && vaultSwatch" class="book-colors">
                <div class="book-colors-head"><strong>当前库色</strong><span>{{ vaultSwatch.term }} · {{ vaultSwatch.name }}</span></div>
                <div class="book-swatches" role="group" aria-label="库色">
                  <button
                    v-for="swatch in VAULT_COLOR_PALETTE"
                    :key="swatch.id"
                    type="button"
                    class="book-swatch"
                    :class="{ on: vaultSwatch.id === swatch.id }"
                    :aria-pressed="vaultSwatch.id === swatch.id"
                    :title="swatch.term + ' · ' + swatch.name"
                    @click="pickVaultColor(swatch.id)"
                  >
                    <span class="book-swatch-bar" :style="{ background: swatch.color }"></span>
                    <span class="book-swatch-label"><b>{{ swatch.term }}</b><br>{{ swatch.name }}</span>
                  </button>
                </div>
              </div>
              <p v-if="themeError" class="book-small" role="status">{{ themeError }}</p>
            </div>
          </section>

          <section class="panel p-plugins" id="p-plugins" aria-labelledby="panel-plugins-title">
            <div class="p-head">
              <span class="no">05</span>
              <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.2 3.2h3.6v2.4H12v3.6h-2.2v2.4H6.2v-2.4H4V5.6h2.2z"/></svg></span>
              <h3 id="panel-plugins-title">插件与安全</h3>
              <span class="state">安全模式：{{ safeMode ? '开' : '关' }}</span>
            </div>
            <div class="p-body">
              <p class="p-lead">P1 威胁模型：同页 JS + 权限代理 + Safe Mode。Token 不对插件暴露；网络仅 network:safe（白名单）。</p>
              <div class="book-pref-row">
                <div class="book-pref-copy"><strong>安全模式</strong><span>开启后仅加载核心插件 + 内置主题；社区扩展全部跳过。</span></div>
                <button class="book-switch" :class="{ on: safeMode }" type="button" role="switch" :aria-checked="safeMode" :disabled="extensionBusy" aria-label="安全模式" @click="toggleSafeMode"><span></span></button>
              </div>
              <div class="book-subhead">
                <strong>已安装扩展</strong>
                <button class="book-ghost book-ghost--sm" type="button" :disabled="extensionBusy" @click="installSamples">安装示例扩展</button>
              </div>
              <p v-if="!hasVault" class="book-small">打开 Vault 后可启用库内插件与示例主题。</p>
              <ul v-if="plugins.length" class="book-list">
                <li v-for="p in plugins" :key="p.id" class="book-list-row">
                  <div>
                    <strong>{{ p.name }}</strong><span class="book-muted"> · {{ p.id }} · {{ p.core ? '核心' : '本地' }} · {{ p.status }}</span>
                    <div class="book-mono">权限: {{ p.permissions.join(', ') || '（无）' }}</div>
                    <div v-if="p.error" class="book-danger">{{ p.error }}</div>
                  </div>
                  <button class="book-text-btn" type="button" :disabled="extensionBusy || p.id === 'v5-editor' || (safeMode && !p.core)" @click="togglePlugin(p.id, p.status !== 'loaded')">{{ p.id === 'v5-editor' ? '始终启用' : p.status === 'loaded' ? '禁用' : '启用' }}</button>
                </li>
              </ul>
              <p v-if="hasVault && !plugins.length" class="book-small">暂无已安装扩展。</p>
              <div v-if="editors.length" class="book-cmd-row">
                <p class="book-mono">笔记编辑器</p>
                <p class="book-small">同一时间只用一个。切换后回到笔记生效。预览和编辑仍复用当前实例。默认 V5 编辑器不能禁用；启用「纯文本」后可以换过去。</p>
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
                <p class="book-mono">已注册命令</p>
                <button v-for="cmd in commands" :key="cmd.pluginId + ':' + cmd.id" class="book-cmd" type="button" @click="runCommand(cmd)">
                  <strong>{{ cmd.name }}</strong><span>{{ cmd.pluginId }}:{{ cmd.id }}</span>
                </button>
              </div>
              <div v-if="settingTabs.length" class="book-plugin-tabs">
                <p class="book-mono">插件设置页（SettingTab）</p>
                <div v-for="tab in settingTabs" :key="tab.pluginId + ':' + tab.id" class="book-plugin-tab">
                  <strong>{{ tab.name }}</strong>
                  <div class="book-plugin-tab-host" :ref="el => setPluginTabHost(tab.pluginId, tab.id, el)"></div>
                </div>
              </div>
              <p v-if="extensionMessage" class="book-small" role="status">{{ extensionMessage }}</p>
            </div>
          </section>

          <section class="panel p-catalog" id="p-catalog" aria-labelledby="panel-catalog-title">
            <div class="p-head">
              <span class="no">06</span>
              <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 4h9.6M3.2 8h9.6M3.2 12h6"/></svg></span>
              <h3 id="panel-catalog-title">插件目录</h3>
              <span class="state">本地种子</span>
            </div>
            <div class="p-body">
              <p class="p-lead">/vault/v1/catalog/... 与文件 sync 协议解耦（catalogProtocolVersion 独立）。拒绝 publishing 标签；无第三方发布。</p>
              <div class="book-catalog-head">
                <span class="book-mono">来源：{{ catalogSource === 'server' ? '服务器' : '本地种子' }}</span>
                <button class="book-text-btn" type="button" :disabled="catalogBusy" @click="loadCatalog">{{ catalogBusy ? '刷新中…' : '刷新目录' }}</button>
              </div>
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
                  <button class="book-ghost book-ghost--sm" type="button" :disabled="extensionBusy || !hasVault || safeMode" @click="installCatalog(item)">安装</button>
                </div>
              </div>
              <p v-if="extensionMessage" class="book-small" role="status">{{ extensionMessage }}</p>
            </div>
          </section>

          <section class="panel p-help" id="p-help" aria-labelledby="panel-help-title">
            <div class="p-head">
              <span class="no">07</span>
              <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.4"/><path d="M6.4 6.2a1.7 1.7 0 0 1 3.3.6c0 1.1-1.7 1.4-1.7 2.4M8 11.5h.01"/></svg></span>
              <h3 id="panel-help-title">帮助 · 双产品</h3>
              <span class="state">两套空间</span>
            </div>
            <div class="p-body">
              <p class="p-lead">两件产品共用一套账号，但笔记空间分开。登录同一账号不会自动合并两边内容。</p>
              <div class="book-note book-note--accent">{{ DUAL_PRODUCT_LINE }}</div>
              <div class="book-note">{{ DUAL_PRODUCT_HELP }}</div>
              <dl class="book-meta">
                <div><dt>本客户端</dt><dd>{{ PRODUCT_DISPLAY_NAME }}</dd></div>
                <div><dt>并列产品</dt><dd>{{ CLOUD_PRODUCT_DISPLAY_NAME }}（不做 Vault 插件宿主）</dd></div>
                <div><dt>边界</dt><dd>两套笔记空间，不静默双向同步</dd></div>
              </dl>
            </div>
          </section>

          <section class="panel p-about" id="p-about" aria-labelledby="panel-about-title">
            <div class="p-head">
              <span class="no">08</span>
              <span class="ico"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.4"/><path d="M8 7.2v3.2M8 5.2h.01"/></svg></span>
              <h3 id="panel-about-title">关于本机</h3>
              <span class="state">V5Notes Vault · 2.1.0</span>
            </div>
            <div class="p-body">
              <p class="p-lead">安装信息与扩展边界。此页只读，不写入任何云端记录。</p>
              <dl class="book-meta book-meta--about">
                <div><dt>产品</dt><dd>V5Notes Vault</dd></div>
                <div><dt>Bundle ID</dt><dd><code>xin.v5ai.v5notes.vault</code></dd></div>
                <div><dt>Deep link</dt><dd><code>v5notes-vault://</code></dd></div>
                <div><dt>扩展</dt><dd>Phase 8 · 官方发布 stub · 备份 zip · 双产品收尾</dd></div>
              </dl>
              <div class="book-note">设置即时保存，仅写入本机偏好。账号密码不会被保存到本地；登录状态与库绑定分别存放。</div>
            </div>
          </section>
        </div>
      </div>
    </div>

    <ConfirmDialog
      :open="showMigrationConfirm"
      title="Cloud ↔ Vault 迁移"
      :message="MIGRATION_EXPLICIT_LINE + ' 继续仅展示迁移步骤，不会改动任何笔记。'"
      confirm-label="我明白，显示步骤"
      @cancel="cancelMigrationGuide"
      @confirm="confirmMigrationGuide"
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
.side-brand small {
  display: block;
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: 7.5px;
  letter-spacing: 0.12em;
  color: var(--muted);
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
.side-title span {
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.side-sub {
  margin: 5px 6px 0;
  font-size: 10.5px;
  color: var(--muted);
}

.side-nav {
  margin-top: 18px;
  display: grid;
  gap: 2px;
}
.side-nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 32px;
  padding: 0 9px;
  border-radius: 7px;
  color: var(--muted);
  text-align: left;
  font-size: 12px;
  transition: background 0.14s ease, color 0.14s ease;
}
.side-nav-item svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.55;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex: none;
}
.side-nav-item .n {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 8px;
  color: color-mix(in srgb, var(--muted) 72%, transparent);
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
.side-nav-item.on .n {
  color: var(--accent);
}

.side-sep {
  margin: 14px 9px;
  border-top: 1px solid var(--line);
}
.side-note {
  margin: 0 9px;
  font-size: 9.5px;
  line-height: 1.65;
  color: var(--muted);
}
.side-foot {
  margin-top: auto;
  padding: 10px 8px 0;
  border-top: 1px solid var(--line);
  display: flex;
  align-items: center;
  gap: 9px;
}
.side-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 10%, var(--panel));
  display: grid;
  place-items: center;
  color: var(--accent);
  font-size: 10px;
  font-weight: 700;
}
.side-foot b {
  display: block;
  font-size: 10px;
  font-weight: 600;
}
.side-foot span {
  display: block;
  margin-top: 1px;
  font-family: var(--font-mono);
  font-size: 7.5px;
  color: var(--muted);
}

/* ---------- main ---------- */
.settings-main {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 32px 40px 64px;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--muted) 42%, transparent) transparent;
}
.settings-main::-webkit-scrollbar {
  width: 6px;
}
.settings-main::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--muted) 42%, transparent);
  border-radius: 3px;
}
.settings-inner {
  width: min(820px, 100%);
  margin: 0 auto;
}

.content-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.06em;
  color: var(--muted);
}
.content-meta .live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.content-meta .live i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 12%, transparent);
}

.lede {
  margin: 22px 0 0;
  max-width: 620px;
  font-family: var(--font-display);
  font-size: 16px;
  line-height: 1.85;
  letter-spacing: 0.005em;
  color: var(--ink);
}
.lede em {
  font-style: normal;
  color: var(--muted);
}

.status-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: 12px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 88%, #fff 12%), var(--panel));
  overflow: hidden;
  box-shadow: 0 1px 0 color-mix(in srgb, #fff 55%, transparent) inset;
}
.status-strip li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 13px;
  border-right: 1px solid var(--line);
  min-width: 0;
}
.status-strip li:last-child {
  border-right: 0;
}
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
.status-copy {
  min-width: 0;
}
.status-strip li .status-copy > span {
  display: block;
  font-size: 9.5px;
  letter-spacing: 0.06em;
  color: var(--muted);
}
.status-strip li b {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 3px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.status-strip li i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--muted) 62%, transparent);
  flex: none;
}
.status-strip li i.g {
  background: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 12%, transparent);
}

/* ---------- panels ---------- */
.panel-stack {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 22px;
}

.panel {
  position: relative;
  width: 100%;
  padding: 0;
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-radius: 15px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--panel) 92%, #fff 8%),
    var(--panel)
  );
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #fff 18%, transparent),
    0 10px 24px color-mix(in srgb, #000 5%, transparent);
  scroll-margin-top: 20px;
}

.p-head {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 18px 22px 10px;
}
.p-head .no {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--vault);
  letter-spacing: 0.02em;
  order: 0;
}
.p-head .ico {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--accent) 10%, var(--panel));
  color: var(--accent);
  flex: none;
  order: 0;
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
  order: 0;
}
.p-head .state {
  font-size: 10.5px;
  color: var(--muted);
  white-space: nowrap;
  order: 2;
}
.p-head::after {
  content: '';
  flex: 1 1 auto;
  min-width: 14px;
  height: 1px;
  margin: 0 4px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent) 16%, var(--line)),
    color-mix(in srgb, var(--accent) 7%, var(--line)) 70%,
    transparent
  );
  order: 1;
}

.p-body {
  padding: 0 22px 20px;
}
.p-lead {
  margin: 0 0 14px;
  max-width: 680px;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--muted);
}


/* ---------- shared chapter content ---------- */
.book-note {
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
  border-left: 2px solid color-mix(in srgb, var(--muted) 48%, var(--line));
  background: color-mix(in srgb, var(--panel) 72%, var(--surface));
  font-size: 11.5px;
  line-height: 1.65;
  color: var(--muted);
}
.book-note + .book-note {
  margin-top: 8px;
}
.book-note b {
  color: var(--ink);
  font-weight: 600;
}
.book-note code,
.book-meta code {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--ink);
}
.book-note--accent {
  border-color: color-mix(in srgb, var(--accent) 24%, var(--line));
  border-left-color: color-mix(in srgb, var(--accent) 55%, var(--line));
  background: color-mix(in srgb, var(--accent) 7%, var(--panel));
}

.book-meta {
  margin: 14px 0 0;
  display: grid;
  border-top: 1px solid color-mix(in srgb, var(--line) 86%, transparent);
}
.book-meta > div {
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr);
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 76%, transparent);
  font-size: 11.5px;
}
.book-meta dt {
  color: color-mix(in srgb, var(--muted) 82%, transparent);
}
.book-meta dd {
  margin: 0;
  color: var(--ink);
}

.book-field {
  display: grid;
  gap: 5px;
  margin-top: 14px;
}
.book-field > span,
.book-field-label {
  font-size: 9.5px;
  letter-spacing: 0.04em;
  color: var(--muted);
}
.book-field-label {
  display: block;
  margin: 13px 0 7px;
}
.book-field input,
.book-input {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
  border-radius: 5px;
  background: var(--panel);
  color: var(--ink);
  font-size: 12px;
  box-shadow: inset 0 1px 2px color-mix(in srgb, #000 5%, transparent);
  transition: border-color 0.14s ease, box-shadow 0.14s ease;
}
.book-field input::placeholder {
  color: color-mix(in srgb, var(--muted) 65%, transparent);
}
.book-field input:focus {
  border-color: color-mix(in srgb, var(--accent) 50%, var(--line));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent);
  outline: none;
}

.book-seg {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--surface) 60%, var(--panel));
}
.book-seg button {
  height: 27px;
  padding: 0 10px;
  border-radius: 4px;
  font-size: 10px;
  color: var(--muted);
  white-space: nowrap;
}
.book-seg button.on {
  background: var(--panel);
  color: var(--ink);
  font-weight: 600;
  box-shadow: 0 1px 2px color-mix(in srgb, #000 8%, transparent);
}
.book-seg--three {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  width: 100%;
}
.book-seg--three button {
  height: 32px;
  font-size: 10.5px;
}

.book-primary {
  height: 36px;
  padding: 0 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  line-height: 1;
  border: 1px solid color-mix(in srgb, var(--accent-hover) 55%, transparent);
  border-radius: 8px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 88%, #fff 12%), var(--accent));
  color: #fff;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
  box-shadow:
    0 1px 2px color-mix(in srgb, #000 16%, transparent),
    inset 0 1px 0 color-mix(in srgb, #fff 22%, transparent);
  transition: background 0.14s ease, box-shadow 0.14s ease, transform 0.14s ease;
}
.settings-workspace button.book-primary {
  color: #fff;
}
.book-primary-ico {
  width: 16px;
  height: 16px;
  display: inline-grid;
  place-items: center;
  flex: none;
}
.book-primary-ico svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.book-primary:hover:not(:disabled) {
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent-hover) 80%, #fff 20%), var(--accent-hover));
  box-shadow:
    0 2px 6px color-mix(in srgb, var(--accent) 28%, transparent),
    inset 0 1px 0 color-mix(in srgb, #fff 18%, transparent);
  transform: translateY(-0.5px);
}
.book-primary:disabled {
  opacity: 0.5;
  cursor: default;
  transform: none;
}
.book-ghost {
  height: 30px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
  border-radius: 5px;
  background: var(--panel);
  color: var(--ink);
  font-size: 10px;
  font-weight: 500;
}
.book-ghost:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--muted) 60%, var(--line));
  background: color-mix(in srgb, var(--panel) 70%, var(--surface));
}
.book-ghost--sm {
  height: 28px;
  padding: 0 9px;
  font-size: 9.5px;
}
.book-ghost:disabled {
  opacity: 0.5;
  cursor: default;
}
.book-text-btn {
  font-size: 9px;
  color: var(--accent);
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  padding-bottom: 1px;
  white-space: nowrap;
}
.book-text-btn:hover:not(:disabled) {
  border-color: var(--accent);
}
.book-text-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.book-inline {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}
.book-mono {
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.02em;
  color: color-mix(in srgb, var(--muted) 80%, transparent);
}
.book-small {
  margin: 10px 0 0;
  font-size: 9.5px;
  line-height: 1.55;
  color: var(--muted);
}
.book-small:empty {
  display: none;
}
.book-muted {
  color: var(--muted);
}
.book-danger {
  margin-top: 4px;
  color: var(--danger);
  font-size: 9.5px;
}

/* ---------- backup ---------- */
.book-actions {
  display: grid;
  gap: 8px;
  margin-top: 13px;
}
.book-action {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 9px 10px;
  border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
  border-radius: 7px;
  background: var(--panel);
  text-align: left;
  transition: border-color 0.14s ease, background 0.14s ease;
}
.book-action:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--muted) 55%, var(--line));
  background: color-mix(in srgb, var(--panel) 70%, var(--surface));
}
.book-action:disabled {
  opacity: 0.5;
  cursor: default;
}
.book-action-icon {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 5px;
  background: color-mix(in srgb, var(--surface) 60%, var(--panel));
  color: var(--accent);
}
.book-action-icon svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.book-action-copy strong {
  display: block;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--ink);
}
.book-action-copy span {
  display: block;
  margin-top: 2px;
  font-size: 9px;
  color: var(--muted);
}
.book-action-go {
  font-family: var(--font-mono);
  font-size: 8px;
  color: color-mix(in srgb, var(--muted) 76%, transparent);
}

/* ---------- appearance ---------- */
.book-theme-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}
.book-theme {
  min-width: 0;
  padding: 7px;
  border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
  border-radius: 7px;
  background: var(--panel);
  text-align: left;
  transition: border-color 0.14s ease, box-shadow 0.14s ease;
}
.book-theme:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--muted) 55%, var(--line));
}
.book-theme.on {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 16%, transparent);
}
.book-theme:disabled {
  opacity: 0.55;
  cursor: default;
}
.book-theme-preview {
  position: relative;
  height: 58px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--line) 86%, transparent);
  background: var(--bg);
}
.book-theme-preview.dusk {
  background: #252b24;
  border-color: #3b4239;
}
.book-theme-preview.community {
  background: color-mix(in srgb, var(--accent) 8%, var(--bg));
}
.book-theme-preview .rail {
  position: absolute;
  inset: 0 auto 0 0;
  width: 8px;
  background: color-mix(in srgb, var(--panel) 80%, var(--surface));
}
.book-theme-preview.dusk .rail {
  background: #1c211c;
}
.book-theme-preview .bar {
  position: absolute;
  left: 16px;
  height: 3px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--line) 88%, transparent);
}
.book-theme-preview .b1 {
  top: 13px;
  width: 42%;
  background: var(--accent);
}
.book-theme-preview .b2 {
  top: 21px;
  width: 55%;
}
.book-theme-preview .b3 {
  top: 29px;
  width: 33%;
}
.book-theme-preview .dot {
  position: absolute;
  left: 16px;
  bottom: 9px;
  width: 23px;
  height: 4px;
  border-radius: 1px;
  background: var(--vault);
}
.book-theme-preview.dusk .dot {
  background: #c4a882;
}
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
.book-theme-preview.dusk .page {
  background: #222b24;
  border-color: #3b4239;
}
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
.book-theme-preview.dusk .page::before {
  background: #485242;
  box-shadow: 0 5px 0 #3e4739;
}
.book-theme-name {
  display: flex;
  align-items: center;
  padding: 5px 2px 1px;
  font-size: 10px;
  font-weight: 600;
  color: var(--ink);
}
.book-theme-name .check {
  margin-left: auto;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
  display: grid;
  place-items: center;
  color: transparent;
  font-size: 6px;
}
.book-theme.on .book-theme-name .check {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--panel);
}
.book-theme-desc {
  padding: 0 2px 1px;
  font-size: 8.5px;
  line-height: 1.35;
  color: var(--muted);
}

.book-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 13px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
}
.book-row strong {
  font-size: 10.5px;
  font-weight: 600;
}
.book-hint {
  margin: 2px 0 0;
  font-size: 9px;
  color: var(--muted);
}

.book-colors {
  margin-top: 13px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
}
.book-colors-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.book-colors-head strong {
  font-size: 10.5px;
  font-weight: 600;
}
.book-colors-head span {
  font-size: 9px;
  color: var(--muted);
}
.book-swatches {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 7px;
  margin-top: 9px;
}
.book-swatch {
  min-width: 0;
  display: grid;
  gap: 5px;
  justify-items: center;
  background: transparent;
}
.book-swatch-bar {
  width: 100%;
  height: 34px;
  border-radius: 2px;
  border: 1px solid color-mix(in srgb, #000 8%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 16%, transparent);
  transition: transform 0.14s ease;
}
.book-swatch:hover .book-swatch-bar {
  transform: translateY(-2px);
}
.book-swatch.on .book-swatch-bar {
  box-shadow:
    0 0 0 1px var(--panel),
    0 0 0 2px var(--ink);
}
.book-swatch-label {
  font-size: 8px;
  line-height: 1.3;
  text-align: center;
  color: var(--muted);
}
.book-swatch-label b {
  font-weight: 600;
  color: var(--ink);
}

/* ---------- plugins ---------- */
.book-pref-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
  border-top: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
}
.book-pref-copy strong {
  display: block;
  font-size: 10.5px;
  font-weight: 600;
}
.book-pref-copy span {
  display: block;
  margin-top: 2px;
  font-size: 9px;
  line-height: 1.45;
  color: var(--muted);
}
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
.book-switch.on {
  background: var(--accent);
}
.book-switch.on span {
  transform: translateX(15px);
}
.book-switch:disabled {
  opacity: 0.5;
  cursor: default;
}

.book-subhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 13px;
}
.book-subhead strong {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.book-list {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
}
.book-list-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 82%, transparent);
}
.book-list-row strong {
  font-size: 10px;
  font-weight: 600;
}
.book-list-row .book-mono {
  margin-top: 3px;
}

.book-cmd-row {
  margin-top: 12px;
}
.book-cmd-row > .book-mono {
  margin: 0 0 6px;
}
.book-cmd {
  padding: 6px 8px;
  margin: 0 5px 5px 0;
  border: 1px solid color-mix(in srgb, var(--line) 90%, transparent);
  border-radius: 5px;
  background: var(--panel);
  text-align: left;
}
.book-cmd.is-on {
  border-color: var(--accent);
}
.book-cmd strong {
  display: block;
  font-size: 9px;
  font-weight: 600;
}
.book-cmd span {
  display: block;
  margin-top: 1px;
  font-family: var(--font-mono);
  font-size: 7.5px;
  color: var(--muted);
}

.book-plugin-tabs {
  margin-top: 12px;
}
.book-plugin-tabs > .book-mono {
  margin: 0 0 6px;
}
.book-plugin-tab {
  padding: 8px 0;
  border-top: 1px solid color-mix(in srgb, var(--line) 82%, transparent);
}
.book-plugin-tab strong {
  font-size: 9.5px;
  font-weight: 600;
}
.book-plugin-tab-host {
  margin-top: 6px;
  font-size: 10px;
  color: var(--muted);
}

/* ---------- catalog ---------- */
.book-catalog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
}
.book-catalog-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  padding: 10px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 82%, transparent);
}
.book-catalog-row strong {
  font-size: 10.5px;
  font-weight: 600;
}
.book-catalog-row p {
  margin: 4px 0 0;
  font-size: 9px;
  line-height: 1.45;
  color: var(--muted);
}
.book-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 5px;
}
.book-tag {
  padding: 1px 4px;
  border: 1px solid color-mix(in srgb, var(--line) 90%, transparent);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 7px;
  color: var(--muted);
}

/* ---------- about ---------- */
.book-meta--about {
  margin-top: 0;
}
.book-meta--about + .book-note {
  margin-top: 14px;
}

/* ---------- footer ---------- */
.book-right-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
  flex: none;
}
.book-pager {
  display: flex;
  align-items: center;
  gap: 9px;
  font-family: var(--font-mono);
  font-size: 8px;
  color: var(--muted);
}
.book-pager button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 27px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
  border-radius: 4px;
  color: var(--muted);
  font-size: 8.5px;
}
.book-pager button:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--muted) 60%, var(--line));
  background: color-mix(in srgb, var(--panel) 70%, var(--surface));
}
.book-pager button:disabled {
  opacity: 0.35;
  cursor: default;
}
.book-pager .num {
  margin: 0 3px;
  font-size: 8.5px;
  color: var(--muted);
}
.book-pager .num b {
  font-weight: 600;
  color: var(--ink);
}


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
  gap: 8px;
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


/* ---------- responsive ---------- */
@media (max-width: 1120px) {
  .settings-workspace {
    grid-template-columns: 208px minmax(0, 1fr);
  }
  .settings-main {
    padding: 26px 24px 54px;
  }
  .side-title h1 {
    font-size: 22px;
  }
}

@media (max-width: 860px) {
  .settings-workspace {
    display: block;
    height: 100%;
    min-height: 0;
    overflow: auto;
  }
  .settings-side {
    height: auto;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  .side-nav {
    grid-template-columns: 1fr 1fr;
    gap: 2px 8px;
  }
  .side-sep,
  .side-note,
  .side-foot {
    display: none;
  }
  .settings-main {
    overflow: visible;
    padding: 24px 20px 50px;
  }
  .settings-inner {
    width: 100%;
  }
  .status-strip {
    grid-template-columns: 1fr 1fr;
  }
  .status-strip li:nth-child(2) {
    border-right: 0;
  }
  .status-strip li:nth-child(1),
  .status-strip li:nth-child(2) {
    border-bottom: 1px solid var(--line);
  }
  .p-head {
    padding: 15px 16px 9px;
  }
  .p-head .state {
    display: none;
  }
  .p-body {
    padding: 0 16px 16px;
  }
  .book-theme-grid {
    grid-template-columns: 1fr;
  }
  .book-swatches {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .settings-workspace :deep(.account-panel .login-form) {
    grid-template-columns: 1fr;
  }
}
</style>
