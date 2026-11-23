/**
 * Attachment and file-kind helpers for the sync engine (design §9.5).
 *
 * <p>Attachment bytes no longer travel inside the file PUT: they are uploaded once through
 * {@code POST /vault/v1/vaults/{id}/assets} and referenced from the commit (design D5). This
 * module only classifies paths and decides which transport a file uses.</p>
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

/** Base64 encoder used for local {@code data:} previews; sync uploads send raw bytes. */
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

export function attachmentBadgeLabel(path: string, maxFileBytes: number): string {
  const name = path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path
  const mb = Math.round(maxFileBytes / (1024 * 1024))
  return `${name} 超过单文件上限（${mb}MB），已跳过同步`
}
