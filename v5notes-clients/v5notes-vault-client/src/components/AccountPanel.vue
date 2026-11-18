<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AccountState } from '../account'
import { DEFAULT_CLIENT_ID } from '../account/constants'
import {
  bootstrapModeLabel,
  cloudQuotaHelp,
  createSyncEngine,
  deviceLimitMessage,
  formatVaultQuotaLine,
  vaultSyncQuotaHelp,
  type SyncCoordinatorHandles,
  type SyncEngine,
  type SyncEngineStatus,
  type VaultDeviceInfo,
} from '../sync'
import type { OpenedVault } from '../vault/types'
import { readTextFile } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'
import { VAULT_JSON_REL } from '../vault/skeleton'
import type { VaultJson } from '../models/vault'

const props = defineProps<{
  account: AccountState
  vault?: OpenedVault | null
  /** Global coordinator from App.vue; local engine only as a fallback. */
  sync?: SyncCoordinatorHandles | null
}>()

const serverBusy = ref(false)
const serverError = ref('')
const showPassword = ref(false)
const syncBusyLocal = ref(false)
const syncMessageLocal = ref('')
const syncStatusLocal = ref<SyncEngineStatus | null>(null)
// Coordinator-pushed status is authoritative whenever present (background
// cycles included); button handlers only see their own cycle results.
const syncStatus = computed(() => props.sync?.syncStatus.value ?? syncStatusLocal.value)
function setSyncMessage(text: string) {
  syncMessageLocal.value = text
  if (props.sync) props.sync.lastSyncMessage.value = text
}
const syncMessage = computed(() => props.sync?.lastSyncMessage.value ?? syncMessageLocal.value)
const syncBusy = computed(() => props.sync?.syncing.value ?? syncBusyLocal.value)
const devices = ref<VaultDeviceInfo[]>([])
const devicesBusy = ref(false)
const devicesError = ref('')
const kickBusyId = ref<string | null>(null)
const localDeviceId = ref<string | null>(null)
// Local fallback engine for standalone mounting (tests/storybook); the real
// one is owned by the App-level coordinator and passed through `sync`.
let fallbackEngine: SyncEngine | null = null

function activeEngine(): SyncEngine | null {
  return props.sync?.currentEngine() ?? fallbackEngine
}

const canSync = computed(() => Boolean(props.account.loggedIn.value && props.vault?.rootPath))
const vaultSync = computed(() => props.account.plan.value?.vaultSync)
const vaultQuotaLine = computed(() => {
  const q = vaultSync.value
  if (!q?.available) return null
  return formatVaultQuotaLine(q)
})

async function onLogin() {
  await props.account.login()
}

async function onLogout() {
  fallbackEngine?.stopBackgroundSync()
  fallbackEngine = null
  await props.account.logout()
  // Coordinator state resets itself when login drops; mirror locally too so a
  // standalone mount without the coordinator also clears.
  syncStatusLocal.value = null
  setSyncMessage('')
  devices.value = []
  localDeviceId.value = null
}

async function useOfficial() {
  serverBusy.value = true
  serverError.value = ''
  try {
    await props.account.saveServer({ server: props.account.server.value, official: true })
  } catch (cause) {
    serverError.value = cause instanceof Error ? cause.message : '无法保存服务器'
  } finally {
    serverBusy.value = false
  }
}

async function saveCustomServer() {
  serverBusy.value = true
  serverError.value = ''
  try {
    await props.account.saveServer({
      server: props.account.customServer.value,
      official: false,
    })
  } catch (cause) {
    serverError.value = cause instanceof Error ? cause.message : '无法保存服务器'
  } finally {
    serverBusy.value = false
  }
}

function makeEngine(): SyncEngine {
  if (props.sync) {
    const shared = props.sync.currentEngine()
    if (shared) return shared
    throw new Error('同步尚未就绪：请确认已登录并打开本地库')
  }
  const rootPath = props.vault?.rootPath
  if (!rootPath) throw new Error('请先打开本地库再同步')
  if (fallbackEngine) return fallbackEngine
  fallbackEngine = createSyncEngine({
    rootPath,
    getAuth: () => ({
      server: props.account.server.value,
      clientId: props.account.clientId || DEFAULT_CLIENT_ID,
      token: props.account.token.value,
    }),
    onUnauthorized: () => {
      void props.account.logout()
    },
  })
  return fallbackEngine
}

