<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AccountPanel from '../components/AccountPanel.vue'
import type { AccountState } from '../account'
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
import type { HostCommand, PluginRuntimeInfo } from '../plugin-host'
import { loadSafeMode } from '../plugin-host/safeMode'
import {
  ensureSampleExtensions,
  getPluginHost,
  getThemeHost,
  listHostCommands,
  listPluginInfos,
  setSafeModeAndReload,
} from '../extension/runtime'

const props = defineProps<{
  account: AccountState
  vault?: OpenedVault | null
}>()

const prefs = ref<AppearancePrefs>(loadAppearancePrefs())
const safeMode = ref(loadSafeMode())
const themes = ref<ThemeInfo[]>([])
const plugins = ref<PluginRuntimeInfo[]>([])
const commands = ref<HostCommand[]>([])
const extensionBusy = ref(false)
const extensionMessage = ref('')
const themeError = ref<string | null>(null)

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
  safeMode.value = getPluginHost()?.isSafeMode() ?? loadSafeMode()
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
    extensionMessage.value = '已安装示例：hello-world 插件 + Forest Ink 主题'
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

onMounted(() => refreshExtensionState())
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
        P1 威胁模型：同页 JS + 权限代理 + Safe Mode。Token 不对插件暴露；无
        <code>network:safe</code>（Phase 7）；无第三方发布 / <code>fs:arbitrary</code>。
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
          <span>hello-world + Forest Ink</span>
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

      <p v-if="extensionMessage" class="settings-help tight" role="status">{{ extensionMessage }}</p>
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
        <dd>Phase 6 · PluginHost + Theme API（无 catalog）</dd>
      </div>
    </dl>
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
</style>
