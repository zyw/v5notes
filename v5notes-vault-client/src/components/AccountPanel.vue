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
}>()

const serverBusy = ref(false)
const serverError = ref('')
const showPassword = ref(false)
const syncBusy = ref(false)
const syncMessage = ref('')
const syncStatus = ref<SyncEngineStatus | null>(null)
const devices = ref<VaultDeviceInfo[]>([])
const devicesBusy = ref(false)
const devicesError = ref('')
const kickBusyId = ref<string | null>(null)
const localDeviceId = ref<string | null>(null)
const bgStop = ref<null | (() => void)>(null)
let sharedEngine: SyncEngine | null = null

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
  stopBackground()
  sharedEngine = null
  await props.account.logout()
  syncStatus.value = null
  syncMessage.value = ''
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
  const rootPath = props.vault?.rootPath
  if (!rootPath) throw new Error('请先打开本地库再同步')
  if (sharedEngine) return sharedEngine
  sharedEngine = createSyncEngine({
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
  return sharedEngine
}

function stopBackground() {
  bgStop.value?.()
  bgStop.value = null
  sharedEngine?.stopBackgroundSync()
}

function ensureBackground() {
  if (!canSync.value) return
  try {
    const engine = makeEngine()
    stopBackground()
    bgStop.value = engine.startBackgroundSync()
  } catch {
    /* no vault open */
  }
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

async function onBindAndSync() {
  if (!canSync.value) return
  syncBusy.value = true
  syncMessage.value = ''
  try {
    const engine = makeEngine()
    const plan = await engine.bind()
    syncMessage.value = bootstrapModeLabel(plan.mode)
    const status = await engine.pushPull()
    syncStatus.value = status
    syncMessage.value = `${bootstrapModeLabel(plan.mode)} · ${status.message}`
    await props.account.refreshProfileAndPlan()
    await refreshDevices()
    ensureBackground()
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : '同步失败'
    syncMessage.value = msg.includes('设备') ? `${msg}（${deviceLimitMessage()}）` : msg
  } finally {
    syncBusy.value = false
  }
}

async function onSyncNow() {
  if (!canSync.value) return
  syncBusy.value = true
  try {
    const engine = makeEngine()
    const status = await engine.pushPull()
    syncStatus.value = status
    syncMessage.value = status.message
    await props.account.refreshProfileAndPlan()
    await refreshDevices()
    ensureBackground()
  } catch (cause) {
    syncMessage.value = cause instanceof Error ? cause.message : '同步失败'
  } finally {
    syncBusy.value = false
  }
}

async function onFlushRetry() {
  if (!canSync.value) return
  syncBusy.value = true
  try {
    const engine = makeEngine()
    const status = await engine.flushRetryQueue()
    syncStatus.value = status
    syncMessage.value = status.message
  } catch (cause) {
    syncMessage.value = cause instanceof Error ? cause.message : '重试失败'
  } finally {
    syncBusy.value = false
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

watch(
  () => [props.account.loggedIn.value, props.vault?.rootPath] as const,
  ([loggedIn, root]) => {
    sharedEngine = null
    stopBackground()
    if (loggedIn && root) {
      void refreshDevices()
      ensureBackground()
    } else {
      devices.value = []
    }
  },
)

onMounted(() => {
  if (canSync.value) {
    void refreshDevices()
    ensureBackground()
  }
})

onBeforeUnmount(() => {
  stopBackground()
  sharedEngine = null
})
</script>

<template>
  <section class="settings-block account-panel" aria-labelledby="account-title">
    <h2 id="account-title">账号</h2>
    <p class="settings-help dual-product">{{ account.dualProductLine }}</p>

    <div class="server-row" role="group" aria-label="服务器">
      <button
        type="button"
        class="choice compact-choice"
        :class="{ active: account.useOfficialServer.value }"
        :disabled="serverBusy"
        @click="useOfficial"
      >
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
        <button type="button" class="ghost" :disabled="serverBusy" @click="saveCustomServer">
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
            class="primary"
            :disabled="!canSync || syncBusy"
            @click="onBindAndSync"
          >
            {{ syncBusy ? '同步中…' : '绑定并同步' }}
          </button>
          <button
            type="button"
            class="ghost"
            :disabled="!canSync || syncBusy"
            @click="onSyncNow"
          >
            立即同步
          </button>
          <button
            type="button"
            class="ghost"
            :disabled="!canSync || syncBusy || !(syncStatus?.retryQueueSize)"
            @click="onFlushRetry"
          >
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
        <div class="password-row">
          <input
            v-model="account.password.value"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            placeholder="不会被保存到本地"
            :disabled="account.busy.value"
          >
          <button type="button" class="ghost compact" @click="showPassword = !showPassword">
            {{ showPassword ? '隐藏' : '显示' }}
          </button>
        </div>
        <span v-if="account.fieldPasswordError.value" class="inline-error">{{ account.fieldPasswordError.value }}</span>
      </label>

      <p v-if="account.error.value" class="inline-error" role="alert">{{ account.error.value }}</p>

      <div class="login-actions">
        <button type="submit" class="primary" :disabled="account.busy.value">
          {{ account.busy.value ? '登录中…' : '登录' }}
        </button>
      </div>

      <div v-if="account.socialLoginEnabled.value" class="social-row" role="group" aria-label="第三方登录">
        <button
          v-for="provider in account.socialProviders"
          :key="provider.source"
          type="button"
          class="ghost"
          :disabled="account.busy.value"
          @click="account.startSocialLogin(provider.source)"
        >
          {{ provider.label }}
        </button>
      </div>

      <div class="sync-guide locked">
        <h3>同步</h3>
        <p class="settings-help tight">登录后可绑定当前本地库并增量同步。当前可继续本地编辑。</p>
        <button type="button" class="ghost" disabled>登录以启用同步</button>
      </div>
    </form>
  </section>
</template>
