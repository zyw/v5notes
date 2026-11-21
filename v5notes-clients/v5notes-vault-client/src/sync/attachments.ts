/**
 * Attachment / binary sync helpers (Phase 5 / design §9.5).
 * OSS direct upload remains deferred; this slice uses PUT + base64Body.
 */

import { DOC_KINDS, docKindOfPathIn, type DocKindSpec } from '../vault/docKinds'
import { VaultQuotaRules } from './limits'

export type SyncFileKind = 'note' | 'asset' | 'config'

const TEXT_EXT = new Set([
  '.md',
  '.txt',
  '.json',
  '.csv',
  '.tsv',
  '.svg',
  '.xml',
  '.html',
  '.htm',
  '.css',
  '.js',
  '.ts',
  '.mjs',
  '.cjs',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.gitignore',
  '.syncignore',
])

export function extensionOf(path: string): string {
  const base = path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return ''
  return base.slice(dot).toLowerCase()
}

/** `kinds` defaults to core kinds; pass the host's table to include plugin kinds. */
export function classifyFileKind(
  relativePath: string,
  kinds: readonly DocKindSpec[] = DOC_KINDS,
): SyncFileKind {
  const lower = relativePath.replace(/\\/g, '/').toLowerCase()
  if (lower.startsWith('.v5notes/')) return 'config'
  if (docKindOfPathIn(kinds, lower)) return 'note'
  return 'asset'
}

/** Prefer text PUT for notes/configs and common text assets; binary otherwise. */
export function prefersTextBody(
  relativePath: string,
  kinds: readonly DocKindSpec[] = DOC_KINDS,
): boolean {
  const kind = classifyFileKind(relativePath, kinds)
  if (kind === 'note' || kind === 'config') return true
  const ext = extensionOf(relativePath)
  return TEXT_EXT.has(ext)
}

export function isAttachmentTooLarge(
  sizeBytes: number,
  maxFileBytes: number = VaultQuotaRules.DEFAULT_MAX_FILE_BYTES,
): boolean {
  return sizeBytes > maxFileBytes
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'))
  }
  const binary = atob(base64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
  return out
}

export function attachmentBadgeLabel(path: string, maxFileBytes: number): string {
  const name = path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path
  const mb = Math.round(maxFileBytes / (1024 * 1024))
  return `${name} 超过单文件上限（${mb}MB），已跳过同步`
}
