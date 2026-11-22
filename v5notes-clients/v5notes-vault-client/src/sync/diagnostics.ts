/**
 * Read-only description of how one note would be hashed for upload.
 *
 * A rejected upload (`vault.hash.mismatch`) means the hash this client declared
 * disagrees with the bytes it sent. The report reconstructs that step outside
 * the sync cycle — raw bytes, decoded text, both hashes — so the disagreement
 * can be attributed instead of guessed at. Nothing here writes to the vault.
 */

import { sha256Hex } from './hash'
import type { VaultFs } from '../vault/vaultFs'
import { vaultFs as defaultVaultFs } from '../vault/vaultFs'

/** 64-bit FNV-1a, the shape the old non-cryptographic fallback produced. */
function fallbackHex(bytes: Uint8Array): string {
  let h = 0
  for (const b of bytes) h = (Math.imul(31, h) + b) >>> 0
  return h.toString(16).padStart(64, '0').slice(0, 64)
}

export interface FileHashReport {
  path: string
  byteSize: number
  utf8Valid: boolean
  /** U+FFFD count — non-zero means the bytes are not the text the client sent. */
  replacementChars: number
  hasCryptoSubtle: boolean
  /** Hash of the raw bytes at path. */
  rawHash: string
  /** Hash of the decoded text sent as UTF-8 (what `putFile.body` carries). */
  textHash: string
  /** True when the two agree, i.e. the text round-trips through the file. */
  textRoundTrips: boolean
  looksLikeFallback: boolean
}

export async function describeFileHash(
  rootPath: string,
  relativePath: string,
  fs: VaultFs = defaultVaultFs,
): Promise<FileHashReport> {
  const bytes = await fs.readBytes(rootPath, relativePath)
  let utf8Valid = true
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    utf8Valid = false
    text = new TextDecoder('utf-8').decode(bytes)
  }
  const textBytes = new TextEncoder().encode(text)
  const rawHash = await sha256Hex(bytes)
  const textHash = await sha256Hex(textBytes)
  const fallback = `sha256:${fallbackHex(bytes)}`
  return {
    path: relativePath,
    byteSize: bytes.byteLength,
    utf8Valid,
    replacementChars: (text.match(/\uFFFD/g) ?? []).length,
    hasCryptoSubtle: Boolean(globalThis.crypto?.subtle),
    rawHash,
    textHash,
    textRoundTrips: rawHash === textHash,
    looksLikeFallback: rawHash === fallback || textHash === fallback,
  }
}

/** Plain-text block for the clipboard. */
export function formatHashReport(report: FileHashReport, appVersion = ''): string {
  return [
    `文件 ${report.path}`,
    `字节 ${report.byteSize} · UTF-8 ${report.utf8Valid ? '有效' : '无效'}${report.replacementChars ? `（替换符 ${report.replacementChars}）` : ''}`,
    `WebCrypto ${report.hasCryptoSubtle ? '可用' : '不可用（走了非加密降级）'}`,
    `原始字节 ${report.rawHash}`,
    `解码文本 ${report.textHash}`,
    `文本回写一致 ${report.textRoundTrips ? '是' : '否'}`,
    appVersion ? `版本 ${appVersion}` : '',
  ].filter(Boolean).join('\n')
}
