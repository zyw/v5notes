/**
 * Vault image attachments (design §9.5): inserted/pasted images are written
 * under the vault's `附件/` directory and referenced by a relative Markdown
 * link so sync treats them as ordinary assets.
 */

import { convertFileSrc, isTauri } from '@tauri-apps/api/core'
import { normalizeVaultPath } from '../path/identity'
import { bytesToBase64, extensionOf, isAttachmentTooLarge } from '../sync/attachments'
import { VaultQuotaRules } from '../sync/limits'
import { vaultFs } from './vaultFs'

export const ATTACHMENT_DIR_REL = '附件'

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

/** Unique `附件/<name>` path; appends `-1`, `-2`, … before the extension on collision. */
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

/**
 * True when an image URL refers to something inside the vault rather than an
 * absolute/data URL. Accepts both raw and percent-encoded vault paths.
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
