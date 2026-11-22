/**
 * Device labels this app has sent from this machine, per server + cloud library.
 *
 * Bound devices are listed by the server and do not say which one is running
 * here — the row only carries the label that client sent at bind time. A
 * machine that has already bound remembers those labels locally, so it can
 * recognise its own row after the device id changes (a new vault directory, a
 * reinstalled app) instead of offering itself 踢除.
 *
 * Keyed by server and cloud library: two libraries on one machine must not
 * claim each other's rows.
 */

import { buildDeviceLabel, buildVaultDeviceLabel } from './deviceLabel'

export const DEVICE_NAME_KEY = 'v5notes.vault.device-names.v1'

/** Kept small: one entry per server × library this machine has bound. */
const MAX_ENTRIES = 32

export interface LocalDeviceName {
  server: string
  vaultId: string
  labels: string[]
  seenAt: string
  /** Most recent bind label, so a new vault directory can reuse it. */
  lastLabel: string
}

function normalizeServer(server: string): string {
  return server.trim().replace(/\/+$/, '').toLowerCase()
}

function read(store: Pick<Storage, 'getItem'> | null): LocalDeviceName[] {
  if (!store) return []
  try {
    const raw = store.getItem(DEVICE_NAME_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    // Hand-edited or migrated storage must not throw inside a render.
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is LocalDeviceName =>
      !!item
      && typeof item === 'object'
      && typeof (item as LocalDeviceName).server === 'string'
      && typeof (item as LocalDeviceName).vaultId === 'string'
      && Array.isArray((item as LocalDeviceName).labels))
  } catch {
    return []
  }
}

function write(store: Pick<Storage, 'setItem'> | null, entries: LocalDeviceName[]): void {
  if (!store) return
  try {
    store.setItem(DEVICE_NAME_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
  } catch {
    /* quota / private mode: the hint is optional */
  }
}

function browserStorage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage
}

/** Labels this machine has sent for the library, newest first. */
export function localDeviceNames(server: string, vaultId: string | null, userAgent?: string | null): string[] {
  const names = new Set<string>()
  const current = buildDeviceLabel(userAgent)
  names.add(current)
  if (!vaultId) return [...names]
  const key = normalizeServer(server)
  const entry = read(browserStorage()).find(item => item.server === key && item.vaultId === vaultId)
  for (const label of entry?.labels ?? []) names.add(label)
  return [...names]
}

export function rememberLocalDeviceName(
  server: string,
  vaultId: string,
  label: string,
  now = new Date().toISOString(),
): void {
  const store = browserStorage()
  const key = normalizeServer(server)
  const entries = read(store)
  const existing = entries.find(item => item.server === key && item.vaultId === vaultId)
  const labels = [label, ...(existing?.labels ?? [])].filter((item, index, all) => all.indexOf(item) === index)
  const next: LocalDeviceName = {
    server: key,
    vaultId,
    labels: labels.slice(0, 4),
    seenAt: now,
    lastLabel: label,
  }
  write(store, [next, ...entries.filter(item => !(item.server === key && item.vaultId === vaultId))])
}

/** Label to send before this vault has bound, e.g. `测试4 · macOS`. */
export function bindLabelForVault(vaultName: string, userAgent?: string | null): string {
  return buildVaultDeviceLabel(vaultName, userAgent)
}
