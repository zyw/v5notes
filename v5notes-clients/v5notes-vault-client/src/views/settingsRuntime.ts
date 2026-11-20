/**
 * The plugin host is app-level, so the settings page starts it whether or not a
 * vault is open. Opening another vault keeps the same host: extension state is
 * shared, and only the notes a plugin can touch change.
 */
export type RuntimeBootDecision = 'reuse' | 'start'

export function decideRuntimeBoot(options: {
  hostPresent: boolean
  hostRoot?: string | null
  rootPath?: string | null
}): RuntimeBootDecision {
  if (!options.hostPresent) return 'start'
  return 'reuse'
}
/** Which settings scope the page is showing. */
export type SettingsScope = 'global' | 'vault'

/** One selectable vault in the settings sidebar. */
export interface SettingsVaultRow {
  rootPath: string
  name: string
  /** This vault is the one open in the workspace. */
  active: boolean
  /** Registry entries can outlive their folder; those are shown but not selectable. */
  missing?: boolean
}

/**
 * Vault rows for the settings sidebar, in registry order (most recently opened
 * first), with the open vault pinned to the top. Settings are edited for the
 * open vault only, so a missing folder has nothing to read or write.
 */
export function buildSettingsVaultRows(
  registry: { rootPath: string; name: string }[],
  active: { rootPath: string; name: string } | null,
  missing: ReadonlySet<string> = new Set(),
): SettingsVaultRow[] {
  const rows: SettingsVaultRow[] = []
  const seen = new Set<string>()
  const push = (rootPath: string, name: string, isActive: boolean) => {
    if (!rootPath || seen.has(rootPath)) return
    seen.add(rootPath)
    rows.push({ rootPath, name, active: isActive, missing: !isActive && missing.has(rootPath) })
  }
  if (active?.rootPath) push(active.rootPath, active.name, true)
  for (const entry of registry) push(entry.rootPath, entry.name, false)
  return rows
}

/**
 * Scope to show when the settings page opens. A vault section never appears
 * without an open vault: that is the only vault whose files the page can read
 * and write, so guessing one would edit the wrong vault.
 */
export function resolveInitialScope(hasVault: boolean): SettingsScope {
  return hasVault ? 'vault' : 'global'
}
