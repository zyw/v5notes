<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useAccount } from './account'
import WelcomeView from './views/WelcomeView.vue'
import SettingsView from './views/SettingsView.vue'
import WorkspaceView from './views/WorkspaceView.vue'
import type { OpenedVault } from './vault/types'
import { applyAppearance, loadAppearancePrefs } from './appearance/themes'
import { applyVaultColorForPath } from './appearance/vaultColors'
import { stopExtensionRuntime } from './extension/runtime'

type Page = 'welcome' | 'workspace' | 'settings'
const page = ref<Page>('welcome')
const vault = ref<OpenedVault | null>(null)
const banner = ref<string | null>(null)
const workspaceDirty = ref(false)
const workspaceRef = ref<{
  isDirty: () => boolean
  save: () => Promise<boolean>
  requestClose: () => void
} | null>(null)

const account = useAccount()

watch(
  () => vault.value?.rootPath,
  path => {
    applyVaultColorForPath(path)
  },
  { immediate: true },
)

function onOpened(opened: OpenedVault) {
  vault.value = opened
  banner.value = null
  page.value = 'workspace'
}

function closeVault() {
  void stopExtensionRuntime()
  vault.value = null
  workspaceDirty.value = false
  page.value = 'welcome'
}

async function goSettings() {
  if (page.value === 'workspace' && workspaceDirty.value && workspaceRef.value) {
    const ok = await workspaceRef.value.save()
    if (!ok) {
      banner.value = '请先保存当前笔记再进入设置'
      return
    }
  }
  page.value = 'settings'
}

function goHome() {
  page.value = vault.value ? 'workspace' : 'welcome'
}

function goWelcomeList() {
  if (vault.value && workspaceDirty.value && workspaceRef.value) {
    workspaceRef.value.requestClose()
    return
  }
  if (vault.value) {
    closeVault()
    return
  }
  page.value = 'welcome'
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!workspaceDirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

function dismissReauth() {
  account.dismissSessionExpired()
}

onMounted(() => {
  applyAppearance(loadAppearancePrefs())
  window.addEventListener('beforeunload', onBeforeUnload)
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
})
</script>

<template>
  <div class="shell" :class="{ 'is-workspace': page === 'workspace', 'is-welcome': page === 'welcome' }">
    <aside class="app-ribbon" aria-label="快捷丝带">
      <img class="ribbon-mark" src="./assets/brand-icon.png" width="26" height="26" alt="" />
      <button
        type="button"
        class="ribbon-btn"
        title="库"
        :aria-current="page === 'welcome' ? 'page' : undefined"
        @click="goWelcomeList"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
      </button>
      <button
        type="button"
        class="ribbon-btn"
        title="工作区"
        :disabled="!vault"
        :aria-current="page === 'workspace' ? 'page' : undefined"
        @click="goHome"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z" />
        </svg>
      </button>
      <button
        type="button"
        class="ribbon-btn"
        title="设置"
        :aria-current="page === 'settings' ? 'page' : undefined"
        @click="goSettings"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
        </svg>
      </button>
      <div class="ribbon-spacer" />
      <span
        v-if="account.loggedIn.value"
        class="ribbon-account"
        :title="account.username.value || undefined"
      >
        {{ (account.profile.value?.nickName || account.username.value || '已登录').slice(0, 1) }}
      </span>
    </aside>

    <div class="shell-body">
      <p v-if="account.sessionExpired.value" class="app-banner reauth-banner" role="status">
        登录已过期，令牌已清除。本地未保存内容仍保留——可继续编辑，或
        <button type="button" class="linkish" @click="goSettings">重新登录</button>
        。
        <button type="button" class="linkish" @click="dismissReauth">知道了</button>
      </p>
      <p v-else-if="banner" class="app-banner" role="status">{{ banner }}</p>

      <main class="main" :class="{ 'main-fill': page === 'workspace' || page === 'welcome' }">
        <WelcomeView v-if="page === 'welcome'" @opened="onOpened" />
        <WorkspaceView
          v-else-if="page === 'workspace' && vault"
          ref="workspaceRef"
          :vault="vault"
          @close="closeVault"
          @error="banner = $event"
          @dirty-change="workspaceDirty = $event"
        />
        <SettingsView v-else :account="account" :vault="vault" />
      </main>
    </div>
  </div>
</template>
