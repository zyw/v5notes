/**
 * Whether the "踢除" action on a replica row can do what it says.
 *
 * Kicking deletes a row. The only caller able to create one again is the same
 * app running somewhere (`bind`), and the only vault it acts on is the local
 * one, so in practice:
 *
 * - a replica of a cloud library this vault is not bound to: nothing here can
 *   reach that binding; it is released from the copy that opened that vault;
 * - this copy: 踢除 would only come back on the next sync; the way out is to
 *   unbind this library locally;
 * - a replica that bound within the idle window: ditto;
 * - anything else (a copy that is gone, or one that already unbound itself):
 *   the row can be removed and the slot stays free until someone binds.
 */

/** A replica whose last bind is older than this is idle; kicking it frees the slot. */
export const REPLICA_IDLE_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * The server caps bound replicas per library. Mirrors
 * `VaultQuotaRules.DEFAULT_REPLICA_LIMIT`; used only to word the explanation,
 * never to gate an action.
 */
export const CLOUD_REPLICA_LIMIT = 3

export type KickBlockedReason = 'unbound' | 'other-vault' | 'local' | 'idle' | null

export function kickBlockedReason(input: {
  replicaId: string
  localReplicaId: string | null
  /** False when this local vault is not bound to the cloud library yet. */
  bound: boolean
  /** True when the row belongs to this local vault's cloud library. */
  inLocalVault: boolean
  lastSeenAt?: string | null
  now?: number
  idleWindowMs?: number
}): KickBlockedReason {
  if (!input.bound) return 'unbound'
  if (!input.inLocalVault) return 'other-vault'
  if (input.localReplicaId && input.replicaId === input.localReplicaId) return 'local'
  const now = input.now ?? Date.now()
  const windowMs = input.idleWindowMs ?? REPLICA_IDLE_WINDOW_MS
  const seen = input.lastSeenAt ? Date.parse(input.lastSeenAt) : Number.NaN
  if (Number.isNaN(seen) || seen > now - windowMs) return 'idle'
  return null
}

/**
 * Shown where the disabled button sits; explains the state, not the feature.
 * 'local' has no label because the row already carries the 本机 tag.
 */
export function kickBlockedLabel(reason: KickBlockedReason): string {
  if (reason === 'idle') return '在线'
  if (reason === 'unbound') return '未绑定'
  if (reason === 'other-vault') return '其他库'
  return ''
}
