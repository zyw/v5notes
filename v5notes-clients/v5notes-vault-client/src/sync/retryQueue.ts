/**
 * Background retry queue for failed sync ops (Phase 5 / design §14 断网队列).
 * Persisted locally under `.v5notes/retry-queue.json` (never synced — §6.4 unlisted).
 */

export type RetryOpKind = 'push' | 'delete' | 'rename' | 'cycle'

export interface RetryQueueItem {
  id: string
  kind: RetryOpKind
  /** Display path for push/delete; from path for rename. */
  path?: string
  /** Rename target. */
  toPath?: string
  attempts: number
  nextAttemptAt: number
  lastError?: string
  lastErrorCode?: string | null
  createdAt: number
  /** Permanent failures (413, path invalid) stay for UI badge but are not retried. */
  dead?: boolean
}

export interface RetryQueueSnapshot {
  schemaVersion: 1
  items: RetryQueueItem[]
}

export const RETRY_QUEUE_SCHEMA_VERSION = 1 as const
export const RETRY_QUEUE_REL = '.v5notes/retry-queue.json'

export interface RetryQueueOptions {
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  now?: () => number
  idFactory?: () => string
}

const DEFAULT_MAX_ATTEMPTS = 8
const DEFAULT_BASE_DELAY_MS = 2_000
const DEFAULT_MAX_DELAY_MS = 5 * 60_000

export function isRetryableError(code: string | null | undefined, httpStatus?: number): boolean {
  if (code === 'vault.file.too.large' || code === 'vault.path.invalid' || code === 'vault.conflict.rev') {
    return false
  }
  if (code === 'vault.quota.exceeded') {
    // Capacity/device quota: do not burn retries; user must free space / kick device.
    return false
  }
  if (httpStatus != null) {
    if (httpStatus === 413 || httpStatus === 400 || httpStatus === 409 || httpStatus === 402 || httpStatus === 403) {
      return false
    }
    if (httpStatus >= 500 || httpStatus === 429 || httpStatus === 0) return true
  }
  // Network / unknown → retry
  return true
}

export function computeBackoffMs(
  attempts: number,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
  maxDelayMs = DEFAULT_MAX_DELAY_MS,
): number {
  const exp = Math.min(attempts, 10)
  const raw = baseDelayMs * 2 ** exp
  return Math.min(maxDelayMs, raw)
}

export function createRetryQueue(options: RetryQueueOptions = {}) {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS
  const now = options.now ?? (() => Date.now())
  const idFactory = options.idFactory ?? (() =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `rq-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)

  let items: RetryQueueItem[] = []

  function snapshot(): RetryQueueSnapshot {
    return { schemaVersion: RETRY_QUEUE_SCHEMA_VERSION, items: items.map(i => ({ ...i })) }
  }

  function load(data: RetryQueueSnapshot | null | undefined): void {
    if (!data || !Array.isArray(data.items)) {
      items = []
      return
    }
    items = data.items.map(item => ({ ...item }))
  }

  function findIndex(kind: RetryOpKind, path?: string, toPath?: string): number {
    return items.findIndex(item =>
      !item.dead
      && item.kind === kind
      && item.path === path
      && item.toPath === toPath)
  }

  function enqueue(input: {
    kind: RetryOpKind
    path?: string
    toPath?: string
    error?: string
    errorCode?: string | null
    httpStatus?: number
  }): RetryQueueItem {
    const retryable = isRetryableError(input.errorCode, input.httpStatus)
    const existingIdx = findIndex(input.kind, input.path, input.toPath)
    const createdAt = now()
    if (existingIdx >= 0) {
      const prev = items[existingIdx]!
      const attempts = prev.attempts + 1
      const next: RetryQueueItem = {
        ...prev,
        attempts,
        nextAttemptAt: createdAt + computeBackoffMs(attempts, baseDelayMs, maxDelayMs),
        lastError: input.error ?? prev.lastError,
        lastErrorCode: input.errorCode ?? prev.lastErrorCode,
        dead: !retryable || attempts >= maxAttempts,
      }
      items[existingIdx] = next
      return { ...next }
    }
    const item: RetryQueueItem = {
      id: idFactory(),
      kind: input.kind,
      path: input.path,
      toPath: input.toPath,
      attempts: 0,
      nextAttemptAt: createdAt + (retryable ? baseDelayMs : 0),
      lastError: input.error,
      lastErrorCode: input.errorCode ?? null,
      createdAt,
      dead: !retryable,
    }
    items.push(item)
    return { ...item }
  }

  function ready(at = now()): RetryQueueItem[] {
    return items.filter(item => !item.dead && item.nextAttemptAt <= at).map(i => ({ ...i }))
  }

  function markSuccess(id: string): void {
    items = items.filter(item => item.id !== id)
  }

  function markFailure(id: string, error?: string, errorCode?: string | null, httpStatus?: number): RetryQueueItem | null {
    const idx = items.findIndex(item => item.id === id)
    if (idx < 0) return null
    const prev = items[idx]!
    const retryable = isRetryableError(errorCode, httpStatus)
    const attempts = prev.attempts + 1
    const next: RetryQueueItem = {
      ...prev,
      attempts,
      nextAttemptAt: now() + computeBackoffMs(attempts, baseDelayMs, maxDelayMs),
      lastError: error ?? prev.lastError,
      lastErrorCode: errorCode ?? prev.lastErrorCode,
      dead: !retryable || attempts >= maxAttempts,
    }
    items[idx] = next
    return { ...next }
  }

  function remove(id: string): void {
    items = items.filter(item => item.id !== id)
  }

  function clear(): void {
    items = []
  }

  function size(): number {
    return items.length
  }

  function pendingCount(): number {
    return items.filter(item => !item.dead).length
  }

  function deadItems(): RetryQueueItem[] {
    return items.filter(item => item.dead).map(i => ({ ...i }))
  }

  function list(): RetryQueueItem[] {
    return items.map(i => ({ ...i }))
  }

  return {
    enqueue,
    ready,
    markSuccess,
    markFailure,
    remove,
    clear,
    size,
    pendingCount,
    deadItems,
    list,
    snapshot,
    load,
  }
}

export type RetryQueue = ReturnType<typeof createRetryQueue>
