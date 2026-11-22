<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AccountState } from '../account'
import { DEFAULT_CLIENT_ID } from '../account/constants'
import {
  bootstrapModeLabel,
  cloudQuotaHelp,
  createSyncEngine,
  describeDeviceLabel,
  replicaLimitMessage,
  formatVaultQuotaLine,
  kickBlockedLabel,
  kickBlockedReason,
  formatHashReport,
  localDeviceNames,
  vaultSyncQuotaHelp,
  type SyncCoordinatorHandles,
  type SyncEngine,
  type SyncEngineStatus,
  type VaultReplicaInfo,
} from '../sync'
import ConfirmDialog from './ConfirmDialog.vue'
import { liveDocKinds } from '../extension/runtime'
import type { OpenedVault } from '../vault/types'
import { readTextFile } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'
import { VAULT_JSON_REL } from '../vault/skeleton'
import type { VaultJson } from '../models/vault'

const props = withDefaults(defineProps<{
  account: AccountState
  vault?: OpenedVault | null
  /** Global coordinator from App.vue; local engine only as a fallback. */
  sync?: SyncCoordinatorHandles | null
  /** 'account' shows identity only; 'sync' shows what acts on syncing. */
  mode?: 'account' | 'sync'
  /** A section that already shows the server address leaves it out here. */
  hideServer?: boolean
  /** Place named in a failure report, e.g. '账户'. */
  subject?: string
}>(), {
  mode: 'account',
  hideServer: false,
  subject: '账户',
})

const serverBusy = ref(false)
const serverError = ref('')
const showPassword = ref(false)
const logoutConfirmOpen = ref(false)
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
const replicas = ref<VaultReplicaInfo[]>([])
const replicasBusy = ref(false)
const replicasError = ref('')
const kickBusyId = ref<string | null>(null)
const kickConfirm = ref<VaultReplicaInfo | null>(null)
/** Replica id of the vault open here; identifies this row in the list. */
const localReplicaId = ref<string | null>(null)
/** Cloud library this local vault is bound to; null until 绑定并同步. */
const cloudVaultId = ref<string | null>(null)
const bound = computed(() => Boolean(cloudVaultId.value))
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
  replicas.value = []
  localReplicaId.value = null
  logoutConfirmOpen.value = false
}

/**
 * The server address decides where login and sync both go, so it is set once.
 * Using an address signs out of the previous one: its token and sync binding
 * do not carry over, and hiding that would send the next request somewhere
 * the user never chose.
 */
async function applyServer(next: { server: string; official: boolean }) {
  serverBusy.value = true
  serverError.value = ''
  try {
    const changed = next.official
      ? !props.account.useOfficialServer.value
      : next.server.trim().replace(/\/+$/, '') !== (props.account.useOfficialServer.value ? '' : props.account.server.value)
    await props.account.saveServer(next)
    if (changed && props.account.loggedIn.value) {
      await onLogout()
      setSyncMessage('')
      syncMessageLocal.value = '服务器地址已更换，请重新登录'
    }
  } catch (cause) {
    serverError.value = cause instanceof Error ? cause.message : '无法保存服务器'
  } finally {
    serverBusy.value = false
  }
}

/** 开关探测失败时重试；仍失败则以带原因的错误就地反馈，不做全局弹窗。 */
async function retrySocialProbe() {
  serverBusy.value = true
  serverError.value = ''
  try {
    const ok = await props.account.probeAuthFeatures()
    if (!ok) serverError.value = `无法连接 ${props.account.server.value}`
  } finally {
    serverBusy.value = false
  }
}

function useOfficial() {
  return applyServer({ server: props.account.server.value, official: true })
}

function saveCustomServer() {
  return applyServer({ server: props.account.customServer.value, official: false })
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
    docKinds: () => liveDocKinds(),
  })
  return fallbackEngine
}

/** This copy's replica id and binding come from the vault's own vault.json. */
async function refreshLocalReplicaId() {
  localReplicaId.value = null
  cloudVaultId.value = null
  const root = props.vault?.rootPath
  if (!root) return
  try {
    const raw = await readTextFile(await join(root, VAULT_JSON_REL))
    const config = JSON.parse(raw) as VaultJson
    localReplicaId.value = config.binding.replicaId
    cloudVaultId.value = config.binding.cloudVaultId
  } catch {
    localReplicaId.value = null
    cloudVaultId.value = null
  }
}