async function refreshLocalDeviceId() {
  localDeviceId.value = null
  const root = props.vault?.rootPath
  if (!root) return
  try {
    const raw = await readTextFile(await join(root, VAULT_JSON_REL))
    const config = JSON.parse(raw) as VaultJson
    localDeviceId.value = config.binding.deviceId
  } catch {
    localDeviceId.value = null
  }
}

async function refreshDevices() {
  if (!canSync.value) {
    devices.value = []
    return
  }
  devicesBusy.value = true
  devicesError.value = ''
  try {
    await refreshLocalDeviceId()
    const engine = makeEngine()
    devices.value = await engine.listDevices()
  } catch (cause) {
    devicesError.value = cause instanceof Error ? cause.message : '无法加载设备列表'
  } finally {
    devicesBusy.value = false
  }
}

async function onKick(device: VaultDeviceInfo) {
  if (device.deviceId === localDeviceId.value) {
    devicesError.value = '不能踢除当前本机设备；请在其他设备上操作，或先解除本机绑定。'
    return
  }
  kickBusyId.value = device.deviceId
  devicesError.value = ''
  try {
    const engine = makeEngine()
    await engine.kickDevice(device.deviceId)
    await refreshDevices()
    await props.account.refreshProfileAndPlan()
  } catch (cause) {
    devicesError.value = cause instanceof Error ? cause.message : '踢除失败'
  } finally {
    kickBusyId.value = null
  }
}

function reportCycle(status: SyncEngineStatus, note?: string) {
  if (props.sync) return // coordinator subscription already applied it
  syncStatusLocal.value = status
  syncMessageLocal.value = note ?? status.message
}

async function onBindAndSync() {
  if (!canSync.value) return
  syncBusyLocal.value = true
  syncMessageLocal.value = ''
  try {
    const cycle = async () => {
      const engine = makeEngine()
      const plan = await engine.bind()
      const status = await engine.pushPull()
      reportCycle(status, `${bootstrapModeLabel(plan.mode)} · ${status.message}`)
    }
    await (props.sync?.runExclusive(cycle) ?? cycle())
    await props.account.refreshProfileAndPlan()
    await refreshDevices()
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : '同步失败'
    const shown = msg.includes('设备') ? `${msg}（${deviceLimitMessage()}）` : msg
    setSyncMessage(shown)
  } finally {
    syncBusyLocal.value = false
  }
}

async function onSyncNow() {
  if (!canSync.value) return
  syncBusyLocal.value = true
  try {
    const cycle = async () => {
      const status = await makeEngine().pushPull()
      reportCycle(status)
    }
    await (props.sync?.runExclusive(cycle) ?? cycle())
    await props.account.refreshProfileAndPlan()
    await refreshDevices()
  } catch (cause) {
    setSyncMessage(cause instanceof Error ? cause.message : '同步失败')
  } finally {
    syncBusyLocal.value = false
  }
}

async function onFlushRetry() {
  if (!canSync.value) return
  syncBusyLocal.value = true
  try {
    const cycle = async () => {
      const status = await makeEngine().flushRetryQueue()
      reportCycle(status)
    }
    await (props.sync?.runExclusive(cycle) ?? cycle())
  } catch (cause) {
    setSyncMessage(cause instanceof Error ? cause.message : '重试失败')
  } finally {
    syncBusyLocal.value = false
  }
}

