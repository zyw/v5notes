<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AccountState } from '../account'
import { DEFAULT_CLIENT_ID } from '../account/constants'
import { bootstrapModeLabel, createSyncEngine, type SyncEngineStatus } from '../sync'
import type { OpenedVault } from '../vault/types'

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

const canSync = computed(() => Boolean(props.account.loggedIn.value && props.vault?.rootPath))
const vaultSync = computed(() => props.account.plan.value?.vaultSync)

async function onLogin() {
  await props.account.login()
}

async function onLogout() {
  await props.account.logout()
  syncStatus.value = null
  syncMessage.value = ''
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

function makeEngine() {
  const rootPath = props.vault?.rootPath
  if (!rootPath) throw new Error('请先打开本地库再同步')
  return createSyncEngine({
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
  } catch (cause) {
    syncMessage.value = cause instanceof Error ? cause.message : '同步失败'
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
  } catch (cause) {
    syncMessage.value = cause instanceof Error ? cause.message : '同步失败'
  } finally {
    syncBusy.value = false
  }
}
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
          </div>
          <div>
            <dt>Vault 同步额度</dt>
            <dd v-if="vaultSync?.available">
              {{ account.formatBytes(vaultSync.usedBytes) }}
              /
              {{ account.formatBytes(vaultSync.quotaBytes) }}
              · 设备 {{ vaultSync.deviceUsed }}/{{ vaultSync.deviceLimit }}
              <span v-if="vaultSync.overQuota" class="warn">已超额（push 拒 / pull 只读）</span>
            </dd>
            <dd v-else class="muted">尚未获取 <code>/vault/v1/quota</code>；本地编辑不受限</dd>
          </div>
        </dl>
      </div>

      <div class="sync-guide">
        <h3>同步</h3>
        <p class="settings-help tight">
          仅登录后可绑定云端库。未打开本地库时无法同步；离线仍可本地编辑。
          冲突会生成「冲突」副本，不会静默覆盖。
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
        </div>
        <p v-if="syncMessage" class="settings-help tight" role="status">{{ syncMessage }}</p>
        <p v-if="syncStatus?.conflictPaths?.length" class="inline-error" role="alert">
          冲突副本：{{ syncStatus.conflictPaths.join('、') }}
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
