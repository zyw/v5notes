<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { isTauri } from '@tauri-apps/api/core'
import { useAccount } from './account'
import { useSyncCoordinator } from './sync'
import WelcomeView from './views/WelcomeView.vue'
import SettingsView from './views/SettingsView.vue'
import WorkspaceView from './views/WorkspaceView.vue'
import type { OpenedVault } from './vault/types'
import { applyAppearance, loadAppearancePrefs } from './appearance/themes'
import { applyVaultColorForPath, setVaultColorFromVault } from './appearance/vaultColors'
import { readAppearanceFile } from './theme-host'
import { vaultWorkspace } from './vault/workspace'
import { attachExtensionRuntimeVault } from './extension/runtime'
import UpdateDialog from './components/UpdateDialog.vue'
import { useAppUpdate } from './update'

type Page = 'welcome' | 'workspace' | 'settings'
const page = ref<Page>('welcome')
const vault = ref<OpenedVault | null>(null)
const banner = ref<string | null>(null)
const workspaceDirty = ref(false)
const settingsRef = ref<{
  clearSwitching: () => void
  reportSwitchFailure: (message: string) => void
} | null>(null)
const workspaceRef = ref<{
  isDirty: () => boolean
  save: () => Promise<boolean>
  requestClose: () => void
} | null>(null)

const account = useAccount()
// Global sync owner: engine + background timer + status live here, not in the
// settings panel, so navigating away never stops syncing (Phase 5).
const sync = useSyncCoordinator(account)

/**
 * 设置页当前正在看哪个库。它可以是没在工作区打开的那个库：
 * 看某个库的设置不等于进入它，所以不碰最近列表、不碰工作区状态。
 */
const settingsVault = ref<OpenedVault | null>(null)
const settingsVaultHandles = computed<OpenedVault | null>(() =>
  page.value === 'settings' ? settingsVault.value : null,
)
watch(page, (next) => {
  if (next !== 'settings') {
    settingsVault.value = null
    return
  }
  if (!settingsVault.value) settingsVault.value = vault.value
})

watch(
  () => vault.value?.rootPath,
  async path => {
    // 库色以库内文件为准；读不到（还没写过）就沿用本机回退。
    let stored: string | undefined
    if (path) {
      try {
        stored = (await readAppearanceFile(path))?.vaultColor
      } catch {
        stored = undefined
      }
    }
    if (path !== vault.value?.rootPath) return
    setVaultColorFromVault(stored, path)
    applyVaultColorForPath(path)
    // The list is still "which library am I editing", so follow the open vault.
    sync.vault.value = vault.value
    void path
  },
  { immediate: true },
)

/** 设置页里的「打开库…」：选完文件夹直接进工作区。 */
async function openVaultFromSettings() {
  if (!isTauri()) {
    banner.value = '请通过桌面应用打开本地文件夹'
    return
  }
  try {
    const opened = await vaultWorkspace.pickAndOpenVault()
    if (opened) {
      settingsVault.value = opened
      onOpened(opened)
    }
  } catch (error) {
    banner.value = error instanceof Error ? error.message : String(error)
  }
}

/** 设置页库列表：把另一个库打开。未保存的笔记先落盘，保存失败就不换。 */
async function switchVaultFromSettings(rootPath: string) {
  const settings = settingsRef.value
  if (workspaceRef.value && workspaceDirty.value) {
    const saved = await workspaceRef.value.save()
    if (!saved) {
      settings?.reportSwitchFailure('当前笔记保存失败，暂不切换库')
      return
    }
  }
  try {
    // 设置页里换库只是换「正在看哪个库的设置」，不是进工作台：
    // 不刷新最近顺序、不打乱库列表，也不改变当前工作区里的库。
    const opened = await vaultWorkspace.openForSettings(rootPath)
    settingsVault.value = opened
    sync.vault.value = opened
  } catch (error) {
    settings?.reportSwitchFailure(error instanceof Error ? error.message : String(error))
  }
}



/** 设置页里删掉了当前这个库的记录：工作区也退出它，回到库列表。 */
function onVaultDeletedFromSettings(rootPath: string) {
  if (vault.value?.rootPath === rootPath) {
    closeVault()
    return
  }
  settingsVault.value = null
  void goWelcomeList()
}

/** 设置页里的「所有库」：回到库的列表，在那里挑一个。 */
function showAllVaults() {
  page.value = 'welcome'
}

function onOpened(opened: OpenedVault) {
  vault.value = opened
  banner.value = null
  page.value = 'workspace'
}

function closeVault() {
  // Extensions are app-level: closing a vault only unbinds the data source.
  attachExtensionRuntimeVault(null)
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
          :sync="sync"
          @close="closeVault"
          @error="banner = $event"
          @dirty-change="workspaceDirty = $event"
          @settings="goSettings"
        />
        <SettingsView
          v-else
          ref="settingsRef"
          :account="account"
          :vault="settingsVaultHandles"
          :sync="sync"
          :current-version="currentVersion"
          :update-checking="updateChecking"
          :offered-version="offeredVersion"
          :release-notes-available="releaseNotesAvailable"
          @check-update="requestUpdateCheck"
          @show-release-notes="showInstalledNotes"
          @open-vault="openVaultFromSettings"
          @open-registry="showAllVaults"
          @switch-vault="switchVaultFromSettings"
          @delete-vault="onVaultDeletedFromSettings"
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