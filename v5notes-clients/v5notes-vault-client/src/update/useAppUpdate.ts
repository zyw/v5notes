import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getVersion } from '@tauri-apps/api/app'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { relaunch } from '@tauri-apps/plugin-process'
import type { OpenedVault } from '../vault/types'
import {
  initialUpdateState,
  messageForCheckFailure,
  messageForTransferFailure,
  notesToShowOnLaunch,
  parsePendingNotes,
  reduceUpdate,
  shouldAutoPrompt,
  shouldCheckSilently,
  SILENT_CHECK_DELAY_MS,
  UPDATE_CHECKED_AT_KEY,
  UPDATE_DISMISSED_KEY,
  UPDATE_NOTES_KEY,
  type HostOs,
  type PendingReleaseNotes,
  type ReleaseOffer,
  type UpdateEvent,
  type UpdateState,
} from './appUpdate'

/** 开发运行（vite dev）没有安装包可覆盖，检查与安装都只在打包后的应用里进行。 */
function updatesSupported(): boolean {
  return isTauri() && !import.meta.env.DEV
}

function errorText(cause: unknown): string {
  if (cause instanceof Error) return cause.message
  return typeof cause === 'string' ? cause : ''
}

interface RemoteOffer {
  version: string
  notes?: string | null
  date?: string | null
}

function guessOs(): HostOs {
  const agent = navigator.userAgent
  if (/Windows/i.test(agent)) return 'windows'
  if (/Mac/i.test(agent)) return 'macos'
  return 'linux'
}

export interface AppUpdateOptions {
  /** 当前打开库的根目录；每次调用都取最新值。 */
  currentVault: () => OpenedVault | null
  /** 编辑器里有未保存的笔记时，先保存。返回 true 才继续安装。 */
  savePristine: () => Promise<boolean>
}