async function refreshReplicas() {
  replicasBusy.value = true
  replicasError.value = ''
  try {
    // Local identity first: it decides which row is this copy even when the
    // cloud list itself cannot be fetched.
    await refreshLocalReplicaId()
    if (!canSync.value) {
      replicas.value = []
      return
    }
    const engine = makeEngine()
    replicas.value = await engine.listReplicas()
  } catch (cause) {
    replicasError.value = cause instanceof Error ? cause.message : '无法加载副本列表'
  } finally {
    replicasBusy.value = false
  }
}

/** Labels this machine has sent for the open library; the row carries the last one. */
const myLabels = computed(() => localDeviceNames(
  props.account.server.value,
  cloudVaultId.value,
  typeof navigator === 'undefined' ? null : navigator.userAgent,
))

/**
 * The replica id in vault.json only identifies this directory. When the same
 * machine bound the same library from another directory it shows up as a
 * second row carrying this machine's device id and a label it already sent.
 */
function isLocalRow(replica: VaultReplicaInfo): boolean {
  if (replica.replicaId === localReplicaId.value) return true
  const label = replica.clientInfo?.trim()
  return Boolean(label) && myLabels.value.includes(label as string)
}

/** One name for a replica everywhere it is shown: the row and its confirmation. */
function replicaTitle(replica: VaultReplicaInfo | null): string {
  const parts = describeDeviceLabel(replica?.clientInfo)
  // A legacy label is a build tag, not a name; the row's context carries identity.
  return parts.legacy || !parts.name ? '未命名的副本' : parts.name
}

/** The button only stays clickable where removing the row actually frees a slot. */
function blockReason(replica: VaultReplicaInfo) {
  return kickBlockedReason({
    replicaId: replica.replicaId,
    localReplicaId: isLocalRow(replica) ? replica.replicaId : localReplicaId.value,
    bound: bound.value,
    // listReplicas() only resolves for this vault's cloud library; other vaults'
    // rows come from a listing that cannot be kicked from here.
    inLocalVault: replica.vaultId === cloudVaultId.value,
    lastSeenAt: replica.lastSeenAt,
  })
}

function requestKick(replica: VaultReplicaInfo) {
  if (blockReason(replica)) return
  replicasError.value = ''
  kickConfirm.value = replica
}

