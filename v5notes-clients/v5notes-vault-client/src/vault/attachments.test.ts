import { describe, expect, it } from 'vitest'
import {
  attachmentUrlText,
  isInlineImageExtension,
  isVaultRelativeImageUrl,
  sanitizeAttachmentName,
} from './attachments'

describe('sanitizeAttachmentName', () => {
  it('keeps ordinary names and extensions', () => {
    expect(sanitizeAttachmentName('截图 2026-11.png')).toBe('截图 2026-11.png')
  })

  it('strips illegal characters and keeps the last path segment', () => {
    // 'a/b' is a nested name; only the leaf ('b') is stored.
    expect(sanitizeAttachmentName('a/b:c*d?.png')).toBe('b-c-d-.png')
    expect(sanitizeAttachmentName('dir/photo.png')).toBe('photo.png')
  })

  it('adds an extension from the mime hint when missing', () => {
    expect(sanitizeAttachmentName('photo', 'image/jpeg')).toBe('photo.jpeg')
  })

  it('falls back for empty or reserved names', () => {
    expect(sanitizeAttachmentName('...png')).toMatch(/png/)
    expect(() => sanitizeAttachmentName('CON.txt')).not.toThrow()
  })
})

describe('attachmentUrlText', () => {
  it('percent-encodes each segment but keeps slashes', () => {
    expect(attachmentUrlText('附件/照片 one.png')).toBe('%E9%99%84%E4%BB%B6/%E7%85%A7%E7%89%87%20one.png')
  })
})

describe('isVaultRelativeImageUrl', () => {
  it('accepts vault-relative raw and encoded paths', () => {
    expect(isVaultRelativeImageUrl('附件/photo.png')).toBe(true)
    expect(isVaultRelativeImageUrl('%E9%99%84%E4%BB%B6/photo.png')).toBe(true)
    expect(isVaultRelativeImageUrl('sub dir/photo.png')).toBe(true)
  })

  it('rejects external, absolute, and traversal targets', () => {
    expect(isVaultRelativeImageUrl('https://example.com/a.png')).toBe(false)
    expect(isVaultRelativeImageUrl('data:image/png;base64,AAA')).toBe(false)
    expect(isVaultRelativeImageUrl('//cdn.example.com/a.png')).toBe(false)
    expect(isVaultRelativeImageUrl('/abs/a.png')).toBe(false)
    expect(isVaultRelativeImageUrl('../outside.png')).toBe(false)
    expect(isVaultRelativeImageUrl('')).toBe(false)
  })
})

describe('isInlineImageExtension', () => {
  it('recognizes common image types only', () => {
    expect(isInlineImageExtension('x.PNG')).toBe(true)
    expect(isInlineImageExtension('x.webp')).toBe(true)
    expect(isInlineImageExtension('x.pdf')).toBe(false)
  })
})
