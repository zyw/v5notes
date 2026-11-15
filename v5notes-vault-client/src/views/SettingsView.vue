<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, type Ref } from 'vue'
import AccountPanel from '../components/AccountPanel.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import type { AccountState } from '../account'
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
import type { OpenedVault } from '../vault/types'
import type { ThemeInfo } from '@v5notes/vault-plugin-api'
import type { HostCommand, HostSettingTab, PluginRuntimeInfo } from '../plugin-host'
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
}>()

const prefs = ref<AppearancePrefs>(loadAppearancePrefs())
const safeMode = ref(loadSafeMode())
const themes = ref<ThemeInfo[]>([])
const plugins = ref<PluginRuntimeInfo[]>([])
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

const hasVault = computed(() => Boolean(props.vault?.rootPath))

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
})
watch(
  () => props.vault?.rootPath,
  () => refreshExtensionState(),
)
</script>

<template>
  <section class="panel settings" aria-labelledby="settings-title">
    <p class="eyebrow">SETTINGS</p>
    <h1 id="settings-title">设置</h1>
    <p class="lede">
      本地 Vault 优先。账号登录可选；插件与主题经 PluginHost / Theme API（权限代理，非进程隔离）。
    </p>

    <AccountPanel :account="account" :vault="vault" />

    <section class="settings-block" aria-labelledby="help-dual-title">
      <h2 id="help-dual-title">帮助 · 双产品</h2>
      <p class="settings-help dual-product">{{ DUAL_PRODUCT_LINE }}</p>
      <p class="settings-help">{{ DUAL_PRODUCT_HELP }}</p>
      <dl class="meta tight-meta">
        <div>
          <dt>本客户端</dt>
          <dd>{{ PRODUCT_DISPLAY_NAME }}</dd>
        </div>
        <div>
          <dt>并列产品</dt>
          <dd>{{ CLOUD_PRODUCT_DISPLAY_NAME }}（不做 Vault 插件宿主）</dd>
        </div>
      </dl>
    </section>

    <section class="settings-block" aria-labelledby="backup-title">
      <h2 id="backup-title">备份与迁移</h2>
      <p class="settings-help">{{ BACKUP_NOT_SYNC_LINE }}</p>
      <p class="settings-help tight">{{ BACKUP_SCOPE_HELP }}</p>
      <div class="choice-row">
        <button
          type="button"
          class="choice compact-choice"
          :disabled="backupBusy || !hasVault"
          @click="runBackup"
        >
          <strong>{{ backupBusy ? '正在打包…' : '导出整库 zip' }}</strong>
          <span>仅备份 · 非 Sync</span>
        </button>
        <button
          type="button"
          class="choice compact-choice"
          @click="requestMigrationGuide"
        >
          <strong>Cloud ↔ Vault 迁移说明</strong>
          <span>显式确认 · 不自动合并</span>
        </button>
      </div>
      <p v-if="!hasVault" class="settings-help tight">打开 Vault 后可导出备份。</p>
      <p v-if="backupMessage" class="settings-help tight" role="status">{{ backupMessage }}</p>
      <p v-if="migrationAck" class="settings-help tight" role="status">{{ migrationMessage }}</p>
    </section>

    <section class="settings-block" aria-labelledby="publish-title">
      <h2 id="publish-title">{{ OFFICIAL_PUBLISH_TITLE }}</h2>
      <p class="settings-help">{{ OFFICIAL_PUBLISH_LEAD }}</p>
      <p class="settings-help tight">{{ OFFICIAL_PUBLISH_STUB_HELP }}</p>
      <label class="publish-field">
        <span>站点标题（本机预览）</span>
        <input
          v-model="publishDraft.siteTitle"
          type="text"
          maxlength="100"
          placeholder="例如：公开读书笔记"
          autocomplete="off"
        >
      </label>
      <div class="choice-row" role="group" aria-label="可见性预览">
        <button
          v-for="opt in [
            { id: 'private' as const, label: '私有' },
            { id: 'unlisted' as const, label: '不公开链接' },
            { id: 'public' as const, label: '公开' },
          ]"
          :key="opt.id"
          type="button"
          class="choice compact-choice"
          :class="{ active: publishDraft.visibility === opt.id }"
          @click="setPublishVisibility(opt.id)"
        >
          <strong>{{ opt.label }}</strong>
        </button>
      </div>
      <div class="choice-row">
        <button type="button" class="choice compact-choice" @click="savePublishDraft">
          <strong>保存官方通道预览</strong>
          <span>channel=product · status=preview</span>
        </button>
      </div>
      <p v-if="publishMessage" class="settings-help tight" role="status">{{ publishMessage }}</p>
    </section>

    <section class="settings-block" aria-labelledby="appearance-title">
      <h2 id="appearance-title">外观</h2>
      <p class="settings-help">
        内置主题始终可回退。社区主题需通过 CSS 变量校验；非法规则会回退默认并提示。
      </p>

      <div class="choice-row" role="group" aria-label="主题">
        <button
          v-for="theme in themes"
          :key="theme.id"
          type="button"
          class="choice"
          :class="{ active: prefs.theme === theme.id }"
          :disabled="safeMode && !theme.builtin"
          @click="setTheme(theme.id)"
        >
          <strong>{{ theme.name }}</strong>
          <span>{{ theme.description || (theme.builtin ? '内置' : '库内/示例主题') }}</span>
        </button>
      </div>

      <div class="choice-row" role="group" aria-label="色模式">
        <button
          v-for="mode in [
            { id: 'system' as const, label: '跟随系统' },
            { id: 'light' as const, label: '浅色' },
            { id: 'dark' as const, label: '深色' },
          ]"
          :key="mode.id"
          type="button"
          class="choice compact-choice"
          :class="{ active: prefs.colorMode === mode.id }"
          @click="setColorMode(mode.id)"
        >
          <strong>{{ mode.label }}</strong>
        </button>
      </div>
      <p v-if="themeError" class="settings-help tight" role="status">{{ themeError }}</p>
    </section>

    <section class="settings-block" aria-labelledby="plugins-title">
      <h2 id="plugins-title">插件与安全</h2>
      <p class="settings-help">
        P1 威胁模型：同页 JS + 权限代理 + Safe Mode。Token 不对插件暴露。网络仅
        <code>network:safe</code>（白名单）；无第三方发布 / 无限制 <code>network</code> /
        <code>fs:arbitrary</code>。
      </p>

      <div class="choice-row">
        <button
          type="button"
          class="choice compact-choice"
          :class="{ active: safeMode }"
          :disabled="extensionBusy"
          @click="toggleSafeMode"
        >
          <strong>{{ safeMode ? '安全模式：开' : '安全模式：关' }}</strong>
          <span>仅核心插件 + 内置主题</span>
        </button>
        <button
          v-if="hasVault"
          type="button"
          class="choice compact-choice"
          :disabled="extensionBusy || safeMode"
          @click="installSamples"
        >
          <strong>安装示例扩展</strong>
          <span>hello-world · safe-fetch · Forest Ink</span>
        </button>
      </div>

      <p v-if="!hasVault" class="settings-help tight">打开 Vault 后可启用库内插件与示例主题。</p>

      <ul v-if="plugins.length" class="ext-list">
        <li v-for="p in plugins" :key="p.id" class="ext-item">
          <div>
            <strong>{{ p.name }}</strong>
            <span class="muted"> · {{ p.id }} · {{ p.core ? '核心' : '本地' }} · {{ p.status }}</span>
            <div class="muted tight">权限: {{ p.permissions.join(', ') || '（无）' }}</div>
            <div v-if="p.error" class="danger-text">{{ p.error }}</div>
          </div>
          <button
            type="button"
            class="linkish"
            :disabled="extensionBusy || (safeMode && !p.core)"
            @click="togglePlugin(p.id, p.status !== 'loaded')"
          >
            {{ p.status === 'loaded' ? '禁用' : '启用' }}
          </button>
        </li>
      </ul>

      <div v-if="commands.length" class="cmd-row">
        <p class="settings-help tight">已注册命令</p>
        <button
          v-for="cmd in commands"
          :key="`${cmd.pluginId}:${cmd.id}`"
          type="button"
          class="choice compact-choice"
          @click="runCommand(cmd)"
        >
          <strong>{{ cmd.name }}</strong>
          <span>{{ cmd.pluginId }}:{{ cmd.id }}</span>
        </button>
      </div>

      <div v-if="settingTabs.length" class="plugin-tabs">
        <p class="settings-help tight">插件设置页（SettingTab）</p>
        <div
          v-for="tab in settingTabs"
          :key="`${tab.pluginId}:${tab.id}`"
          class="plugin-tab"
        >
          <strong>{{ tab.name }}</strong>
          <div
            class="plugin-tab-host"
            :ref="
              (el) => {
                pluginTabHosts[`${tab.pluginId}:${tab.id}`] = el as HTMLElement | null
              }
            "
          />
        </div>
      </div>

      <p v-if="extensionMessage" class="settings-help tight" role="status">{{ extensionMessage }}</p>
    </section>

    <section class="settings-block" aria-labelledby="catalog-title">
      <h2 id="catalog-title">插件目录</h2>
      <p class="settings-help">
        <code>/vault/v1/catalog/...</code> 与文件 sync 协议解耦（catalogProtocolVersion 独立）。拒绝
        <code>publishing</code> 标签；无第三方发布。
        <span v-if="catalogSource">来源：{{ catalogSource === 'server' ? '服务器' : '本地种子' }}</span>
      </p>
      <div class="choice-row">
        <button
          type="button"
          class="choice compact-choice"
          :disabled="catalogBusy"
          @click="loadCatalog"
        >
          <strong>{{ catalogBusy ? '刷新中…' : '刷新目录' }}</strong>
          <span>list · install</span>
        </button>
      </div>
      <ul v-if="catalogItems.length" class="ext-list">
        <li v-for="item in catalogItems" :key="item.id" class="ext-item">
          <div>
            <strong>{{ item.name }}</strong>
            <span class="muted"> · {{ item.kind }} · {{ item.version }}</span>
            <div class="muted tight">{{ item.description }}</div>
            <div class="muted tight">
              标签: {{ (item.tags || []).join(', ') || '（无）' }}
              <template v-if="item.networkAllowlist?.length">
                · allowlist: {{ item.networkAllowlist.join(', ') }}
              </template>
            </div>
          </div>
          <button
            type="button"
            class="linkish"
            :disabled="extensionBusy || !hasVault || safeMode"
            @click="installCatalog(item)"
          >
            安装
          </button>
        </li>
      </ul>
    </section>

    <dl class="meta">
      <div>
        <dt>产品</dt>
        <dd>V5Notes Vault</dd>
      </div>
      <div>
        <dt>Bundle ID</dt>
        <dd><code>xin.v5ai.v5notes.vault</code></dd>
      </div>
      <div>
        <dt>Deep link</dt>
        <dd><code>v5notes-vault://</code></dd>
      </div>
      <div>
        <dt>扩展</dt>
        <dd>Phase 8 · 官方发布 stub · 备份 zip · 双产品收尾</dd>
      </div>
    </dl>

    <ConfirmDialog
      :open="showMigrationConfirm"
      title="Cloud ↔ Vault 迁移"
      :message="`${MIGRATION_EXPLICIT_LINE} 继续仅展示迁移步骤，不会改动任何笔记。`"
      confirm-label="我明白，显示步骤"
      @cancel="cancelMigrationGuide"
      @confirm="confirmMigrationGuide"
    />
  </section>
</template>

<style scoped>
.ext-list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ext-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface);
}
.muted {
  color: var(--muted);
  font-size: 0.85rem;
}
.muted.tight,
.danger-text {
  margin-top: 4px;
}
.plugin-tabs {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.plugin-tab {
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface);
}
.plugin-tab-host {
  margin-top: 8px;
  font-size: 0.9rem;
  color: var(--muted);
}
.danger-text {
  color: var(--danger);
  font-size: 0.85rem;
}
.cmd-row {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.linkish {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font: inherit;
  text-decoration: underline;
  white-space: nowrap;
}
.publish-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 12px 0;
  font-size: 0.9rem;
}
.publish-field input {
  font: inherit;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
}
.tight-meta {
  margin-top: 10px;
}
</style>