export function useAppUpdate(options: AppUpdateOptions) {
  const state = ref<UpdateState>(initialUpdateState())
  const installedNotes = ref<PendingReleaseNotes | null>(null)
  const currentVersion = ref('')
  let updateReady = false
  let checkToken = 0
  let hostOs: HostOs = guessOs()
  let silentTimer: number | undefined
  let downloadCancelled = false
  /** 静默检查发现新版本，但用户正在写笔记：等他离开工作区再弹。 */
  let waitingToReveal = false

  const updateChecking = computed(() => state.value.phase.kind === 'checking')
  const offeredVersion = computed(() => state.value.offer?.version ?? null)
  const releaseNotesAvailable = computed(
    () => installedNotes.value?.version === currentVersion.value && currentVersion.value !== '',
  )
  /** 工作区里有打开的库、且编辑器没有未保存改动时，才适合打断用户。 */
  const quietMoment = computed(() => options.currentVault() === null)

  function apply(event: UpdateEvent): void {
    state.value = reduceUpdate(state.value, event)
  }

  async function readHostOs(): Promise<void> {
    if (!isTauri()) return
    try {
      const value = await invoke<string>('update_host_os')
      if (value === 'windows' || value === 'linux' || value === 'macos') hostOs = value
    } catch {
      hostOs = guessOs()
    }
  }

  async function releaseUpdate(): Promise<void> {
    updateReady = false
    if (!isTauri()) return
    try {
      await invoke('app_update_close')
    } catch {
      // 丢掉这次检查结果后，继续使用当前版本。
    }
  }

  async function runCheck(manual: boolean): Promise<void> {
    if (!updatesSupported()) {
      if (manual) apply({ type: 'unsupported' })
      return
    }
    const token = ++checkToken
    apply(manual ? { type: 'manual-check' } : { type: 'silent-check' })
    try {
      const update = await invoke<RemoteOffer | null>('app_update_check')
      if (token !== checkToken) {
        await releaseUpdate()
        return
      }
      localStorage.setItem(UPDATE_CHECKED_AT_KEY, new Date().toISOString())
      if (!update) {
        updateReady = false
        apply({ type: 'up-to-date' })
        return
      }
      updateReady = true
      const dismissed = localStorage.getItem(UPDATE_DISMISSED_KEY)
      if (dismissed && dismissed !== update.version) localStorage.removeItem(UPDATE_DISMISSED_KEY)
      const offer: ReleaseOffer = {
        version: update.version,
        notes: update.notes ?? '',
        date: update.date ?? undefined,
        downloaded: false,
      }
      const prompt = shouldAutoPrompt(localStorage.getItem(UPDATE_DISMISSED_KEY), update.version)
      const reveal = manual || (prompt && quietMoment.value)
      waitingToReveal = !manual && prompt && !reveal
      apply({ type: 'available', offer, reveal })
    } catch (cause) {
      if (token !== checkToken) return
      await releaseUpdate()
      apply({ type: 'check-failed', message: messageForCheckFailure(errorText(cause), hostOs) })
    }
  }

  /** 手动入口：检查中/下载中忽略，已有结果就重新打开，否则重新检查。 */
  function requestUpdateCheck(): void {
    const kind = state.value.phase.kind
    if (kind === 'checking' || kind === 'downloading' || kind === 'installing') return
    if (state.value.offer) {
      apply({ type: 'reopen' })
      return
    }
    void runCheck(true)
  }

  async function downloadUpdate(): Promise<void> {
    if (state.value.phase.kind !== 'available') return
    // 窗口可能在检查之后被闲置释放，这时重新检查一次再下载。
    if (!updateReady) await runCheck(true)
    if (!updateReady || state.value.phase.kind !== 'available') return
    downloadCancelled = false
    apply({ type: 'download' })
    let received = 0
    let total: number | undefined
    let unlisten: UnlistenFn | undefined
    try {
      unlisten = await listen<{ received: number; total?: number | null }>('update-download-progress', event => {
        received += event.payload.received
        if (typeof event.payload.total === 'number') total = event.payload.total
        if (!downloadCancelled) apply({ type: 'progress', received, total })
      })
      await invoke('app_update_download')
      if (downloadCancelled) return
      apply({ type: 'downloaded' })
      await installReadyUpdate()
    } catch (cause) {
      if (downloadCancelled) return
      apply({ type: 'failed', message: messageForTransferFailure(errorText(cause)), retry: 'download' })
    } finally {
      unlisten?.()
    }
  }

  async function installReadyUpdate(): Promise<void> {
    const kind = state.value.phase.kind
    if (kind !== 'ready' && kind !== 'downloading') return
    let allowed = false
    try {
      allowed = await options.savePristine()
    } catch {
      allowed = false
    }
    if (!allowed) {
      apply({ type: 'install-deferred' })
      return
    }
    const offer =
      state.value.offer ??
      (state.value.phase.kind === 'ready' || state.value.phase.kind === 'downloading' ? state.value.phase.offer : null)
    if (offer) {
      const pending: PendingReleaseNotes = { version: offer.version, notes: offer.notes, pubDate: offer.date, seen: false }
      localStorage.setItem(UPDATE_NOTES_KEY, JSON.stringify(pending))
      installedNotes.value = pending
    }
    apply({ type: 'install' })
    try {
      await invoke('app_update_install')
      // Windows 的安装器接管并重启进程；其他平台由插件重启。
      if (hostOs !== 'windows') await relaunch()
    } catch (cause) {
      apply({ type: 'failed', message: messageForTransferFailure(errorText(cause)), retry: 'download' })
    }
  }

  async function cancelUpdateDownload(): Promise<void> {
    downloadCancelled = true
    apply({ type: 'cancel-download' })
    try {
      await invoke('app_update_cancel')
    } catch {
      // 取消之后继续使用当前版本。
    }
  }

  async function retryUpdate(): Promise<void> {
    if (state.value.phase.kind !== 'error') return
    if (state.value.phase.retry === 'check') {
      await runCheck(true)
      return
    }
    apply({ type: 'cancel-download' })
    await downloadUpdate()
  }

  /** 「稍后」记住这个版本，静默检查不再为它打断用户。 */
  function dismissUpdateLater(): void {
    const offer = state.value.offer
    if (offer) localStorage.setItem(UPDATE_DISMISSED_KEY, offer.version)
    waitingToReveal = false
    apply({ type: 'close' })
  }

  function closeUpdate(): void {
    if (state.value.phase.kind === 'checking') checkToken += 1
    if (state.value.phase.kind === 'installed-notes' && installedNotes.value) {
      const seen = { ...installedNotes.value, seen: true }
      installedNotes.value = seen
      localStorage.setItem(UPDATE_NOTES_KEY, JSON.stringify(seen))
    }
    apply({ type: 'close' })
  }

  function showInstalledNotes(): void {
    const notes = installedNotes.value
    if (!notes || notes.version !== currentVersion.value) return
    apply({ type: 'show-installed', offer: { version: notes.version, notes: notes.notes, date: notes.pubDate, downloaded: true } })
  }

  watch(quietMoment, quiet => {
    if (!quiet || !waitingToReveal || state.value.phase.kind !== 'available' || state.value.visible) return
    waitingToReveal = false
    apply({ type: 'reveal' })
  })

  onMounted(() => {
    void (async () => {
      await readHostOs()
      if (!isTauri()) return
      try {
        const version = await getVersion()
        currentVersion.value = version
        const pending = parsePendingNotes(localStorage.getItem(UPDATE_NOTES_KEY))
        if (pending?.version === version) installedNotes.value = pending
        const unseen = notesToShowOnLaunch(pending, version)
        if (unseen) {
          apply({ type: 'show-installed', offer: { version: unseen.version, notes: unseen.notes, date: unseen.pubDate, downloaded: true } })
        }
      } catch {
        currentVersion.value = ''
      }
      if (!updatesSupported() || !shouldCheckSilently(localStorage.getItem(UPDATE_CHECKED_AT_KEY), Date.now())) return
      silentTimer = window.setTimeout(() => {
        void runCheck(false)
      }, SILENT_CHECK_DELAY_MS)
    })()
  })

  onBeforeUnmount(() => {
    if (silentTimer !== undefined) window.clearTimeout(silentTimer)
  })

  return {
    updateState: state,
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
  }
}

export type AppUpdate = ReturnType<typeof useAppUpdate>
