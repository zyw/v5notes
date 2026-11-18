import { describe, expect, it } from 'vitest'
import {
  attachmentBadgeLabel,
  base64ToBytes,
  bytesToBase64,
  classifyFileKind,
  isAttachmentTooLarge,
  prefersTextBody,
} from './attachments'

describe('attachments', () => {
  it('classifies note/asset/config', () => {
    expect(classifyFileKind('笔记.md')).toBe('note')
    expect(classifyFileKind('附件/图.png')).toBe('asset')
    expect(classifyFileKind('.v5notes/appearance.json')).toBe('config')
  })

  it('prefers text for md/json and binary for png', () => {
    expect(prefersTextBody('a.md')).toBe(true)
    expect(prefersTextBody('x.json')).toBe(true)
    expect(prefersTextBody('图.png')).toBe(false)
  })

  it('enforces single-file limit', () => {
    expect(isAttachmentTooLarge(1024, 2048)).toBe(false)
    expect(isAttachmentTooLarge(3000, 2048)).toBe(true)
    expect(attachmentBadgeLabel('附件/大.zip', 25 * 1024 * 1024)).toContain('大.zip')
  })

  it('round-trips base64', () => {
    const bytes = new Uint8Array([0, 1, 2, 255, 10])
    expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes])
  })
})
