/**
 * Global sync coordinator (Phase 5 hardening).
 *
 * Owns the single SyncEngine instance for the opened vault so background sync,
 * retry draining and status updates survive navigating between workspace and
 * settings. Previously the engine and its timer lived inside AccountPanel —
 * leaving the settings page unmounted the timer and orphaned in-flight state.
 *
 * Event sources: the interval tick, browser online/offline transitions, app
 * focus/visibility returns, explicit user actions, and vault/login changes
 * through App.vue wiring. The engine's `subscribe` pushes every status
 * transition here, so UI reflects background cycles without polling.
 */

import { computed, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { createSyncEngine, type SyncEngine } from './engine'
import type { SyncEngineStatus } from './types'
import type { AccountState } from '../account'
import type { OpenedVault } from '../vault/types'
import { DEFAULT_CLIENT_ID } from '../account/constants'

export interface SyncCoordinatorHandles {
  /** The opened vault; set by App.vue when a library opens/closes. */
  vault: Ref<OpenedVault | null>
  /** Engine for action buttons; null when nothing is bindable right now. */
  currentEngine(): SyncEngine | null
  /** Latest status pushed by the engine (manual or background cycles). */
  syncStatus: { readonly value: SyncEngineStatus | null }
  /** Writable so action handlers can surface error text the engine never emitted. */
  lastSyncMessage: { value: string }
  /** True while any cycle (manual or background) is running. */
  syncing: ComputedRef<boolean>
  /** Wrap a manual cycle so the shared busy indicator covers it too. */
  runExclusive<T>(fn: () => Promise<T>): Promise<T>
}

export function useSyncCoordinator(account: AccountState): SyncCoordinatorHandles {
  const vault = ref<OpenedVault | null>(null)
  const engine = ref<SyncEngine | null>(null)
  const syncStatus = ref<SyncEngineStatus | null>(null)
  const lastSyncMessage = ref('')
  const activeCycles = ref(0)

  let bgStop: (() => void) | null = null
  let eventCleanups: Array<() => void> = []
  let boundRootPath: string | null = null

  const syncing = computed(() => activeCycles.value > 0)

  function canSync(): boolean {
    return Boolean(account.loggedIn.value && account.token.value && vault.value?.rootPath)
  }

  function teardown() {
    bgStop?.()
    bgStop = null
    for (const off of eventCleanups) off()
    eventCleanups = []
    boundRootPath = null
    engine.value = null
    syncStatus.value = null
    lastSyncMessage.value = ''
  }

  /** Apply a status push to shared state; quota copy refreshes with it. */
  function applyStatus(status: SyncEngineStatus) {
    syncStatus.value = status
    if (status.message) lastSyncMessage.value = status.message
    // Keeps plan-backed rows fresh after background cycles; failures are
    // surfaced by the account layer itself, not the sync path.
    void account.refreshProfileAndPlan().catch(() => {})
  }

  /** Guarded cycle: skip when one is already running, count toward `syncing`. */
  async function guardedCycle(run: (active: SyncEngine) => Promise<SyncEngineStatus>) {
    if (activeCycles.value > 0) return
    activeCycles.value += 1
    try {
      await run(engine.value!).then(applyStatus)
    } catch {
      /* engine reports via subscribe/error status; never throw out of events */
    } finally {
      activeCycles.value -= 1
    }
  }

  function start() {
    if (!canSync()) return
    const rootPath = vault.value!.rootPath
    if (!engine.value || boundRootPath !== rootPath) {
      stop()
      engine.value = createSyncEngine({
        rootPath,
        getAuth: () => ({
          server: account.server.value,
          clientId: account.clientId || DEFAULT_CLIENT_ID,
          token: account.token.value,
        }),
        onUnauthorized: () => {
          void account.logout()
        },
      })
      boundRootPath = rootPath
    }
    // Engine emits on every setStatus — background cycles included.
    eventCleanups.push(engine.value.subscribe(applyStatus))

    bgStop = engine.value.startBackgroundSync()

    // Network recovery: drain the queue as soon as we are back, not next tick.
    const onOnline = () => {
      void guardedCycle(a => a.flushRetryQueue())
    }
    // Returning to the app reconciles immediately rather than waiting for the
    // interval; skip when a cycle is already running.
    const wake = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      void guardedCycle(a => a.pushPull())
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline)
      window.addEventListener('focus', wake)
      eventCleanups.push(
        () => window.removeEventListener('online', onOnline),
        () => window.removeEventListener('focus', wake),
      )
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', wake)
      eventCleanups.push(() => document.removeEventListener('visibilitychange', wake))
    }
  }

  function stop() {
    teardown()
  }

  // Login/logout and vault switch rebind the coordinator.
  watch(
    () => [account.loggedIn.value, vault.value?.rootPath] as const,
    ([loggedIn, root]) => {
      if (loggedIn && root) start()
      else stop()
    },
  )

  async function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    activeCycles.value += 1
    try {
      return await fn()
    } finally {
      activeCycles.value -= 1
    }
  }

  return {
    vault,
    currentEngine: () => engine.value,
    syncStatus,
    lastSyncMessage,
    syncing,
    runExclusive,
  }
}
