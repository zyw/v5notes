import { describe, expect, it } from 'vitest'
import {
  getReadIds,
  isInboxPush,
  markReadIds,
  mergeMessageBox,
  parsePushPayload,
  resolveMessageCategory,
} from './messages'

describe('messages', () => {
  it('keeps only inbox push types', () => {
    expect(isInboxPush('notice')).toBe(true)
    expect(isInboxPush('message')).toBe(true)
    expect(isInboxPush('llm')).toBe(false)
  })

  it('maps notice source into notice category', () => {
    expect(resolveMessageCategory('message', 'notice')).toBe('notice')
    expect(resolveMessageCategory('message', 'backend')).toBe('system')
  })

  it('merges message box lists with notice first by time', () => {
    const storage = {
      data: {} as Record<string, string>,
      getItem(key: string) { return this.data[key] ?? null },
      setItem(key: string, value: string) { this.data[key] = value },
      removeItem(key: string) { delete this.data[key] },
      clear() { this.data = {} },
      key() { return null },
      get length() { return Object.keys(this.data).length },
    } as Storage
    markReadIds('u1', ['11'], storage)
    expect(getReadIds('u1', storage)).toEqual(['11'])
    const list = mergeMessageBox({
      systemList: [{ messageId: '11', type: 'message', source: 'backend', message: 'sys', createTime: '2026-01-01T00:00:00Z' }],
      noticeList: [{ messageId: '22', type: 'notice', source: 'notice', message: 'ann', createTime: '2026-01-02T00:00:00Z' }],
    }, '')
    expect(list).toHaveLength(2)
    expect(list[0].messageId).toBe('22')
    expect(list[0].category).toBe('notice')
    expect(list[1].category).toBe('system')
  })

  it('parses push json and plain text', () => {
    expect(parsePushPayload('{"type":"notice","message":"hello","messageId":"9"}')).toMatchObject({
      type: 'notice',
      message: 'hello',
      messageId: '9',
    })
    expect(parsePushPayload('plain')).toMatchObject({ type: 'message', message: 'plain' })
  })
})
