/**
 * Vault path identity (design §6.2).
 *
 * Display path: vault-relative, `/` separators, NFC, original case preserved.
 * Identity key: display path after per-segment locale-independent case mapping
 * (ECMAScript String#toLowerCase on NFC text — practical stand-in for full UCD
 * case-fold until an ICU dependency is justified).
 */

export class VaultPathError extends Error {
  readonly code = 'vault.path.invalid' as const

  constructor(message: string) {
    super(message)
    this.name = 'VaultPathError'
  }
}

/** Windows reserved device basenames (case-insensitive); also blocks `CON.txt`. */
const WINDOWS_RESERVED = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
])

const ILLEGAL_CHARS = /[\u0000-\u001f<>:"|?*\\]/

export interface NormalizedVaultPath {
  /** User-facing relative path (NFC, `/` separators, original case). */
  displayPath: string
  /** Sync / uniqueness key (NFC + case-fold per segment). */
  identityKey: string
  segments: string[]
}

function nfc(value: string): string {
  return value.normalize('NFC')
}

function stripTrailingDotsAndSpaces(segment: string): string {
  return segment.replace(/[ .]+$/u, '')
}

function reservedBasename(segment: string): string {
  const beforeDot = segment.split('.')[0] ?? segment
  return beforeDot.toUpperCase()
}

/**
 * Validate and normalize one path segment for display (keeps user case).
 * Rejects empty, `.` / `..`, illegal chars, trailing space/dot, Windows reserved names.
 */
export function normalizeDisplaySegment(raw: string): string {
  const segment = nfc(raw)
  if (!segment) {
    throw new VaultPathError('路径段不能为空')
  }
  if (segment === '.' || segment === '..') {
    throw new VaultPathError('路径段不能为 . 或 ..')
  }
  if (ILLEGAL_CHARS.test(segment)) {
    throw new VaultPathError(`路径段含非法字符: ${segment}`)
  }
  if (/[ .]$/u.test(segment) || stripTrailingDotsAndSpaces(segment) !== segment) {
    throw new VaultPathError(`路径段不能以空格或句点结尾: ${segment}`)
  }
  if (WINDOWS_RESERVED.has(reservedBasename(segment))) {
    throw new VaultPathError(`保留设备名不可用: ${segment}`)
  }
  return segment
}

/** Case-fold one NFC segment for identity comparison. */
export function toIdentitySegment(displaySegment: string): string {
  return nfc(displaySegment).toLowerCase()
}

/**
 * Normalize a vault-relative path to display form + identity key.
 * Accepts `\`, collapses duplicate `/`, rejects absolute / empty / out-of-vault paths.
 */
export function normalizeVaultPath(input: string): NormalizedVaultPath {
  if (input == null || typeof input !== 'string') {
    throw new VaultPathError('路径必须是字符串')
  }
  // Do not trim before segment checks — trailing spaces/dots on names must be rejected (§6.2).
  if (!input || /^\s*$/u.test(input)) {
    throw new VaultPathError('路径不能为空')
  }
  if (/^[a-zA-Z]:/.test(input) || input.startsWith('/') || input.startsWith('\\')) {
    throw new VaultPathError('路径必须是库内相对路径')
  }

  const unified = input.replace(/\\/g, '/')
  // Keep empty segments from '//' so they fail validation; drop only a single leading/trailing slash.
  const parts = unified.replace(/^\/+|\/+$/g, '').split('/')
  if (parts.length === 0 || parts.every(part => part.length === 0)) {
    throw new VaultPathError('路径不能为空')
  }

  const segments = parts.map(normalizeDisplaySegment)
  const displayPath = segments.join('/')
  const identityKey = segments.map(toIdentitySegment).join('/')
  return { displayPath, identityKey, segments }
}

/** Display path only (throws on invalid). */
export function normalizeDisplayPath(input: string): string {
  return normalizeVaultPath(input).displayPath
}

/** Identity key only (throws on invalid). */
export function toIdentityKey(input: string): string {
  return normalizeVaultPath(input).identityKey
}

/** True when two relative paths collide under §6.2 identity rules. */
export function identityKeysEqual(a: string, b: string): boolean {
  return toIdentityKey(a) === toIdentityKey(b)
}

/** Validate a single vault name (folder name for create). Max 100 chars (AGENTS). */
export function normalizeVaultName(raw: string): string {
  const name = nfc(raw.trim())
  if (!name) {
    throw new VaultPathError('库名称不能为空')
  }
  if (name.length > 100) {
    throw new VaultPathError('库名称不能超过 100 个字符')
  }
  return normalizeDisplaySegment(name)
}
