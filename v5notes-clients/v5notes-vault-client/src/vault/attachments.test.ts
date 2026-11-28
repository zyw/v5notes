import { describe, expect, it } from 'vitest'
import {
  attachmentFromInsertUrl,
  attachmentRelFromImageUrl,
  attachmentUrlText,
  guessMimeTypeFromExtension,
  isAttachmentExtensionForKind,
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
    expect(attachmentUrlText('attachments/照片 one.png')).toBe('attachments/%E7%85%A7%E7%89%87%20one.png')
  })

  it('writes into the ASCII attachments directory', () => {
    expect(sanitizeAttachmentName('截图.png')).toBe('截图.png')
    const rel = `attachments/${sanitizeAttachmentName('截图.png')}`
    expect(rel.startsWith('attachments/')).toBe(true)
  })
})

describe('attachmentRelFromImageUrl', () => {
  it('accepts current and legacy attachment folders, encoded or raw', () => {
    expect(attachmentRelFromImageUrl('attachments/photo.png')).toBe('attachments/photo.png')
    expect(attachmentRelFromImageUrl('attachments/%E7%85%A7%E7%89%87.png')).toBe('attachments/照片.png')
    expect(attachmentRelFromImageUrl('%E9%99%84%E4%BB%B6/photo.png')).toBe('附件/photo.png')
  })

  it('rejects external, absolute, data, and non-attachment relatives', () => {
    expect(attachmentRelFromImageUrl('https://example.com/a.png')).toBeNull()
    expect(attachmentRelFromImageUrl('data:image/png;base64,AAA')).toBeNull()
    expect(attachmentRelFromImageUrl('//cdn.example.com/a.png')).toBeNull()
    expect(attachmentRelFromImageUrl('/abs/a.png')).toBeNull()
    expect(attachmentRelFromImageUrl('../outside.png')).toBeNull()
    expect(attachmentRelFromImageUrl('other/photo.png')).toBeNull()
    expect(attachmentRelFromImageUrl('')).toBeNull()
    expect(attachmentRelFromImageUrl(null)).toBeNull()
  })
})

describe('isVaultRelativeImageUrl', () => {
  it('accepts vault-relative raw and encoded paths', () => {
    expect(isVaultRelativeImageUrl('attachments/photo.png')).toBe(true)
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

describe('attachmentFromInsertUrl', () => {
  it('turns a percent-encoded insert URL back into an attachment record', () => {
    const record = attachmentFromInsertUrl('attachments/%E7%85%A7%E7%89%87.png', 1234)
    expect(record.rel).toBe('attachments/照片.png')
    expect(record.name).toBe('照片.png')
    expect(record.sizeBytes).toBe(1234)
    expect(record.modifiedAt).toBeTypeOf('number')
  })

  it('round-trips through attachmentUrlText', () => {
    const rel = 'attachments/my pic-1.png'
    expect(attachmentFromInsertUrl(attachmentUrlText(rel), 0).rel).toBe(rel)
  })
})

describe('isAttachmentExtensionForKind', () => {
  it('separates image, video, and audio extensions cleanly', () => {
    expect(isAttachmentExtensionForKind('clip.MP4', 'video')).toBe(true)
    expect(isAttachmentExtensionForKind('clip.mov', 'video')).toBe(true)
    expect(isAttachmentExtensionForKind('clip.mp3', 'video')).toBe(false)

    expect(isAttachmentExtensionForKind('song.MP3', 'audio')).toBe(true)
    expect(isAttachmentExtensionForKind('song.flac', 'audio')).toBe(true)
    expect(isAttachmentExtensionForKind('song.mp4', 'audio')).toBe(false)

    expect(isAttachmentExtensionForKind('pic.webp', 'image')).toBe(true)
    expect(isAttachmentExtensionForKind('pic.mp4', 'image')).toBe(false)
  })
})

describe('sanitizeAttachmentName for video and audio', () => {
  it('preserves valid video/audio extensions and falls back via mime hint or default', () => {
    expect(sanitizeAttachmentName('演示录屏.mp4', 'video/mp4', 'video')).toBe('演示录屏.mp4')
    expect(sanitizeAttachmentName('clip', 'video/quicktime', 'video')).toBe('clip.mov')
    expect(sanitizeAttachmentName('clip', undefined, 'video')).toBe('clip.mp4')

    expect(sanitizeAttachmentName('播客.m4a', 'audio/mp4', 'audio')).toBe('播客.m4a')
    expect(sanitizeAttachmentName('track', 'audio/wav', 'audio')).toBe('track.wav')
    expect(sanitizeAttachmentName('track', undefined, 'audio')).toBe('track.mp3')
  })
})

describe('guessMimeTypeFromExtension', () => {
  it('maps image, video, and audio extensions', () => {
    expect(guessMimeTypeFromExtension('.png')).toBe('image/png')
    expect(guessMimeTypeFromExtension('.MP4')).toBe('video/mp4')
    expect(guessMimeTypeFromExtension('.mov')).toBe('video/quicktime')
    expect(guessMimeTypeFromExtension('.mp3')).toBe('audio/mpeg')
    expect(guessMimeTypeFromExtension('.m4a')).toBe('audio/mp4')
    expect(guessMimeTypeFromExtension('.flac')).toBe('audio/flac')
    expect(guessMimeTypeFromExtension('.unknown')).toBe('application/octet-stream')
  })
})
