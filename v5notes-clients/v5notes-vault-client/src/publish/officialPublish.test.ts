import { describe, expect, it } from 'vitest'
import {
  assertOfficialPublishChannel,
  defaultOfficialPublishDraft,
  loadOfficialPublishDraft,
  OFFICIAL_PUBLISH_CHANNEL,
  OFFICIAL_PUBLISH_LEAD,
  OFFICIAL_PUBLISH_DRAFTS_KEY,
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
      '/vault/a',
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
    expect(store.getItem(OFFICIAL_PUBLISH_DRAFTS_KEY)).toBeTruthy()

    const loaded = loadOfficialPublishDraft('/vault/a', store)
    expect(loaded.siteTitle).toBe('我的公开笔记站')
    expect(loaded.visibility).toBe('unlisted')
    expect(loaded.status).toBe('preview')
  })
})
describe('official publish drafts are per vault', () => {
  it('keeps a separate title and visibility for each vault', () => {
    const store = new MemoryStorage() as unknown as Storage
    saveOfficialPublishDraft('/vault/a', { ...defaultOfficialPublishDraft(), siteTitle: '读书站', visibility: 'public' }, store)
    saveOfficialPublishDraft('/vault/b', { ...defaultOfficialPublishDraft(), siteTitle: '工作站' }, store)

    expect(loadOfficialPublishDraft('/vault/a', store)).toMatchObject({ siteTitle: '读书站', visibility: 'public' })
    expect(loadOfficialPublishDraft('/vault/b', store)).toMatchObject({ siteTitle: '工作站', visibility: 'private' })
    expect(JSON.parse(store.getItem(OFFICIAL_PUBLISH_DRAFTS_KEY) ?? '{}')).toHaveProperty(['/vault/a'])
  })

  it('starts a vault with its own empty draft instead of another vault\'s title', () => {
    const store = new MemoryStorage() as unknown as Storage
    saveOfficialPublishDraft('/vault/a', { ...defaultOfficialPublishDraft(), siteTitle: '读书站' }, store)
    expect(loadOfficialPublishDraft('/vault/new', store)).toMatchObject({ siteTitle: '', visibility: 'private' })
  })

  it('copies the legacy single draft once, without moving it', () => {
    const store = new MemoryStorage() as unknown as Storage
    store.setItem(
      OFFICIAL_PUBLISH_STORAGE_KEY,
      JSON.stringify({ ...defaultOfficialPublishDraft(), siteTitle: '旧草稿', visibility: 'unlisted' }),
    )
    expect(loadOfficialPublishDraft('/vault/a', store)).toMatchObject({ siteTitle: '旧草稿', visibility: 'unlisted' })
    // Saving one vault must not alter the legacy copy another vault still reads.
    saveOfficialPublishDraft('/vault/a', { ...defaultOfficialPublishDraft(), siteTitle: '改过' }, store)
    expect(loadOfficialPublishDraft('/vault/b', store)).toMatchObject({ siteTitle: '旧草稿' })
    expect(store.getItem(OFFICIAL_PUBLISH_STORAGE_KEY)).toContain('旧草稿')
  })

  it('has no draft without a vault', () => {
    const store = new MemoryStorage() as unknown as Storage
    store.setItem(OFFICIAL_PUBLISH_STORAGE_KEY, JSON.stringify({ ...defaultOfficialPublishDraft(), siteTitle: '旧草稿' }))
    expect(loadOfficialPublishDraft(null, store)).toMatchObject({ siteTitle: '' })
  })
})
