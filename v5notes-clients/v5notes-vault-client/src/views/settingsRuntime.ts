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

/** A registry record plus when its notes were last changed on disk. */
export interface SettingsVaultRowInput {
  rootPath: string
  name: string
  /** Epoch ms of the newest note change; null when it could not be read. */
  updatedAt?: number | null
  /** Registry record time, used only when the disk time is unknown. */
  registeredAt?: string
}

function recencyOf(entry: SettingsVaultRowInput): number {
  if (typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt)) return entry.updatedAt
  const at = entry.registeredAt ? Date.parse(entry.registeredAt) : Number.NaN
  return Number.isFinite(at) ? at : 0
}

/**
 * Vault rows for the settings sidebar.
 *
 * Sorted by when the vault's notes last changed, newest first — that is what
 * "which library did I work on last" means to a reader. Ties (and vaults whose
 * folder is gone) fall back to the registry's own order, which is stable, so
 * the list never reshuffles on its own. Opening a vault's settings does not
 * touch this order: the open vault is marked, never moved.
 */
export function buildSettingsVaultRows(
  registry: SettingsVaultRowInput[],
  active: { rootPath: string; name: string } | null,
  missing: ReadonlySet<string> = new Set(),
): SettingsVaultRow[] {
  const ordered = registry
    .map((entry, index) => ({ entry, index, at: recencyOf(entry) }))
    .sort((a, b) => b.at - a.at || a.index - b.index)

  const rows: SettingsVaultRow[] = []
  const seen = new Set<string>()
  const push = (input: SettingsVaultRowInput | { rootPath: string; name: string }, isActive: boolean) => {
    const { rootPath, name } = input
    if (!rootPath || seen.has(rootPath)) return
    seen.add(rootPath)
    rows.push({ rootPath, name, active: isActive, missing: !isActive && missing.has(rootPath) })
  }
  for (const { entry } of ordered) push(entry, entry.rootPath === active?.rootPath)
  if (active?.rootPath) push(active, true)
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
