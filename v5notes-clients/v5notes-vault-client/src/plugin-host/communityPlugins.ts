/** community-plugins.json shape (design §3.2). */

export interface CommunityPluginsFile {
  schemaVersion: 1
  enabled: string[]
  versions?: Record<string, string>
  /** Per-plugin: whether onUserEnable already ran in this vault. */
  userEnableSeen?: Record<string, boolean>
}

export function emptyCommunityPlugins(): CommunityPluginsFile {
  return { schemaVersion: 1, enabled: [], versions: {}, userEnableSeen: {} }
}

export function parseCommunityPlugins(raw: string | unknown): CommunityPluginsFile {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!data || typeof data !== 'object') return emptyCommunityPlugins()
    const obj = data as Record<string, unknown>
    // Migrate early skeleton `{ plugins: [] }` if present.
    let enabled: string[] = []
    if (Array.isArray(obj.enabled)) {
      enabled = obj.enabled.map(String)
    } else if (Array.isArray(obj.plugins)) {
      enabled = obj.plugins
        .map((p) => (typeof p === 'string' ? p : (p as { id?: string })?.id))
        .filter((x): x is string => Boolean(x))
    }
    const versions =
      obj.versions && typeof obj.versions === 'object'
        ? Object.fromEntries(
            Object.entries(obj.versions as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
          )
        : {}
    const userEnableSeen =
      obj.userEnableSeen && typeof obj.userEnableSeen === 'object'
        ? Object.fromEntries(
            Object.entries(obj.userEnableSeen as Record<string, unknown>).map(([k, v]) => [
              k,
              Boolean(v),
            ]),
          )
        : {}
    return { schemaVersion: 1, enabled, versions, userEnableSeen }
  } catch {
    return emptyCommunityPlugins()
  }
}
