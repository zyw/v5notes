/**
 * Document kinds a plugin once declared, kept after the plugin goes away.
 *
 * A kind's suffix is what makes its files notes. If the table only held live
 * kinds, disabling a plugin would silently reclassify its notes as assets —
 * invisible in the tree, uploaded as binaries. Remembering the suffix keeps
 * them readable; only the editor for them disappears.
 *
 * App-level, like the installed-plugin set itself.
 */

import { extensionPath, getAppStore } from './appStorage'
import { DOC_KINDS, toCustomKind, type DocKindSpec } from '../vault/docKinds'

const FILE = 'doc-kinds.json'
const SCHEMA_VERSION = 1

interface RememberedKind extends DocKindSpec {
  /** Plugin that introduced this kind; used to drop it when that plugin changes. */
  pluginId: string
}

interface DocKindsFile {
  schemaVersion: number
  kinds: RememberedKind[]
}

export type RememberedKindMap = Record<string, RememberedKind>

async function filePath(): Promise<string> {
  return extensionPath([FILE])
}

function parseKind(raw: unknown): RememberedKind | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  if (typeof value.pluginId !== 'string' || !value.pluginId) return null
  const declaration = {
    id: typeof value.id === 'string' ? value.id : '',
    label: typeof value.label === 'string' ? value.label : '',
    newLabel: typeof value.newLabel === 'string' ? value.newLabel : '',
    extension: typeof value.extension === 'string' ? value.extension : '',
    initialContent: typeof value.initialContent === 'string' ? value.initialContent : '',
  }
  const result = toCustomKind(declaration)
  // Stored entries are re-validated: an older file cannot widen what counts as a note.
  if ('error' in result) return null
  return { ...result.kind, pluginId: value.pluginId }
}

export async function readRememberedKinds(): Promise<RememberedKindMap> {
  let raw: string | null = null
  try {
    raw = await getAppStore().readText(await filePath())
  } catch {
    return {}
  }
  if (!raw) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  const values = (parsed as DocKindsFile | null)?.kinds
  if (!Array.isArray(values)) return {}
  const out: RememberedKindMap = {}
  for (const value of values) {
    const kind = parseKind(value)
    if (kind) out[kind.id] = kind
  }
  return out
}

/** Merge live plugin kinds into the remembered set; core kinds are never stored. */
export async function rememberKinds(kinds: readonly (DocKindSpec & { pluginId?: string })[]): Promise<void> {
  const current = await readRememberedKinds()
  let changed = false
  for (const kind of kinds) {
    if (!kind.pluginId) continue
    if (DOC_KINDS.some((core) => core.id === kind.id)) continue
    const existing = current[kind.id]
    if (existing && existing.pluginId === kind.pluginId && existing.extension === kind.extension) continue
    current[kind.id] = { ...kind, pluginId: kind.pluginId }
    changed = true
  }
  if (!changed) return
  await writeRememberedKinds(current)
}

/**
 * Drop every remembered kind owned by one plugin. Used when a plugin is
 * uninstalled: without its code there is nothing left that could describe the
 * format, so the files go back to being plain assets.
 */
export async function forgetKindsForPlugin(pluginId: string): Promise<void> {
  const current = await readRememberedKinds()
  const next: RememberedKindMap = {}
  let changed = false
  for (const [id, kind] of Object.entries(current)) {
    if (kind.pluginId === pluginId) {
      changed = true
      continue
    }
    next[id] = kind
  }
  if (changed) await writeRememberedKinds(next)
}

async function writeRememberedKinds(kinds: RememberedKindMap): Promise<void> {
  const file: DocKindsFile = { schemaVersion: SCHEMA_VERSION, kinds: Object.values(kinds) }
  const path = await filePath()
  await getAppStore().mkdir(path.slice(0, path.lastIndexOf('/')))
  await getAppStore().writeText(path, JSON.stringify(file, null, 2) + '\n')
}
