import { describe, expect, it } from 'vitest'
import { DOC_KINDS } from '../vault/docKinds'
import {
  attachmentBadgeLabel,
  bytesToBase64,
  classifyFileKind,
  isAttachmentTooLarge,
  prefersTextBody,
} from './attachments'

describe('attachments', () => {
  it('classifies note/asset/config', () => {
    expect(classifyFileKind('笔记.md')).toBe('note')
    expect(classifyFileKind('草稿.txt')).toBe('note')
    expect(classifyFileKind('DRAFT.TXT')).toBe('note')
    expect(classifyFileKind('附件/图.png')).toBe('asset')
    expect(classifyFileKind('.v5notes/appearance.json')).toBe('config')
  })

  it('classifies plugin kinds as notes when given the live table', () => {
    const csv = { id: 'csv', label: 'CSV', newLabel: '新建 CSV', extension: '.csv', initialContent: '' }
    const kinds = [...DOC_KINDS, csv]
    // Without the table the plugin kind would be treated as a binary asset.
    expect(classifyFileKind('预算.csv')).toBe('asset')
    expect(classifyFileKind('预算.csv', kinds)).toBe('note')
    expect(prefersTextBody('预算.csv', kinds)).toBe(true)
    expect(classifyFileKind('a.md', kinds)).toBe('note')
  })

  it('prefers text for md/json and binary for png', () => {
    expect(prefersTextBody('a.md')).toBe(true)
    expect(prefersTextBody('草稿.txt')).toBe(true)
    expect(prefersTextBody('x.json')).toBe(true)
    expect(prefersTextBody('图.png')).toBe(false)
  })

  it('enforces single-file limit', () => {
    expect(isAttachmentTooLarge(1024, 2048)).toBe(false)
    expect(isAttachmentTooLarge(3000, 2048)).toBe(true)
    expect(attachmentBadgeLabel('附件/大.zip', 25 * 1024 * 1024)).toContain('大.zip')
  })

  it('encodes bytes for data URLs', () => {
    // Only the encoder survives: sync uploads send raw bytes, local previews need a data URL.
    expect(bytesToBase64(new Uint8Array([0, 1, 2, 255, 10]))).toBe('AAEC/wo=')
  })
})
