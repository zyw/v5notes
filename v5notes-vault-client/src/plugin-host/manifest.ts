import type { PluginKind, PluginManifest, PluginPermission } from '@v5notes/vault-plugin-api'
import { normalizePermissionList, validateRequestedPermissions } from './permissions'

const ID_RE = /^[a-z0-9-]+$/

export interface ParsedManifest extends PluginManifest {
  kind: PluginKind
  permissions: PluginPermission[]
  main: string
}

export function parseManifestJson(raw: string | unknown): ParsedManifest {
  const data = typeof raw === 'string' ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown>)
  if (!data || typeof data !== 'object') {
    throw new Error('manifest 无效')
  }
  const id = String(data.id || '').trim()
  if (!ID_RE.test(id)) {
    throw new Error('manifest.id 必须匹配 [a-z0-9-]+')
  }
  const name = String(data.name || id).trim()
  const version = String(data.version || '0.0.0').trim()
  const kind: PluginKind = data.kind === 'theme' ? 'theme' : 'plugin'
  const permissions = normalizePermissionList(data.permissions) as PluginPermission[]

  if (kind === 'theme') {
    const themeCheck = validateRequestedPermissions(permissions.length ? permissions : ['ui:theme'], {
      allowNetworkSafe: false,
    })
    if (!themeCheck.ok) throw new Error(themeCheck.reason)
    const themeFile = String(data.theme || 'theme.css')
    return {
      id,
      name,
      kind,
      version,
      minAppVersion: data.minAppVersion ? String(data.minAppVersion) : undefined,
      description: data.description ? String(data.description) : undefined,
      author: data.author ? String(data.author) : undefined,
      authorUrl: data.authorUrl ? String(data.authorUrl) : undefined,
      isDesktopOnly: Boolean(data.isDesktopOnly),
      permissions: permissions.length ? permissions : (['ui:theme'] as PluginPermission[]),
      main: data.main ? String(data.main) : '',
      theme: themeFile,
      themeMeta: data.themeMeta ? String(data.themeMeta) : undefined,
      networkAllowlist: Array.isArray(data.networkAllowlist)
        ? data.networkAllowlist.map(String)
        : undefined,
    }
  }

  const check = validateRequestedPermissions(permissions, { allowNetworkSafe: false })
  if (!check.ok) throw new Error(check.reason)

  // Theme packages must not sneak vault write / network via kind=plugin mistype — already checked.
  return {
    id,
    name,
    kind,
    version,
    minAppVersion: data.minAppVersion ? String(data.minAppVersion) : undefined,
    description: data.description ? String(data.description) : undefined,
    author: data.author ? String(data.author) : undefined,
    authorUrl: data.authorUrl ? String(data.authorUrl) : undefined,
    isDesktopOnly: Boolean(data.isDesktopOnly),
    permissions,
    main: String(data.main || 'main.js'),
    theme: data.theme ? String(data.theme) : undefined,
    themeMeta: data.themeMeta ? String(data.themeMeta) : undefined,
    networkAllowlist: Array.isArray(data.networkAllowlist)
      ? data.networkAllowlist.map(String)
      : undefined,
  }
}

/** Theme main.js may only hold ui:theme (and ui:settings for style controls). */
export function assertThemePermissions(manifest: ParsedManifest): void {
  if (manifest.kind !== 'theme') return
  const bad = manifest.permissions.filter(
    (p) => p !== 'ui:theme' && p !== 'ui:settings' && p !== 'ui:commands',
  )
  if (bad.length) {
    throw new Error(`主题不得申请越权权限: ${bad.join(', ')}`)
  }
  if (manifest.permissions.some((p) => p.startsWith('vault:') || p.startsWith('network'))) {
    throw new Error('主题不得申请 vault/network 权限')
  }
}

export function satisfiesMinAppVersion(minAppVersion: string | undefined, appVersion: string): boolean {
  if (!minAppVersion) return true
  return compareSemver(appVersion, minAppVersion) >= 0
}

function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0)
  const pb = b.replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d
  }
  return 0
}
