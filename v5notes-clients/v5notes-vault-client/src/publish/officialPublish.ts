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

/** Legacy single draft, shared by every vault. Read once so old users keep their title. */
export const OFFICIAL_PUBLISH_STORAGE_KEY = 'v5notes-vault-official-publish-draft'

/**
 * Drafts are per vault: a site title and visibility describe one vault's site,
 * so switching vaults in settings must not carry them across.
 */
export const OFFICIAL_PUBLISH_DRAFTS_KEY = 'v5notes-vault-official-publish-drafts.v1'

export function defaultOfficialPublishDraft(now = new Date()): OfficialPublishDraft {
  return {
    channel: OFFICIAL_PUBLISH_CHANNEL,
    siteTitle: '',
    visibility: 'private',
    status: OFFICIAL_PUBLISH_STUB_STATUS,
    updatedAt: now.toISOString(),
  }
}

function readAllDrafts(store: Storage | null): Record<string, OfficialPublishDraft> {
  if (!store) return {}
  try {
    const raw = store.getItem(OFFICIAL_PUBLISH_DRAFTS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, OfficialPublishDraft>) : {}
  } catch {
    return {}
  }
}

function writeAllDrafts(store: Storage | null, drafts: Record<string, OfficialPublishDraft>): void {
  try {
    store?.setItem(OFFICIAL_PUBLISH_DRAFTS_KEY, JSON.stringify(drafts))
  } catch {
    /* quota or private mode: the in-memory draft still works for this session */
  }
}

/** Without a vault there is no site to publish, so the draft is the empty default. */
export function loadOfficialPublishDraft(
  vaultRootPath: string | null | undefined,
  store: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null,
): OfficialPublishDraft {
  if (!store || !vaultRootPath) return defaultOfficialPublishDraft()
  const stored = readAllDrafts(store)[vaultRootPath]
  if (stored) return normalizeDraft(stored)
  // First run after the upgrade: the single legacy draft is copied into this
  // vault, not moved, so no vault reads a title it never had and nothing is lost.
  try {
    const legacy = store.getItem(OFFICIAL_PUBLISH_STORAGE_KEY)
    if (legacy) return normalizeDraft(JSON.parse(legacy) as Partial<OfficialPublishDraft>)
  } catch {
    /* unreadable legacy draft: start empty */
  }
  return defaultOfficialPublishDraft()
}

function normalizeDraft(parsed: Partial<OfficialPublishDraft>): OfficialPublishDraft {
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
}

export function saveOfficialPublishDraft(
  vaultRootPath: string | null | undefined,
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
  if (!store || !vaultRootPath) return next
  const drafts = readAllDrafts(store)
  drafts[vaultRootPath] = next
  writeAllDrafts(store, drafts)
  return next
}

/** Runtime guard for any future host surface — third parties never get publish. */
export function assertOfficialPublishChannel(channel: string): void {
  if (channel !== OFFICIAL_PUBLISH_CHANNEL) {
    throw new Error('发布仅限官方产品通道；第三方插件不可调用 publish')
  }
}