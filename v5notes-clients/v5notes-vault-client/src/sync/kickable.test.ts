import { describe, expect, it } from 'vitest'
import { REPLICA_IDLE_WINDOW_MS, kickBlockedLabel, kickBlockedReason } from './kickable'

const NOW = Date.parse('2026-11-22T20:30:00+08:00')
const ago = (ms: number) => new Date(NOW - ms).toISOString()

const base = {
  replicaId: 'other',
  localReplicaId: 'local',
  bound: true,
  inLocalVault: true,
  now: NOW,
}

describe('whether 踢除 can free a slot', () => {
  it('blocks a device of a library this vault is not bound to', () => {
    expect(kickBlockedReason({
      ...base,
      inLocalVault: false,
      lastSeenAt: ago(REPLICA_IDLE_WINDOW_MS * 5),
    })).toBe('other-vault')
  })

  it('blocks this copy: it would be re-bound by the next sync', () => {
    expect(kickBlockedReason({
      ...base,
      replicaId: 'local',
      lastSeenAt: ago(REPLICA_IDLE_WINDOW_MS * 5),
    })).toBe('local')
  })

  it('blocks a device that bound within the idle window', () => {
    expect(kickBlockedReason({ ...base, lastSeenAt: ago(60_000) })).toBe('idle')
  })

  it('allows a device that has been idle past the window', () => {
    expect(kickBlockedReason({ ...base, lastSeenAt: ago(REPLICA_IDLE_WINDOW_MS + 1) })).toBeNull()
  })

  it('blocks every row while this library is unbound', () => {
    expect(kickBlockedReason({
      ...base,
      bound: false,
      lastSeenAt: ago(REPLICA_IDLE_WINDOW_MS * 5),
    })).toBe('unbound')
  })

  it('treats a missing or unparseable timestamp as recent', () => {
    expect(kickBlockedReason({ ...base, lastSeenAt: null })).toBe('idle')
    expect(kickBlockedReason({ ...base, lastSeenAt: 'not a date' })).toBe('idle')
  })

  it('labels each blocked state', () => {
    // 'local' stays unlabelled: the row's 本机 tag already says it.
    expect(kickBlockedLabel('local')).toBe('')
    expect(kickBlockedLabel('idle')).toBe('在线')
    expect(kickBlockedLabel('unbound')).toBe('未绑定')
    expect(kickBlockedLabel('other-vault')).toBe('其他库')
    expect(kickBlockedLabel(null)).toBe('')
  })
})