function formatSeen(value?: string | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

// Device list and fallback-engine lifecycle only; the coordinator owns the
// engine, its background timer, online/focus wakeups, and status pushes.
watch(
  () => [props.account.loggedIn.value, props.vault?.rootPath] as const,
  ([loggedIn, root]) => {
    fallbackEngine = null
    if (loggedIn && root) void refreshDevices()
    else devices.value = []
  },
)

onMounted(() => {
  if (!props.sync && canSync.value) {
    // Standalone mount without App-level coordinator: keep a local loop alive.
    try {
      fallbackEngine = makeEngine()
      fallbackEngine.startBackgroundSync()
    } catch {
      /* no vault open */
    }
    void refreshDevices()
  } else if (canSync.value) {
    void refreshDevices()
  }
})

onBeforeUnmount(() => {
  fallbackEngine?.stopBackgroundSync()
  fallbackEngine = null
})
</script>

<template>
  <section class="settings-block account-panel" aria-labelledby="account-title">
    <h2 id="account-title">账号</h2>
    <p class="settings-help dual-product">{{ account.dualProductLine }}</p>

    <div class="server-row" role="group" aria-label="服务器">
      <button
        type="button"
        class="choice compact-choice server-choice"
        :class="{ active: account.useOfficialServer.value }"
        :disabled="serverBusy"
        @click="useOfficial"
      >
        <span class="btn-ico" aria-hidden="true">
          <svg viewBox="0 0 16 16"><path d="M3.2 10.2a2.4 2.4 0 0 1 .4-4.7A3.4 3.4 0 0 1 9.8 4a2.8 2.8 0 0 1 2.8 2.7 2.2 2.2 0 0 1 .2 4.3H3.6"/><path d="M8 8.2v3.4M6.4 10.2 8 11.8l1.6-1.6"/></svg>
        </span>
        <strong>官方服务器</strong>
      </button>
      <div class="custom-server">
        <label class="sr-only" for="vault-server">自定义服务器</label>
        <input
          id="vault-server"
          v-model="account.customServer.value"
          type="url"
          autocomplete="url"
          placeholder="https://your-server.example"
          :disabled="serverBusy"
        >
        <button type="button" class="ghost server-custom-btn" :disabled="serverBusy" @click="saveCustomServer">
          <span class="btn-ico" aria-hidden="true">
            <svg viewBox="0 0 16 16"><rect x="2.8" y="3.2" width="10.4" height="9.6" rx="1.4"/><path d="M2.8 6.2h10.4M5.2 3.2v9.6M8 8.4h3.2M8 10.6h2.2"/></svg>
          </span>
          {{ serverBusy ? '检测中…' : '使用自定义' }}
        </button>
      </div>
      <p v-if="serverError" class="inline-error" role="alert">{{ serverError }}</p>
      <p class="settings-help tight">
        当前：
        <code>{{ account.useOfficialServer.value ? '官方服务器' : account.server.value }}</code>
        · deviceType=<code>vault_client</code>
      </p>
    </div>

    <div v-if="account.loggedIn.value" class="account-card">
      <div class="account-identity">
        <strong>{{ account.profile.value?.nickName || account.profile.value?.userName || account.username.value || '已登录' }}</strong>
        <span v-if="account.profile.value?.email">{{ account.profile.value.email }}</span>
        <span v-else-if="account.username.value">{{ account.username.value }}</span>
      </div>

      <div class="plan-stub" aria-labelledby="plan-title">
        <h3 id="plan-title">套餐（形态 B · 一账号双配额）</h3>
        <p class="settings-help tight">Cloud 与 Vault 是两桶额度，互不混用。</p>
        <dl class="plan-grid">
          <div>
            <dt>Cloud 笔记额度</dt>
            <dd v-if="account.plan.value?.cloud">
              {{ account.formatBytes(account.plan.value.cloud.usedBytes) }}
              /
              {{ account.formatBytes(account.plan.value.cloud.quotaBytes) }}
              <span v-if="account.plan.value.cloud.expired" class="warn">已过期</span>
            </dd>
            <dd v-else class="muted">暂无数据</dd>
            <p class="settings-help tight muted">{{ cloudQuotaHelp() }}</p>
          </div>
          <div>
            <dt>Vault 同步额度</dt>
            <dd v-if="vaultSync?.available">
              {{ vaultQuotaLine }}
            </dd>
            <dd v-else class="muted">尚未获取 <code>/vault/v1/quota</code>；本地编辑不受限</dd>
            <p class="settings-help tight muted">{{ vaultSyncQuotaHelp() }}</p>
          </div>
        </dl>
      </div>

      <div class="sync-guide">
        <h3>同步</h3>
        <p class="settings-help tight">
          仅登录后可绑定云端库。未打开本地库时无法同步；离线仍可本地编辑，失败项进入重试队列。
          冲突会生成「冲突」副本，不会静默覆盖。附件（图片等）随库增量同步；超单文件上限会角标跳过。
        </p>
        <p v-if="!vault" class="settings-help tight muted">请先在欢迎页打开或创建本地库，再回来绑定同步。</p>
        <div class="login-actions">
          <button
            type="button"
            class="primary login-primary"
            :disabled="!canSync || syncBusy"
            @click="onBindAndSync"
          >
            <span class="btn-ico" aria-hidden="true">
              <svg viewBox="0 0 16 16"><path d="M3.2 8a4.8 4.8 0 0 1 8.2-3.4M12.8 8a4.8 4.8 0 0 1-8.2 3.4"/><path d="M11.2 2.8v2.6H8.6M4.8 13.2v-2.6h2.6"/></svg>
            </span>
            {{ syncBusy ? '同步中…' : '绑定并同步' }}
          </button>
          <button
            type="button"
            class="ghost"
            :disabled="!canSync || syncBusy"
            @click="onSyncNow"
          >
            <span class="btn-ico" aria-hidden="true">
              <svg viewBox="0 0 16 16"><path d="M3.2 8a4.8 4.8 0 0 1 8.2-3.4M12.8 8a4.8 4.8 0 0 1-8.2 3.4"/><path d="M11.2 2.8v2.6H8.6M4.8 13.2v-2.6h2.6"/></svg>
            </span>
            立即同步
          </button>
          <button
            type="button"
            class="ghost"
            :disabled="!canSync || syncBusy || !(syncStatus?.retryQueueSize)"
            @click="onFlushRetry"
          >
            <span class="btn-ico" aria-hidden="true">
              <svg viewBox="0 0 16 16"><path d="M3.4 6.2A4.8 4.8 0 0 1 12.2 5M12.6 9.8A4.8 4.8 0 0 1 3.8 11"/><path d="M12.2 2.6v2.6H9.6M3.8 13.4v-2.6h2.6"/></svg>
            </span>
            重试队列{{ syncStatus?.retryQueueSize ? `（${syncStatus.retryQueueSize}）` : '' }}
          </button>
        </div>
        <p v-if="syncMessage" class="settings-help tight" role="status">{{ syncMessage }}</p>
        <p v-if="syncStatus && !syncStatus.online" class="inline-error" role="status">当前离线 · 恢复网络后自动重试</p>
        <p v-if="syncStatus?.conflictPaths?.length" class="inline-error" role="alert">
          冲突副本：{{ syncStatus.conflictPaths.join('、') }}
        </p>
        <ul v-if="syncStatus?.skippedTooLarge?.length" class="attachment-badges" aria-label="超限附件">
          <li v-for="item in syncStatus.skippedTooLarge" :key="item" class="attachment-badge">{{ item }}</li>
        </ul>
      </div>

      <div class="device-panel" aria-labelledby="devices-title">
        <h3 id="devices-title">同步设备</h3>
        <p class="settings-help tight">踢除闲置设备可释放绑定名额。踢除不会删除云端笔记内容。</p>
        <div class="login-actions">
          <button type="button" class="ghost" :disabled="!canSync || devicesBusy" @click="refreshDevices">
            {{ devicesBusy ? '刷新中…' : '刷新设备列表' }}
          </button>
        </div>
        <p v-if="devicesError" class="inline-error" role="alert">{{ devicesError }}</p>
        <ul v-if="devices.length" class="device-list">
          <li v-for="device in devices" :key="device.id" class="device-row">
            <div>
              <strong>
                {{ device.clientInfo || 'Vault 客户端' }}
                <span v-if="device.deviceId === localDeviceId" class="device-tag">本机</span>
              </strong>
              <p class="settings-help tight muted">
                {{ device.deviceId.slice(0, 8) }}…
                · 最近 {{ formatSeen(device.lastSeenAt) }}
              </p>
            </div>
            <button
              type="button"
              class="danger compact"
              :disabled="device.deviceId === localDeviceId || kickBusyId === device.deviceId"
              @click="onKick(device)"
            >
              {{ kickBusyId === device.deviceId ? '踢除中…' : '踢除' }}
            </button>
          </li>
        </ul>
        <p v-else-if="canSync && !devicesBusy" class="settings-help tight muted">暂无已绑定设备（先「绑定并同步」）。</p>
      </div>

      <div class="version-stub" aria-labelledby="versions-title">
        <h3 id="versions-title">版本历史</h3>
        <p class="settings-help tight muted">
          接口已预留（<code>GET …/files/versions</code>），当前返回空列表；完整保留策略后置。
        </p>
      </div>

      <button type="button" class="danger" @click="onLogout">退出登录</button>
    </div>

    <form v-else class="login-form" @submit.prevent="onLogin">
      <p class="settings-help tight">登录可选。未登录仍可纯本地建库、写笔记与搜索。</p>

      <label>
        <span>账号</span>
        <input
          v-model="account.username.value"
          type="text"
          autocomplete="username"
          placeholder="用户名或邮箱"
          :disabled="account.busy.value"
        >
        <span v-if="account.fieldAccountError.value" class="inline-error">{{ account.fieldAccountError.value }}</span>
      </label>

      <label>
        <span>密码</span>
        <div class="password-field">
          <input
            v-model="account.password.value"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            placeholder="不会被保存到本地"
            :disabled="account.busy.value"
          >
          <button
            type="button"
            class="password-toggle"
            :aria-label="showPassword ? '隐藏密码' : '显示密码'"
            :aria-pressed="showPassword"
            @click="showPassword = !showPassword"
          >
            <svg v-if="!showPassword" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M1.6 8s2.4-4.2 6.4-4.2S14.4 8 14.4 8s-2.4 4.2-6.4 4.2S1.6 8 1.6 8z"/>
              <circle cx="8" cy="8" r="1.8"/>
            </svg>
            <svg v-else viewBox="0 0 16 16" aria-hidden="true">
              <path d="M1.6 8s2.4-4.2 6.4-4.2S14.4 8 14.4 8s-2.4 4.2-6.4 4.2S1.6 8 1.6 8z"/>
              <circle cx="8" cy="8" r="1.8"/>
              <path d="M3.2 12.8 12.8 3.2"/>
            </svg>
          </button>
        </div>
        <span v-if="account.fieldPasswordError.value" class="inline-error">{{ account.fieldPasswordError.value }}</span>
      </label>

      <p v-if="account.error.value" class="inline-error" role="alert">{{ account.error.value }}</p>

      <div class="login-actions">
        <button type="submit" class="primary login-primary" :disabled="account.busy.value">
          <span class="btn-ico" aria-hidden="true">
            <svg viewBox="0 0 16 16"><path d="M7.2 3.2H4.4A1.6 1.6 0 0 0 2.8 4.8v6.4A1.6 1.6 0 0 0 4.4 12.8h2.8M7 8h6.2M10.8 5.6 13.2 8l-2.4 2.4"/></svg>
          </span>
          {{ account.busy.value ? '登录中…' : '登录' }}
        </button>
      </div>

      <div v-if="account.socialLoginEnabled.value" class="social-block">
        <div class="auth-sep" role="separator" aria-label="或使用第三方登录">
          <span>或</span>
        </div>
        <div class="social-row" role="group" aria-label="第三方登录">
          <button
            v-for="provider in account.socialProviders"
            :key="provider.source"
            type="button"
            class="ghost social-btn"
            :class="`social-${provider.tone}`"
            :disabled="account.busy.value"
            @click="account.startSocialLogin(provider.source)"
          >
            <span class="btn-ico social-ico" aria-hidden="true">
              <svg v-if="provider.source === 'gitee'" viewBox="0 0 1024 1024">
                <path fill="currentColor" d="M512 1024C230.4 1024 0 793.6 0 512S230.4 0 512 0s512 230.4 512 512-230.4 512-512 512zm259.2-569.6H480c-12.8 0-25.6 12.8-25.6 25.6v64c0 12.8 12.8 25.6 25.6 25.6h176c12.8 0 25.6 12.8 25.6 25.6v12.8c0 41.6-35.2 76.8-76.8 76.8h-240c-12.8 0-25.6-12.8-25.6-25.6V416c0-41.6 35.2-76.8 76.8-76.8h355.2c12.8 0 25.6-12.8 25.6-25.6v-64c0-12.8-12.8-25.6-25.6-25.6H441.6C355.2 224 288 291.2 288 377.6v355.2c0 12.8 12.8 25.6 25.6 25.6h371.2c70.4 0 128-57.6 128-128V480c0-12.8-12.8-25.6-25.6-25.6z"/>
              </svg>
              <svg v-else viewBox="0 0 16 16">
                <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.58c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
              </svg>
            </span>
            {{ provider.label }}
          </button>
        </div>
      </div>

      <div class="sync-guide locked">
        <h3>同步</h3>
        <p class="settings-help tight">登录后可绑定当前本地库并增量同步。当前可继续本地编辑。</p>
        <button type="button" class="ghost sync-locked-btn" disabled>
          <span class="btn-ico" aria-hidden="true">
            <svg viewBox="0 0 16 16"><rect x="3.4" y="7.2" width="9.2" height="6.2" rx="1.2"/><path d="M5.4 7.2V5.4a2.6 2.6 0 0 1 5.2 0v1.8"/><path d="M8 9.6v1.8"/></svg>
          </span>
          登录以启用同步
        </button>
      </div>
    </form>
  </section>
</template>
