import { describe, expect, it } from 'vitest'
import { describeWorkspaceSyncButton, workspaceSyncToastMessage } from './workspaceSyncAction'
import type { SyncEngineStatus } from './types'

function makeStatus(overrides: Partial<SyncEngineStatus> = {}): SyncEngineStatus {
  return {
    status: 'idle',
    message: '已同步',
    lastCursor: '10',
    cloudVaultId: 'v1',
    overQuota: false,
    lastErrorCode: null,
    conflictPaths: [],
    skippedTooLarge: [],
    retryQueueSize: 0,
    online: true,
    ...overrides,
  }
}

describe('describeWorkspaceSyncButton', () => {
  it('reports spinning while syncing or in active engine phases', () => {
    const busy = describeWorkspaceSyncButton({
      loggedIn: true,
      syncing: true,
      status: makeStatus({ status: 'syncing', message: '同步中…' }),
      shortcut: '⌘⇧S',
    })
    expect(busy).toEqual({
      tone: 'spinning',
      ariaLabel: '正在同步',
      title: '正在同步：同步中…',
      badge: '同步中…',
    })

    for (const phase of ['binding', 'retrying'] as const) {
      const state = describeWorkspaceSyncButton({
        loggedIn: true,
        syncing: false,
        status: makeStatus({ status: phase, message: '' }),
      })
      expect(state.tone).toBe('spinning')
      expect(state.title).toBe('正在同步…')
    }
  })

  it('reports unauthenticated when not logged in', () => {
    const state = describeWorkspaceSyncButton({
      loggedIn: false,
      syncing: false,
      status: null,
      shortcut: '⌘⇧S',
    })
    expect(state).toEqual({
      tone: 'unauthenticated',
      ariaLabel: '同步（未登录）',
      title: '未登录，点击前往登录并同步（⌘⇧S）',
      badge: '未登录',
    })
  })

  it('reports idle with and without prior sync message', () => {
    const fresh = describeWorkspaceSyncButton({
      loggedIn: true,
      syncing: false,
      status: makeStatus({ message: '未同步' }),
      shortcut: '⌘⇧S',
    })
    expect(fresh).toEqual({
      tone: 'idle',
      ariaLabel: '立即同步',
      title: '立即同步（⌘⇧S）',
    })

    const synced = describeWorkspaceSyncButton({
      loggedIn: true,
      syncing: false,
      status: makeStatus({ message: '已拉取 2 项' }),
      shortcut: 'Ctrl+Shift+S',
    })
    expect(synced).toEqual({
      tone: 'idle',
      ariaLabel: '立即同步',
      title: '立即同步（Ctrl+Shift+S） · 已拉取 2 项',
    })

    const noStatus = describeWorkspaceSyncButton({
      loggedIn: true,
      syncing: false,
      status: null,
      lastMessage: '已推送 1 项',
    })
    expect(noStatus.tone).toBe('idle')
    expect(noStatus.title).toBe('立即同步 · 已推送 1 项')
  })

  it('reports danger for error, over-quota, and conflict', () => {
    const err = describeWorkspaceSyncButton({
      loggedIn: true,
      syncing: false,
      status: makeStatus({ status: 'error', message: '网络超时' }),
      shortcut: '⌘⇧S',
    })
    expect(err).toEqual({
      tone: 'danger',
      ariaLabel: '同步（同步异常）',
      title: '立即同步（⌘⇧S） · 网络超时',
      badge: '同步异常',
    })

    const quota = describeWorkspaceSyncButton({
      loggedIn: true,
      syncing: false,
      status: makeStatus({ status: 'over-quota', message: '空间不足' }),
    })
    expect(quota.tone).toBe('danger')
    expect(quota.badge).toBe('空间不足')

    const conflict = describeWorkspaceSyncButton({
      loggedIn: true,
      syncing: false,
      status: makeStatus({ status: 'conflict', message: '' }),
    })
    expect(conflict).toEqual({
      tone: 'danger',
      ariaLabel: '同步（有冲突）',
      title: '立即同步 · 有冲突',
      badge: '有冲突',
    })
  })

  it('reports warn for offline and pending retry queue', () => {
    const offline = describeWorkspaceSyncButton({
      loggedIn: true,
      syncing: false,
      status: makeStatus({ status: 'offline', message: '当前离线', online: false }),
      shortcut: '⌘⇧S',
    })
    expect(offline).toEqual({
      tone: 'warn',
      ariaLabel: '同步（离线）',
      title: '立即同步（⌘⇧S） · 当前离线',
      badge: '离线',
    })

    const queued = describeWorkspaceSyncButton({
      loggedIn: true,
      syncing: false,
      status: makeStatus({ status: 'idle', message: '', retryQueueSize: 3 }),
    })
    expect(queued).toEqual({
      tone: 'warn',
      ariaLabel: '同步（待重试 3）',
      title: '立即同步 · 待重试 3',
      badge: '待重试 3',
    })
  })
})

describe('workspaceSyncToastMessage', () => {
  it('guides unbound vaults to settings sync section', () => {
    expect(
      workspaceSyncToastMessage(
        makeStatus({ status: 'error', message: '尚未绑定云端库', lastErrorCode: 'vault.not.found' }),
      ),
    ).toBe('当前库尚未绑定云端，请在设置 → 同步中完成首次绑定')
  })

  it('returns status message or fallback text', () => {
    expect(workspaceSyncToastMessage(makeStatus({ message: '已同步 3 个文件' }))).toBe('已同步 3 个文件')
    expect(workspaceSyncToastMessage(makeStatus({ message: '' }))).toBe('同步完成')
  })
})
