/**
 * Sync include/exclude hard table (design §6.4).
 * Applied before user `.v5notes/syncignore`. Never-sync rows cannot be overridden.
 */

export type SyncFilterDecision =
  | { sync: true; reason: 'user-content' | 'intent-config' }
  | { sync: false; reason: 'never' | 'unlisted-v5notes' | 'syncignore' }

const INTENT_CONFIG_EXACT = new Set(['.v5notes/appearance.json'])

/**
 * Plugin settings that describe this vault's notes sync with the vault.
 * Package code lives in the app, so plugin/theme binaries never reach a vault.
 */
const VAULT_PLUGIN_DATA_RE = /^\.v5notes\/plugins\/[^/]+\/data\.json$/i

const NEVER_EXACT = new Set([
  '.v5notes/sync-state.json',
  '.v5notes/retry-queue.json',
  '.v5notes/index.sqlite',
  '.v5notes/vault.json',
])

const NEVER_PREFIX = [
  '.v5notes/trash/',
  '.v5notes/index.sqlite',
]

function nfcLower(path: string): string {
  return path.replace(/\\/g, '/').normalize('NFC')
}

/**
 * Hard-table decision for a vault-relative display or identity path.
 * Does not apply user syncignore (call {@link applySyncIgnore} after).
 */
export function classifySyncPath(relativePath: string): SyncFilterDecision {
  const path = nfcLower(relativePath).replace(/^\/+/, '')
  const lower = path.toLowerCase()

  if (NEVER_EXACT.has(lower) || NEVER_EXACT.has(path)) {
    return { sync: false, reason: 'never' }
  }
  for (const prefix of NEVER_PREFIX) {
    if (lower === prefix.slice(0, -1) || lower.startsWith(prefix)) {
      return { sync: false, reason: 'never' }
    }
  }
  // vault.json device fields never sync as a whole file in Phase 4
  if (lower === '.v5notes/vault.json') {
    return { sync: false, reason: 'never' }
  }

  if (INTENT_CONFIG_EXACT.has(lower) || VAULT_PLUGIN_DATA_RE.test(lower)) {
    return { sync: true, reason: 'intent-config' }
  }

  if (lower.startsWith('.v5notes/')) {
    return { sync: false, reason: 'unlisted-v5notes' }
  }

  // User content under vault root (including nested dirs); skip pure dotfiles at root except handled above.
  return { sync: true, reason: 'user-content' }
}

export function shouldSyncPath(relativePath: string): boolean {
  return classifySyncPath(relativePath).sync
}

/** Minimal gitignore-style matcher for Phase 4 (directory prefixes, basename globs, exact). */
export function matchSyncIgnore(relativePath: string, patterns: string[]): boolean {
  const path = nfcLower(relativePath).replace(/^\/+/, '')
  const segments = path.split('/')
  const base = segments[segments.length - 1] ?? path

  for (const raw of patterns) {
    const pattern = raw.trim()
    if (!pattern || pattern.startsWith('#')) continue
    if (pattern.endsWith('/')) {
      const dir = pattern.slice(0, -1).toLowerCase()
      if (path.toLowerCase() === dir || path.toLowerCase().startsWith(`${dir}/`)) return true
      continue
    }
    if (pattern.startsWith('*.')) {
      const ext = pattern.slice(1).toLowerCase()
      if (base.toLowerCase().endsWith(ext)) return true
      continue
    }
    if (pattern.includes('*')) {
      const re = new RegExp(
        `^${pattern
          .split('*')
          .map(escapeRegExp)
          .join('.*')}$`,
        'i',
      )
      if (re.test(base) || re.test(path)) return true
      continue
    }
    if (path === pattern || path.toLowerCase() === pattern.toLowerCase() || base === pattern) {
      return true
    }
  }
  return false
}

export function parseSyncIgnore(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'))
}

export function applySyncIgnore(
  relativePath: string,
  patterns: string[],
): SyncFilterDecision {
  const hard = classifySyncPath(relativePath)
  if (!hard.sync) return hard
  if (matchSyncIgnore(relativePath, patterns)) {
    return { sync: false, reason: 'syncignore' }
  }
  return hard
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
