import { describe, expect, it } from 'vitest'
import {
  computeBackoffMs,
  createRetryQueue,
  isRetryableError,
} from './retryQueue'

describe('retry queue', () => {
  it('classifies retryable vs permanent errors', () => {
    expect(isRetryableError('vault.rate.limited', 429)).toBe(true)
    expect(isRetryableError(null, 500)).toBe(true)
    expect(isRetryableError(null, 0)).toBe(true)
    expect(isRetryableError('vault.file.too.large', 413)).toBe(false)
    expect(isRetryableError('vault.quota.exceeded', 402)).toBe(false)
    expect(isRetryableError('vault.conflict.rev', 409)).toBe(false)
    // A declared hash that does not match the bytes can never succeed on retry.
    expect(isRetryableError('vault.hash.mismatch', 400)).toBe(false)
  })

  it('backs off exponentially and caps', () => {
    expect(computeBackoffMs(0, 1000, 60_000)).toBe(1000)
    expect(computeBackoffMs(1, 1000, 60_000)).toBe(2000)
    expect(computeBackoffMs(3, 1000, 60_000)).toBe(8000)
    expect(computeBackoffMs(20, 1000, 60_000)).toBe(60_000)
  })

  it('dedupes same path and marks dead after permanent error', () => {
    let t = 1_000
    const q = createRetryQueue({
      now: () => t,
      baseDelayMs: 1000,
      maxAttempts: 3,
      idFactory: () => 'fixed-id',
    })
    const a = q.enqueue({ kind: 'push', path: 'a.md', error: 'network', httpStatus: 0 })
    expect(a.id).toBe('fixed-id')
    expect(q.pendingCount()).toBe(1)

    t = 3_000
    expect(q.ready().map(i => i.path)).toEqual(['a.md'])

    const b = q.enqueue({
      kind: 'push',
      path: 'a.md',
      error: 'too large',
      errorCode: 'vault.file.too.large',
      httpStatus: 413,
    })
    expect(b.dead).toBe(true)
    expect(q.pendingCount()).toBe(0)
    expect(q.deadItems()).toHaveLength(1)
  })

  it('removes on success and snapshots round-trip', () => {
    const q = createRetryQueue({ idFactory: () => 'x1' })
    q.enqueue({ kind: 'cycle', error: 'offline', httpStatus: 0 })
    expect(q.size()).toBe(1)
    q.markSuccess('x1')
    expect(q.size()).toBe(0)

    q.enqueue({ kind: 'push', path: 'b.png', error: '5xx', httpStatus: 502 })
    const snap = q.snapshot()
    const q2 = createRetryQueue()
    q2.load(snap)
    expect(q2.list()[0]?.path).toBe('b.png')
  })
})
