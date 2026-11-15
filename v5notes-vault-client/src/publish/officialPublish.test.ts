import { describe, expect, it } from 'vitest'
import {
  assertOfficialPublishChannel,
  defaultOfficialPublishDraft,
  loadOfficialPublishDraft,
  OFFICIAL_PUBLISH_CHANNEL,
  OFFICIAL_PUBLISH_LEAD,
  OFFICIAL_PUBLISH_STORAGE_KEY,
  saveOfficialPublishDraft,
} from './officialPublish'

class MemoryStorage {
  private map = new Map<string, string>()
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null
  }
  setItem(key: string, value: string) {
    this.map.set(key, value)
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
}

describe('official publish stub', () => {
  it('is first-party product channel only', () => {
    expect(OFFICIAL_PUBLISH_CHANNEL).toBe('product')
    expect(OFFICIAL_PUBLISH_LEAD).toMatch(/官方/)
    expect(OFFICIAL_PUBLISH_LEAD).toMatch(/第三方/)
    expect(() => assertOfficialPublishChannel('plugin')).toThrow(/官方/)
    expect(() => assertOfficialPublishChannel('product')).not.toThrow()
  })

  it('persists draft without claiming live publish', () => {
    const store = new MemoryStorage() as unknown as Storage
    const saved = saveOfficialPublishDraft(
      {
        ...defaultOfficialPublishDraft(),
        siteTitle: '  我的公开笔记站  ',
        visibility: 'unlisted',
      },
      store,
    )
    expect(saved.channel).toBe('product')
    expect(saved.status).toBe('preview')
    expect(saved.siteTitle).toBe('我的公开笔记站')
    expect(store.getItem(OFFICIAL_PUBLISH_STORAGE_KEY)).toBeTruthy()

    const loaded = loadOfficialPublishDraft(store)
    expect(loaded.siteTitle).toBe('我的公开笔记站')
    expect(loaded.visibility).toBe('unlisted')
    expect(loaded.status).toBe('preview')
  })
})
