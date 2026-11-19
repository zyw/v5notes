<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useAccount } from './account'
import { useSyncCoordinator } from './sync'
import WelcomeView from './views/WelcomeView.vue'
import SettingsView from './views/SettingsView.vue'
import WorkspaceView from './views/WorkspaceView.vue'
import type { OpenedVault } from './vault/types'
import { applyAppearance, loadAppearancePrefs } from './appearance/themes'
import { applyVaultColorForPath } from './appearance/vaultColors'
import { stopExtensionRuntime } from './extension/runtime'
import UpdateDialog from './components/UpdateDialog.vue'
import { useAppUpdate } from './update'

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
// Global sync owner: engine + background timer + status live here, not in the
// settings panel, so navigating away never stops syncing (Phase 5).
const sync = useSyncCoordinator(account)

watch(
  () => vault.value?.rootPath,
  path => {
    applyVaultColorForPath(path)
    // Keep the coordinator's vault handle in step with the page state.
    sync.vault.value = vault.value
    void path
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

// 安装前先落盘：更新会重启应用，未保存的笔记必须先保存；保存失败就留在编辑状态。
async function savePristine(): Promise<boolean> {
  if (!workspaceDirty.value || !workspaceRef.value) return true
  const saved = await workspaceRef.value.save()
  if (!saved) banner.value = '当前笔记保存失败，已暂停安装更新'
  return saved
}

const {
  updateState,
  currentVersion,
  updateChecking,
  offeredVersion,
  releaseNotesAvailable,
  requestUpdateCheck,
  showInstalledNotes,
  downloadUpdate,
  installReadyUpdate,
  retryUpdate,
  dismissUpdateLater,
  closeUpdate,
  cancelUpdateDownload,
} = useAppUpdate({
  // 有库打开时先把升级提示收住；新版本先落到「关于本机」，或等退出工作区时再弹出。
  currentVault: () => (page.value === 'workspace' ? vault.value : null),
  savePristine,
})

onMounted(() => {
  applyAppearance(loadAppearancePrefs())
  window.addEventListener('beforeunload', onBeforeUnload)
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
})
</script>

<template>
  <div class="shell" :class="{ 'is-workspace': page === 'workspace', 'is-welcome': page === 'welcome', 'is-settings': page === 'settings' }">
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
      <div class="ribbon-spacer" />
      <button
        type="button"
        class="ribbon-btn"
        title="设置"
        :aria-current="page === 'settings' ? 'page' : undefined"
        @click="goSettings"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <!-- Gear: cog outline with hub, stroke-only like the rest of the rail. -->
          <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.28 7.28 0 0 0-1.73-1l-.38-2.65A.49.49 0 0 0 14 2h-4a.49.49 0 0 0-.49.42l-.38 2.65a7.28 7.28 0 0 0-1.73 1l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .61.22l2.49-1c.52.4 1.09.73 1.73 1l.38 2.65c.04.24.25.42.49.42h4c.24 0 .46-.18.49-.42l.38-2.65a7.28 7.28 0 0 0 1.73-1l2.49 1a.5.5 0 0 0 .61-.22l2-3.46a.5.5 0 0 0-.12-.64zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2" />
        </svg>
      </button>
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

      <main class="main" :class="{ 'main-fill': page === 'workspace' || page === 'welcome' || page === 'settings' }">
        <WelcomeView v-if="page === 'welcome'" @opened="onOpened" />
        <WorkspaceView
          v-else-if="page === 'workspace' && vault"
          ref="workspaceRef"
          :vault="vault"
          @close="closeVault"
          @error="banner = $event"
          @dirty-change="workspaceDirty = $event"
          @settings="goSettings"
        />
        <SettingsView
          v-else
          :account="account"
          :vault="vault"
          :sync="sync"
          :current-version="currentVersion"
          :update-checking="updateChecking"
          :offered-version="offeredVersion"
          :release-notes-available="releaseNotesAvailable"
          @check-update="requestUpdateCheck"
          @show-release-notes="showInstalledNotes"
        />
      </main>
    </div>

    <UpdateDialog
      v-if="updateState.visible"
      :phase="updateState.phase"
      :current-version="currentVersion"
      @download="downloadUpdate"
      @install="installReadyUpdate"
      @retry="retryUpdate"
      @later="dismissUpdateLater"
      @close="closeUpdate"
      @cancel="cancelUpdateDownload"
    />
  </div>
</template>
