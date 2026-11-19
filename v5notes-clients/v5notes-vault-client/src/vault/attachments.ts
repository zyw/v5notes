/**
 * Vault image attachments: inserted/pasted images are written under the
 * vault's `attachments/` directory and referenced by a relative Markdown
 * link so sync treats them as ordinary assets. (The design doc §9.5 names
 * this folder 「附件」; the client standardizes on ASCII `attachments` for
 * URL-safe, cross-platform links.)
 */

import { convertFileSrc, isTauri } from '@tauri-apps/api/core'
import { join } from '@tauri-apps/api/path'
import { exists, readDir, rename, stat } from '@tauri-apps/plugin-fs'
import { normalizeVaultPath } from '../path/identity'
import { buildTrashRel } from './trashPaths'
import { bytesToBase64, extensionOf, isAttachmentTooLarge } from '../sync/attachments'
import { VaultQuotaRules } from '../sync/limits'
import { vaultFs } from './vaultFs'

export const ATTACHMENT_DIR_REL = 'attachments'

/** Legacy attachment folders from earlier builds; still previewed, no longer written. */
const LEGACY_ATTACHMENT_DIRS = ['附件'] as const

/** Decoded relative path of an image inside the attachment folder, else null. */
export function attachmentRelFromImageUrl(src: string | null | undefined): string | null {
  const raw = src?.trim()
  if (!raw || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//') || raw.startsWith('/') || raw.startsWith('data:') || raw.startsWith('#')) {
    return null
  }
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    /* keep raw form */
  }
  const dirs = [ATTACHMENT_DIR_REL, ...LEGACY_ATTACHMENT_DIRS]
  return dirs.some(dir => decoded === dir || decoded.startsWith(`${dir}/`)) ? decoded : null
}

/** Extensions the editor renders inline; others still insert but preview as links. */
const INLINE_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.avif', '.ico'])

export class AttachmentError extends Error {}

export function isInlineImageExtension(name: string): boolean {
  return INLINE_IMAGE_EXTS.has(extensionOf(name))
}

/** Filesystem-safe leaf name for an uploaded image, keeping original case. */
export function sanitizeAttachmentName(name: string, mimeHint?: string): string {
  const base = name.includes('/') ? name.slice(name.lastIndexOf('/') + 1) : name
  // NFC like the path layer; strip chars illegal on any supported OS.
  let candidate = base
    .normalize('NFC')
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '-')
    .replace(/[.#\s]+$/g, '')
    .trim()
    .slice(0, 80)

  let ext = extensionOf(candidate)
  if (!ext || !isInlineImageExtension(ext)) {
    // The display-name sanitizer rejects a bare ".png", so drop it before appending.
    if (ext) candidate = candidate.slice(0, candidate.length - ext.length).replace(/[.\s]+$/g, '')
    ext = mimeHint?.startsWith('image/') ? `.${mimeHint.split('/').pop()}` : '.png'
    if (ext === '.svg+xml') ext = '.svg'
  }
  candidate = candidate || 'image'

  try {
    normalizeVaultPath(`${ATTACHMENT_DIR_REL}/${candidate}${ext}`)
    return `${candidate}${ext}`
  } catch {
    return `image-${Date.now()}${ext}`
  }
}

/** Unique `attachments/<name>` path; appends `-1`, `-2`, … before the extension on collision. */
async function uniqueAttachmentPath(rootPath: string, name: string): Promise<string> {
  const ext = extensionOf(name)
  const stem = ext ? name.slice(0, -ext.length) : name
  for (let i = 0; i < 1000; i++) {
    const rel = `${ATTACHMENT_DIR_REL}/${i === 0 ? name : `${stem}-${i}${ext}`}`
    if (!(await vaultFs.exists(rootPath, rel))) return rel
  }
  throw new AttachmentError('附件目录内无法生成可用的文件名')
}

/** Markdown URL text for a vault-relative attachment path. */
export function attachmentUrlText(relativePath: string): string {
  return relativePath
    .split('/')
    .map(segment => encodeURIComponent(segment).replace(/'/g, '%27'))
    .join('/')
}

/** `attachments/<name>` record derived from an import result's Markdown URL text. */
export function attachmentFromInsertUrl(urlText: string, sizeBytes: number): VaultAttachment {
  const rel = attachmentRelFromImageUrl(urlText) ?? decodeURIComponent(urlText)
  const name = rel.includes('/') ? rel.slice(rel.lastIndexOf('/') + 1) : rel
  return { rel, name, sizeBytes, modifiedAt: Date.now() }
}

/**
 * True when an image URL refers to something inside the vault rather than an
 * absolute/data URL. Accepts both raw and percent-encoded vault paths.
 * @deprecated Prefer {@link attachmentRelFromImageUrl} for attachment-scoped checks.
 */
export function isVaultRelativeImageUrl(url: string): boolean {
  const target = url.trim()
  if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//') || target.startsWith('/')) {
    return false
  }
  let decoded = target
  try {
    decoded = decodeURIComponent(target)
  } catch {
    /* keep raw form */
  }
  try {
    normalizeVaultPath(decoded)
    return true
  } catch {
    return false
  }
}

/** One image stored in the attachment folder, for the picker dialog. */
export interface VaultAttachment {
  /** Vault-relative path (`attachments/x.png`). */
  rel: string
  name: string
  sizeBytes: number
  modifiedAt: number | null
}

/** List images in `attachments/` (newest first); missing folder reads as empty. */
export async function listVaultAttachments(rootPath: string): Promise<VaultAttachment[]> {
  const dirAbs = await vaultFs.absolute(rootPath, ATTACHMENT_DIR_REL)
  let entries
  try {
    entries = await readDir(dirAbs)
  } catch {
    return []
  }
  const out: VaultAttachment[] = []
  for (const entry of entries) {
    const name = entry.name
    if (!name || !entry.isFile || !isInlineImageExtension(name)) continue
    const fileAbs = await join(dirAbs, name)
    let sizeBytes = 0
    let modifiedAt: number | null = null
    try {
      const info = await stat(fileAbs)
      sizeBytes = info.size
      modifiedAt = info.mtime ? new Date(info.mtime).getTime() : null
    } catch {
      /* entry vanished mid-scan; show it without metadata */
    }
    out.push({ rel: `${ATTACHMENT_DIR_REL}/${name}`, name, sizeBytes, modifiedAt })
  }
  out.sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0) || a.name.localeCompare(b.name, 'zh'))
  return out
}

