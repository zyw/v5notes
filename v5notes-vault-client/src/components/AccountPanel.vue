<script setup lang="ts">
import { ref } from 'vue'
import type { AccountState } from '../account'

const props = defineProps<{
  account: AccountState
}>()

const serverBusy = ref(false)
const serverError = ref('')
const showPassword = ref(false)

async function onLogin() {
  await props.account.login()
}

async function onLogout() {
  await props.account.logout()
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
            <dd class="muted">Phase 4 接入 <code>/vault/v1/quota</code>；本地编辑不受限</dd>
          </div>
        </dl>
      </div>

      <div class="sync-guide">
        <h3>同步</h3>
        <p class="settings-help tight">
          已登录。文件同步引擎属于 Phase 4；此处仅引导，不阻断本地编辑。
        </p>
        <button type="button" class="ghost" disabled title="Phase 4 SyncEngine">开启同步（即将推出）</button>
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
        <p class="settings-help tight">登录后可启用多设备同步（Phase 4）。当前可继续本地编辑。</p>
        <button type="button" class="ghost" disabled>登录以启用同步</button>
      </div>
    </form>
  </section>
</template>
