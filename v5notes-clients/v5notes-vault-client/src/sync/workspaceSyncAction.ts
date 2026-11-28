import type { SyncEngineStatus } from './types'

export type WorkspaceSyncTone = 'spinning' | 'danger' | 'warn' | 'idle' | 'unauthenticated'

export interface WorkspaceSyncButtonInput {
  loggedIn: boolean
  syncing: boolean
  status: SyncEngineStatus | null
  lastMessage?: string
  shortcut?: string
}

export interface WorkspaceSyncButtonState {
  tone: WorkspaceSyncTone
  ariaLabel: string
  title: string
  badge?: string
}

/**
 * Derive visual tone, accessible label, tooltip, and command badge for the
 * workspace toolbar sync action from the global sync coordinator state.
 */
export function describeWorkspaceSyncButton(
  input: WorkspaceSyncButtonInput,
): WorkspaceSyncButtonState {
  const { loggedIn, syncing, status, lastMessage, shortcut } = input
  const hintSuffix = shortcut ? `（${shortcut}）` : ''
  const detail = (status?.message || lastMessage || '').trim()

  if (
    syncing ||
    status?.status === 'syncing' ||
    status?.status === 'binding' ||
    status?.status === 'retrying'
  ) {
    return {
      tone: 'spinning',
      ariaLabel: '正在同步',
      title: detail ? `正在同步：${detail}` : '正在同步…',
      badge: '同步中…',
    }
  }

  if (!loggedIn) {
    return {
      tone: 'unauthenticated',
      ariaLabel: '同步（未登录）',
      title: `未登录，点击前往登录并同步${hintSuffix}`,
      badge: '未登录',
    }
  }

  if (
    status?.status === 'error' ||
    status?.status === 'over-quota' ||
    status?.status === 'conflict'
  ) {
    const label =
      status.status === 'conflict'
        ? '有冲突'
        : status.status === 'over-quota'
          ? '空间不足'
          : '同步异常'
    return {
      tone: 'danger',
      ariaLabel: `同步（${label}）`,
      title: `立即同步${hintSuffix} · ${detail || label}`,
      badge: label,
    }
  }

  if (status?.status === 'offline' || (status?.retryQueueSize ?? 0) > 0) {
    const label =
      status?.status === 'offline' ? '离线' : `待重试 ${status?.retryQueueSize ?? 0}`
    return {
      tone: 'warn',
      ariaLabel: `同步（${label}）`,
      title: `立即同步${hintSuffix} · ${detail || label}`,
      badge: label,
    }
  }

  return {
    tone: 'idle',
    ariaLabel: '立即同步',
    title:
      detail && detail !== '未同步'
        ? `立即同步${hintSuffix} · ${detail}`
        : `立即同步${hintSuffix}`,
  }
}

/** Map a completed manual sync result to a concise workspace toast message. */
export function workspaceSyncToastMessage(status: SyncEngineStatus): string {
  if (status.lastErrorCode === 'vault.not.found') {
    return '当前库尚未绑定云端，请在设置 → 同步中完成首次绑定'
  }
  return status.message || '同步完成'
}
