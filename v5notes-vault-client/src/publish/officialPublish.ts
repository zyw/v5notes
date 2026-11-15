/**
 * Official Publish / share — first-party product channel only.
 * Third-party plugins must never receive `publish:*` (enforced in plugin-host).
 */

export const OFFICIAL_PUBLISH_CHANNEL = 'product' as const

export const OFFICIAL_PUBLISH_TITLE = '官方发布 / 分享'

export const OFFICIAL_PUBLISH_LEAD =
  '站点发布与分享是 V5Notes 官方产品能力，不向社区第三方插件开放。插件无法申请 publish:*。'

export const OFFICIAL_PUBLISH_STUB_STATUS = 'preview' as const

export const OFFICIAL_PUBLISH_STUB_HELP =
  '当前为官方通道预览：可填写站点标题与可见性偏好并保存在本机；完整站点托管与公开 URL 将随后续官方增值上线，不会变成社区插件 API。'

export type OfficialPublishVisibility = 'private' | 'unlisted' | 'public'

export interface OfficialPublishDraft {
  /** Product channel marker — always first-party. */
  channel: typeof OFFICIAL_PUBLISH_CHANNEL
  siteTitle: string
  visibility: OfficialPublishVisibility
  /** Stub: never means a live public site until backend ships. */
  status: typeof OFFICIAL_PUBLISH_STUB_STATUS
  updatedAt: string
}

export const OFFICIAL_PUBLISH_STORAGE_KEY = 'v5notes-vault-official-publish-draft'

export function defaultOfficialPublishDraft(now = new Date()): OfficialPublishDraft {
  return {
    channel: OFFICIAL_PUBLISH_CHANNEL,
    siteTitle: '',
    visibility: 'private',
    status: OFFICIAL_PUBLISH_STUB_STATUS,
    updatedAt: now.toISOString(),
  }
}

export function loadOfficialPublishDraft(
  store: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null,
): OfficialPublishDraft {
  if (!store) return defaultOfficialPublishDraft()
  try {
    const raw = store.getItem(OFFICIAL_PUBLISH_STORAGE_KEY)
    if (!raw) return defaultOfficialPublishDraft()
    const parsed = JSON.parse(raw) as Partial<OfficialPublishDraft>
    return {
      channel: OFFICIAL_PUBLISH_CHANNEL,
      siteTitle: typeof parsed.siteTitle === 'string' ? parsed.siteTitle.slice(0, 100) : '',
      visibility:
        parsed.visibility === 'public' || parsed.visibility === 'unlisted' || parsed.visibility === 'private'
          ? parsed.visibility
          : 'private',
      status: OFFICIAL_PUBLISH_STUB_STATUS,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    }
  } catch {
    return defaultOfficialPublishDraft()
  }
}

export function saveOfficialPublishDraft(
  draft: OfficialPublishDraft,
  store: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null,
): OfficialPublishDraft {
  const next: OfficialPublishDraft = {
    channel: OFFICIAL_PUBLISH_CHANNEL,
    siteTitle: draft.siteTitle.trim().slice(0, 100),
    visibility: draft.visibility,
    status: OFFICIAL_PUBLISH_STUB_STATUS,
    updatedAt: new Date().toISOString(),
  }
  store?.setItem(OFFICIAL_PUBLISH_STORAGE_KEY, JSON.stringify(next))
  return next
}

/** Runtime guard for any future host surface — third parties never get publish. */
export function assertOfficialPublishChannel(channel: string): void {
  if (channel !== OFFICIAL_PUBLISH_CHANNEL) {
    throw new Error('发布仅限官方产品通道；第三方插件不可调用 publish')
  }
}
