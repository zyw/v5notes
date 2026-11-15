/** 客户端消息中心：对齐后端 PushPayload / 消息盒子字段。 */

export const MESSAGE_CATEGORY = {
  SYSTEM: 'system',
  NOTICE: 'notice',
} as const

export type MessageCategory = (typeof MESSAGE_CATEGORY)[keyof typeof MESSAGE_CATEGORY]

export interface MessageRecord {
  messageId: string
  category: MessageCategory
  type: string
  source: string
  title: string
  message: string
  content?: string
  timestamp: number
  read: boolean
}

export interface MessageBoxPayload {
  systemList?: Array<Record<string, unknown>>
  noticeList?: Array<Record<string, unknown>>
}

const READ_KEY_PREFIX = 'v5notes-message-read:'
const MAX_READ_IDS = 300

function asText(value: unknown): string {
  if (value === undefined || value === null) return ''
  return String(value)
}

function asTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value) {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return Date.now()
}

export function resolveMessageCategory(type?: string, source?: string, category?: string): MessageCategory {
  if (category === MESSAGE_CATEGORY.NOTICE || type === 'notice' || source === 'notice') {
    return MESSAGE_CATEGORY.NOTICE
  }
  return MESSAGE_CATEGORY.SYSTEM
}

export function resolveMessageTitle(category: MessageCategory, title?: string): string {
  if (title?.trim()) return title.trim()
  return category === MESSAGE_CATEGORY.NOTICE ? '通知公告' : '系统通知'
}

/** 仅保留管理端通知/公告相关类型，忽略 llm/custom 等即时流。 */
export function isInboxPush(type?: string): boolean {
  return type === 'message' || type === 'notice' || !type
}

export function readIdsKey(userId: string): string {
  return `${READ_KEY_PREFIX}${userId}`
}

export function getReadIds(userId: string, storage?: Storage): string[] {
  if (!userId) return []
  try {
    const store = storage ?? localStorage
    const raw = store.getItem(readIdsKey(userId))
    const parsed = raw ? JSON.parse(raw) as unknown : []
    if (!Array.isArray(parsed)) return []
    return Array.from(new Set(parsed.map(item => String(item)).filter(Boolean))).slice(0, MAX_READ_IDS)
  } catch {
    return []
  }
}

export function markReadIds(userId: string, messageIds: string[], storage?: Storage): string[] {
  if (!userId || !messageIds.length) return getReadIds(userId, storage)
  const store = storage ?? localStorage
  const next = Array.from(new Set([...messageIds.map(String), ...getReadIds(userId, storage)])).slice(0, MAX_READ_IDS)
  store.setItem(readIdsKey(userId), JSON.stringify(next))
  return next
}

export function parsePushPayload(raw: string): { type?: string; source?: string; messageId?: string; message?: string; data?: Record<string, unknown> | null; timestamp?: number } {
  try {
    const payload = JSON.parse(raw) as Record<string, unknown>
    return {
      type: asText(payload.type) || 'message',
      source: asText(payload.source) || 'backend',
      messageId: payload.messageId === undefined || payload.messageId === null ? undefined : asText(payload.messageId),
      message: asText(payload.message),
      data: payload.data && typeof payload.data === 'object' ? payload.data as Record<string, unknown> : null,
      timestamp: asTimestamp(payload.timestamp),
    }
  } catch {
    return { type: 'message', source: 'backend', message: raw, timestamp: Date.now() }
  }
}

export function toMessageRecord(
  item: Record<string, unknown>,
  userId: string,
  fallbackCategory?: MessageCategory,
): MessageRecord | null {
  const messageId = item.messageId === undefined || item.messageId === null ? '' : asText(item.messageId)
  if (!messageId) return null
  const type = asText(item.type) || 'message'
  const source = asText(item.source) || 'backend'
  if (!isInboxPush(type)) return null
  const category = resolveMessageCategory(type, source, fallbackCategory || asText(item.category))
  const data = item.data && typeof item.data === 'object' ? item.data as Record<string, unknown> : null
  const content = asText(item.content) || asText(data?.noticeContent)
  return {
    messageId,
    category,
    type,
    source,
    title: resolveMessageTitle(category, asText(item.title)),
    message: asText(item.message),
    content: content || undefined,
    timestamp: asTimestamp(item.createTime ?? item.timestamp),
    read: getReadIds(userId).includes(messageId),
  }
}

export function mergeMessageBox(box: MessageBoxPayload, userId: string): MessageRecord[] {
  const system = (box.systemList ?? [])
    .map(item => toMessageRecord(item, userId, MESSAGE_CATEGORY.SYSTEM))
    .filter((item): item is MessageRecord => !!item)
  const notice = (box.noticeList ?? [])
    .map(item => toMessageRecord(item, userId, MESSAGE_CATEGORY.NOTICE))
    .filter((item): item is MessageRecord => !!item)
  return [...system, ...notice].sort((a, b) => b.timestamp - a.timestamp)
}

export function upsertMessage(list: MessageRecord[], next: MessageRecord): MessageRecord[] {
  const index = list.findIndex(item => item.messageId === next.messageId)
  if (index < 0) return [next, ...list]
  const copy = list.slice()
  copy[index] = { ...copy[index], ...next }
  return copy.sort((a, b) => b.timestamp - a.timestamp)
}