async function onKick(replica: VaultReplicaInfo) {
  kickBusyId.value = replica.replicaId
  replicasError.value = ''
  try {
    const engine = makeEngine()
    await engine.kickReplica(replica.replicaId)
    kickConfirm.value = null
    await refreshReplicas()
    await props.account.refreshProfileAndPlan()
  } catch (cause) {
    replicasError.value = cause instanceof Error ? cause.message : '停止同步失败'
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
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : '同步失败'
    const shown = msg.includes('设备') || msg.includes('副本') ? `${msg}（${replicaLimitMessage()}）` : msg
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

/** A queue entry that keeps failing on hash will never clear on its own. */
const hashMismatchPath = computed(() => {
  const engine = props.sync?.currentEngine() ?? fallbackEngine
  return engine?.getRetryQueue().find(item => item.lastErrorCode === 'vault.hash.mismatch')?.path ?? null
})

async function copyHashReport() {
  const path = hashMismatchPath.value
  if (!path) return
  const engine = props.sync?.currentEngine() ?? fallbackEngine
  if (!engine) return
  try {
    const report = await engine.describeFileHash(path)
    await navigator.clipboard.writeText(formatHashReport(report))
    setSyncMessage('同步诊断已复制')
  } catch (cause) {
    setSyncMessage(cause instanceof Error ? cause.message : '无法生成同步诊断')
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

// Replica list and fallback-engine lifecycle only; the coordinator owns the
// engine, its background timer, online/focus wakeups, and status pushes.
watch(
  () => [props.account.loggedIn.value, props.vault?.rootPath] as const,
  ([loggedIn, root]) => {
    fallbackEngine = null
    if (loggedIn && root) {
      void refreshReplicas()
    } else {
      replicas.value = []
      void refreshLocalReplicaId()
    }
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
    void refreshReplicas()
  } else if (canSync.value) {
    void refreshReplicas()
  }
})

onBeforeUnmount(() => {
  fallbackEngine?.stopBackgroundSync()
  fallbackEngine = null
})
</script>

<template>
  <section class="settings-block account-panel" aria-labelledby="account-title">
    <h2 id="account-title">{{ props.mode === 'sync' ? '同步' : '账号' }}</h2>

    <div v-if="!props.hideServer" class="server-row" role="group" aria-label="服务器">
      <button
        type="button"
        class="choice compact-choice server-choice"
        :class="{ active: account.useOfficialServer.value }"
        :aria-pressed="account.useOfficialServer.value"
        :disabled="serverBusy"
        @click="useOfficial"
      >
        <span class="btn-ico" aria-hidden="true">
          <svg viewBox="0 0 16 16"><path d="M3.2 10.2a2.4 2.4 0 0 1 .4-4.7A3.4 3.4 0 0 1 9.8 4a2.8 2.8 0 0 1 2.8 2.7 2.2 2.2 0 0 1 .2 4.3H3.6"/><path d="M8 8.2v3.4M6.4 10.2 8 11.8l1.6-1.6"/></svg>
        </span>
        <strong>官方服务器</strong>
      </button>
      <form class="custom-server" @submit.prevent="saveCustomServer">
        <label class="sr-only" for="vault-server">自定义服务器</label>
        <input
          id="vault-server"
          v-model="account.customServer.value"
          type="url"
          autocomplete="url"
          placeholder="https://your-server.example"
          :disabled="serverBusy"
        >
        <button type="submit" class="ghost server-custom-btn" :disabled="serverBusy">
          <span class="btn-ico server-state-ico" aria-hidden="true">
            <svg v-if="account.useOfficialServer.value" viewBox="0 0 16 16" class="i-cloud"><path d="M3.2 10.2a2.4 2.4 0 0 1 .4-4.7A3.4 3.4 0 0 1 9.8 4a2.8 2.8 0 0 1 2.8 2.7 2.2 2.2 0 0 1 .2 4.3H3.6"/><path d="M8 8.2v3.4M6.4 10.2 8 11.8l1.6-1.6"/></svg>
            <svg v-else viewBox="0 0 16 16" class="i-check"><path d="m3.4 8.4 3 3 6.2-6.6"/></svg>
          </span>
          {{ serverBusy ? '检测中…' : '使用自定义' }}
        </button>
        <!-- 开关探测失败时就地重试：落在自定义地址那一行的末尾，不另起一行 -->
        <button
          v-if="account.socialProbeFailed.value"
          type="button"
          class="ghost server-retry-btn"
          :disabled="serverBusy"
          :aria-label="'重新检测第三方登录'"
          title="重新检测第三方登录"
          @click="retrySocialProbe"
        >
          <span class="btn-ico" aria-hidden="true">
            <svg viewBox="0 0 16 16"><path d="M13 8a5 5 0 1 1-1.5-3.6"/><path d="M13 2.6v3h-3"/></svg>
          </span>
        </button>
      </form>
      <p v-if="serverError" class="inline-error" role="alert">{{ serverError }}</p>
    </div>

    <div v-if="account.loggedIn.value" class="account-card">
      <template v-if="props.mode === 'account'">
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
      </template>

      <div v-if="props.mode === 'sync'" class="sync-guide">
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
        <p v-if="hashMismatchPath" class="sync-diagnose" role="status">
          <span>同步被拒：{{ hashMismatchPath }}</span>
          <button type="button" class="sync-diagnose-btn" @click="copyHashReport">复制诊断</button>
        </p>
        <p v-if="syncStatus && !syncStatus.online" class="inline-error" role="status">当前离线 · 恢复网络后自动重试</p>
        <p v-if="syncStatus?.conflictPaths?.length" class="inline-error" role="alert">
          冲突副本：{{ syncStatus.conflictPaths.join('、') }}
        </p>
        <ul v-if="syncStatus?.skippedTooLarge?.length" class="attachment-badges" aria-label="超限附件">
          <li v-for="item in syncStatus.skippedTooLarge" :key="item" class="attachment-badge">{{ item }}</li>
        </ul>
      </div>

      <div v-if="props.mode === 'sync'" class="device-panel" aria-labelledby="replicas-title">
        <div class="device-head">
          <h3 id="replicas-title">同步副本</h3>
          <button
            type="button"
            class="device-refresh"
            :disabled="!canSync || replicasBusy"
            :aria-label="replicasBusy ? '正在刷新副本列表' : '刷新副本列表'"
            title="刷新副本列表"
            @click="refreshReplicas"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M12.8 8a4.8 4.8 0 1 1-1.4-3.4"/>
              <path d="M12.8 2.8v2.9H9.9"/>
            </svg>
          </button>
        </div>

        <p v-if="replicasError" class="inline-error" role="alert">{{ replicasError }}</p>

        <ul v-if="replicas.length" class="device-list" :aria-busy="replicasBusy">
          <li
            v-for="device in replicas"
            :key="device.id"
            class="device-row"
            :class="{ 'is-local': isLocalRow(device) }"
          >
            <span class="device-glyph" aria-hidden="true">
              <svg v-if="describeDeviceLabel(device.clientInfo).platform === 'windows'" viewBox="0 0 16 16"><path d="M2.6 3.8 7.4 3v4.2H2.6zM8.6 2.8 13.4 2v5.2H8.6zM2.6 8.6h4.8V13l-4.8-.8zM8.6 8.6h4.8V14l-4.8-.8z"/></svg>
              <svg v-else-if="describeDeviceLabel(device.clientInfo).platform === 'linux'" viewBox="0 0 16 16"><path d="M8 2.2c1.5 0 2.3 1.3 2.3 2.9 0 1 .6 1.6 1.2 2.5.7 1 1 2 .7 3.2-.4 1.5-2 2.4-4.2 2.4s-3.8-.9-4.2-2.4c-.3-1.2 0-2.2.7-3.2.6-.9 1.2-1.5 1.2-2.5C5.7 3.5 6.5 2.2 8 2.2z"/><path d="M6.8 6.2h.01M9.2 6.2h.01"/></svg>
              <svg v-else-if="describeDeviceLabel(device.clientInfo).platform === 'android' || describeDeviceLabel(device.clientInfo).platform === 'ios'" viewBox="0 0 16 16"><rect x="4.4" y="2.6" width="7.2" height="10.8" rx="1.6"/><path d="M7 11.4h2"/></svg>
              <svg v-else viewBox="0 0 16 16"><rect x="2.4" y="3.2" width="11.2" height="7.2" rx="1.2"/><path d="M5.4 13h5.2M8 10.4V13"/></svg>
            </span>
            <div class="device-copy">
              <strong>
                {{ replicaTitle(device) }}
                <span v-if="isLocalRow(device)" class="device-tag">本机</span>
              </strong>
              <p class="device-meta">
                <time :datetime="device.lastSeenAt || undefined">{{ formatSeen(device.lastSeenAt) }}</time>
              </p>
            </div>
            <button
              v-if="!blockReason(device)"
              type="button"
              class="device-kick"
              :disabled="kickBusyId === device.replicaId"
              @click="requestKick(device)"
            >
              {{ kickBusyId === device.replicaId ? '停止中…' : '停止同步' }}
            </button>
            <!-- 本机行已有「本机」标签，不再重复一个同字的状态位 -->
            <span v-else-if="blockReason(device) !== 'local'" class="device-state">
              {{ kickBlockedLabel(blockReason(device)) }}
            </span>
            <span v-else aria-hidden="true"></span>
          </li>
        </ul>

        <ul v-else-if="replicasBusy" class="device-list" aria-hidden="true">
          <li class="device-row is-skeleton"><span class="device-skel-bar"></span></li>
          <li class="device-row is-skeleton"><span class="device-skel-bar short"></span></li>
        </ul>

        <p v-else-if="bound" class="device-empty">云端还没有登记任何副本。</p>
        <p v-else-if="canSync" class="device-empty">这台库还没有绑定到云端。</p>
        <details
          v-if="replicas.length && !replicas.some(d => describeDeviceLabel(d.clientInfo).platform)"
          class="device-footnote"
        >
          <summary>名称说明</summary>
          <p>这些副本早于名称规则上线，名称由云端保存的旧标签决定，不作为身份依据。</p>
        </details>
      </div>

      <button v-if="props.mode === 'account'" type="button" class="danger" @click="logoutConfirmOpen = true">退出登录</button>
    </div>

    <form v-else-if="props.mode === 'account'" class="login-form" :aria-label="props.subject + '登录'" @submit.prevent="onLogin">

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
        <template v-if="account.socialLoginEnabled.value">
          <span class="auth-sep" role="separator" aria-label="或使用第三方登录"><span>或</span></span>
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
        </template>
      </div>

    </form>
    <p v-else class="settings-help tight muted">登录后可绑定当前本地库并增量同步。</p>

    <ConfirmDialog
      :open="Boolean(kickConfirm)"
      title="停止这份副本的同步？"
      :message="`「${replicaTitle(kickConfirm)}」将不能再同步这个库，要重新绑定才能继续。云端笔记不会被删除。`"
      confirm-label="停止同步"
      :busy="Boolean(kickBusyId)"
      danger
      @cancel="kickConfirm = null"
      @confirm="kickConfirm && onKick(kickConfirm)"
    />

    <ConfirmDialog
      :open="logoutConfirmOpen"
      title="退出登录？"
      message="会移除这台机器保存的登录凭证，并停止当前库的同步；本地笔记保持原样，重新登录后可继续同步。"
      confirm-label="退出登录"
      danger
      @cancel="logoutConfirmOpen = false"
      @confirm="onLogout"
    />
  </section>
</template>
