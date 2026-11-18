import { describe, expect, it } from 'vitest'
import {
  FORBIDDEN_PERMISSIONS,
  validateRequestedPermissions,
  assertPermission,
} from './permissions'

describe('permissions', () => {
  it('rejects forbidden third-party permissions', () => {
    for (const perm of ['network', 'fs:arbitrary', 'shell', 'sync:control', 'publish:*']) {
      expect(FORBIDDEN_PERMISSIONS.has(perm) || perm.startsWith('publish')).toBe(true)
      const r = validateRequestedPermissions([perm])
      expect(r.ok).toBe(false)
      expect(r.denied).toContain(perm)
    }
  })

  it('allows network:safe in Phase 7 by default', () => {
    const r = validateRequestedPermissions(['network:safe'])
    expect(r.ok).toBe(true)
  })

  it('can still refuse network:safe when explicitly disabled', () => {
    const r = validateRequestedPermissions(['network:safe'], { allowNetworkSafe: false })
    expect(r.ok).toBe(false)
    expect(r.denied).toContain('network:safe')
  })

  it('allows Phase 7 grantable set', () => {
    const r = validateRequestedPermissions([
      'vault:read',
      'vault:write',
      'ui:commands',
      'ui:ribbon',
      'ui:settings',
      'ui:views',
      'network:safe',
    ])
    expect(r.ok).toBe(true)
  })

  it('assertPermission throws without grant', () => {
    expect(() => assertPermission(['vault:read'], 'vault:write', '写入')).toThrow(/vault:write/)
  })
})