/** Move an attachment into the local trash (same `.v5notes/trash` as notes). */
export async function deleteVaultAttachment(rootPath: string, relativePath: string): Promise<void> {
  const { displayPath } = normalizeVaultPath(relativePath)
  if (attachmentRelFromImageUrl(displayPath) === null) {
    throw new AttachmentError('只能删除附件目录内的图片')
  }
  const fromAbs = await vaultFs.absolute(rootPath, displayPath)
  try {
    if (!(await exists(fromAbs))) return // already gone — desired end state
    const trashRel = buildTrashRel(displayPath)
    const parentRel = trashRel.slice(0, trashRel.lastIndexOf('/'))
    await vaultFs.mkdir(rootPath, parentRel)
    let toAbs = await vaultFs.absolute(rootPath, trashRel)
    for (let i = 2; i < 1000 && (await exists(toAbs)); i++) {
      toAbs = `${await vaultFs.absolute(rootPath, trashRel)}-${i}`
    }
    await rename(fromAbs, toAbs)
  } catch (error) {
    // Missing file after a concurrent delete is still success.
    if (!(await vaultFs.exists(rootPath, displayPath))) return
    throw error
  }
}

/** Import an OS-picked image file into `attachments/`; returns its record. */
export async function importImageFileToVault(
  rootPath: string,
  file: File,
): Promise<VaultAttachment> {
  const urlText = await saveImageToVault(rootPath, file)
  return attachmentFromInsertUrl(urlText, file.size)
}

/**
 * Write an image into the vault and return a URL usable in Markdown.
 * Throws when the file exceeds the vault quota or cannot be stored.
 */
export async function saveImageToVault(rootPath: string, file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (isAttachmentTooLarge(bytes.byteLength, VaultQuotaRules.DEFAULT_MAX_FILE_BYTES)) {
    throw new AttachmentError(`图片超过 ${Math.round(VaultQuotaRules.DEFAULT_MAX_FILE_BYTES / (1024 * 1024))}MB 上限，未插入`)
  }
  const name = sanitizeAttachmentName(file.name || 'image', file.type)
  const rel = await uniqueAttachmentPath(rootPath, name)
  await vaultFs.writeBytes(rootPath, rel, bytes)
  return attachmentUrlText(rel)
}

/**
 * Read an existing vault attachment as a displayable URL: asset protocol under
 * Tauri, `fetch()` of the same otherwise. Used to preview relative Markdown
 * image links whose target lives inside the vault.
 */
export async function vaultAssetUrl(rootPath: string, relativePath: string): Promise<string> {
  const absPath = await vaultFs.absolute(rootPath, relativePath)
  if (isTauri()) return convertFileSrc(absPath)
  const bytes = await vaultFs.readBytes(rootPath, relativePath)
  return dataUrlForImage(bytes, guessMimeTypeFromExtension(extensionOf(relativePath)))
}

export function guessMimeTypeFromExtension(ext: string): string {
  switch (ext) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.svg':
      return 'image/svg+xml'
    case '.bmp':
      return 'image/bmp'
    case '.avif':
      return 'image/avif'
    default:
      return 'application/octet-stream'
  }
}

export function dataUrlForImage(bytes: Uint8Array, mime: string): string {
  return `data:${mime};base64,${bytesToBase64(bytes)}`
}
