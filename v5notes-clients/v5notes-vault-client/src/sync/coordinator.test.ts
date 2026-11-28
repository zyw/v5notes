/**
 * Coordinator smoke tests: engine lifecycle follows login + vault, status
 * pushes land in shared state, and guarded cycles never overlap.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, ref } from 'vue'
import { useSyncCoordinator } from './coordinator'
import type { AccountState } from '../account'
import type { OpenedVault } from '../vault/types'
import type { SyncEngineStatus } from './types'

const engineDouble = vi.hoisted(() => {
  const listeners = new Set<(s: SyncEngineStatus) => void>()
  return {
    listeners,
    pushPullCalls: 0,
    flushCalls: 0,
    createCalls: [] as string[],
    make() {
      return {
        subscribe(fn: (s: SyncEngineStatus) => void) {
          listeners.add(fn)
          return () => {
            listeners.delete(fn)
          }
        },
        startBackgroundSync: () => () => {},
        pushPull: async () => {
          this.pushPullCalls += 1
          const status: SyncEngineStatus = {
            status: 'idle', message: 'ok', conflictPaths: [], lastError: null, updatedAt: '', running: false,
          } as unknown as SyncEngineStatus
          for (const fn of listeners) fn(status)
          return status
        },
        flushRetryQueue: async () => {
          this.flushCalls += 1
          return { status: 'idle' } as unknown as SyncEngineStatus
        },
      }
    },
  }
})

vi.mock('./engine', () => ({
  createSyncEngine: (deps: { rootPath: string }) => {
    engineDouble.createCalls.push(deps.rootPath)
    return engineDouble.make()
  },
}))

function fakeAccount(): AccountState {
  const account = {
    token: ref('tok'),
    server: ref('https://api.example.com'),
    clientId: 'c1',
    logout: async () => {},
    refreshProfileAndPlan: async () => {},
  } as unknown as AccountState
  // Mirror useAccount: loggedIn is derived from the token.
  return new Proxy(account, {
    get(target, prop) {
      if (prop === 'loggedIn') return computed(() => Boolean(target.token.value))
      return Reflect.get(target, prop)
    },
  }) as AccountState
}

const vaultA = { rootPath: '/vault/a', name: 'A', config: {} } as unknown as OpenedVault

beforeEach(() => {
  engineDouble.listeners.clear()
  engineDouble.pushPullCalls = 0
  engineDouble.flushCalls = 0
  engineDouble.createCalls.length = 0
})

describe('sync coordinator', () => {
  it('binds the engine when logged in with an open vault, and stops on logout', async () => {
    const scope = effectScope()
    const account = fakeAccount()
    const coord = scope.run(() => useSyncCoordinator(account))!
    coord.vault.value = vaultA
    await nextTick()
    expect(engineDouble.createCalls).toEqual(['/vault/a'])

    // Logout tears the engine down (loggedIn is derived from token).
    account.token.value = ''
    await nextTick()
    expect(coord.currentEngine()).toBeNull()

    // Re-login rebinds the same root.
    account.token.value = 'tok'
    await nextTick()
    expect(coord.currentEngine()).not.toBeNull()
    expect(engineDouble.createCalls).toEqual(['/vault/a', '/vault/a'])
    scope.stop()
  })

  it('surfaces pushed status and messages to shared state; runExclusive marks busy', async () => {
    const scope = effectScope()
    const account = fakeAccount()
    const coord = scope.run(() => useSyncCoordinator(account))!
    coord.vault.value = vaultA
    await nextTick()

    expect(coord.syncing.value).toBe(false)
    const result = await coord.runExclusive(async () => {
      expect(coord.syncing.value).toBe(true)
      return 42
    })
    expect(result).toBe(42)
    expect(coord.syncing.value).toBe(false)

    await coord.currentEngine()!.pushPull()
    expect(coord.syncStatus.value?.status).toBe('idle')
    expect(coord.lastSyncMessage.value).toBe('ok')
    scope.stop()
  })

  it('exposes loggedIn reactively and runs syncNow exclusively without re-entrancy', async () => {
    const scope = effectScope()
    const account = fakeAccount()
    const coord = scope.run(() => useSyncCoordinator(account))!
    expect(coord.loggedIn.value).toBe(true)

    // No engine bound yet -> syncNow returns null
    expect(await coord.syncNow()).toBeNull()

    coord.vault.value = vaultA
    await nextTick()

    // While an exclusive cycle is already running, syncNow skips instead of re-entering.
    let duringExclusive: SyncEngineStatus | null | undefined
    await coord.runExclusive(async () => {
      duringExclusive = await coord.syncNow()
    })
    expect(duringExclusive).toBeNull()
    expect(engineDouble.pushPullCalls).toBe(0)

    const result = await coord.syncNow()
    expect(result?.status).toBe('idle')
    expect(engineDouble.pushPullCalls).toBe(1)
    expect(coord.syncing.value).toBe(false)

    // Logout updates loggedIn and tears down the engine so syncNow returns null.
    account.token.value = ''
    await nextTick()
    expect(coord.loggedIn.value).toBe(false)
    expect(await coord.syncNow()).toBeNull()
    scope.stop()
  })
})
