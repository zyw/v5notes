import type { PluginPermission } from '@v5notes/vault-plugin-api'

/** Third parties may never request / receive these (design §7.1). */
export const FORBIDDEN_PERMISSIONS = new Set([
  'network',
  'publish',
  'publish:*',
  'sync:control',
  'fs:arbitrary',
  'shell',
])

/**
 * Phase 6 grantable permissions. `network:safe` is Phase 7 — refuse until then.
 */
export const PHASE6_GRANTABLE = new Set<PluginPermission>([
  'vault:read',
  'vault:write',
  'ui:commands',
  'ui:ribbon',
  'ui:status',
  'ui:settings',
  'ui:views',
  'ui:theme',
  'editor:extend',
  'clipboard',
])

export interface PermissionCheckResult {
  ok: boolean
  reason?: string
  denied: string[]
}

export function normalizePermissionList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((p) => String(p).trim()).filter(Boolean)
}

/** Reject forbidden + not-yet-available permissions for third-party / vault plugins. */
export function validateRequestedPermissions(
  requested: string[],
  options?: { allowNetworkSafe?: boolean; isCore?: boolean },
): PermissionCheckResult {
  const denied: string[] = []
  for (const perm of requested) {
    if (FORBIDDEN_PERMISSIONS.has(perm) || perm.startsWith('publish:')) {
      denied.push(perm)
      continue
    }
    if (perm === 'network:safe') {
      if (!options?.allowNetworkSafe) denied.push(perm)
      continue
    }
    if (!PHASE6_GRANTABLE.has(perm as PluginPermission) && !options?.isCore) {
      denied.push(perm)
    }
  }
  if (denied.length) {
    return {
      ok: false,
      denied,
      reason: `拒绝权限: ${denied.join(', ')}（第三方不可用或尚未开放）`,
    }
  }
  return { ok: true, denied: [] }
}

export function hasPermission(granted: readonly string[], need: PluginPermission): boolean {
  return granted.includes(need)
}

export function assertPermission(
  granted: readonly string[],
  need: PluginPermission,
  action: string,
): void {
  if (!hasPermission(granted, need)) {
    throw new Error(`缺少权限 ${need}：无法${action}`)
  }
}
