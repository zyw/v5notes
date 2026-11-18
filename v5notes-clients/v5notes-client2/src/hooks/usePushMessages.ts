import { computed, onBeforeUnmount, ref } from 'vue'
import {
  isInboxPush,
  markReadIds,
  mergeMessageBox,
  parsePushPayload,
  resolveMessageCategory,
  resolveMessageTitle,
  toMessageRecord,
  upsertMessage,
  type MessageBoxPayload,
  type MessageRecord,
} from '../models/messages'
import { openFetchSse } from '../utils/sse'

const KICKED = 'kicked'
const MESSAGE_PATH = '/resource/message'

export function usePushMessages(options: {
  getConnection: () => { server: string; clientId: string; token: string }
  getUserId: () => string
  loadBox: () => Promise<MessageBoxPayload>
  closeRemote?: () => Promise<void>
}) {
  const messages = ref<MessageRecord[]>([])
  const panelOpen = ref(false)
  const unreadCount = computed(() => messages.value.filter(item => !item.read).length)

  let closeSse: (() => void) | undefined
  let kicked = false
  let resumeTimer: ReturnType<typeof setTimeout> | undefined
  let started = false

  function disconnectLocal(): void {
    closeSse?.()
    closeSse = undefined
  }

  async function stop(): Promise<void> {
    started = false
    kicked = false
    if (resumeTimer) {
      clearTimeout(resumeTimer)
      resumeTimer = undefined
    }
    disconnectLocal()
    messages.value = []
    panelOpen.value = false
    try {
      await options.closeRemote?.()
    } catch {
      // 登出时远端关闭失败可忽略
    }
  }

  function connect(): void {
    disconnectLocal()
    const { server, clientId, token } = options.getConnection()
    if (!server || !token) return
    const base = server.replace(/\/+$/, '')
    const { close } = openFetchSse({
      url: `${base}${MESSAGE_PATH}`,
      headers: {
        Authorization: `Bearer ${token}`,
        clientid: clientId,
      },
      onMessage: raw => {
        if (!raw) return
        if (raw === KICKED) {
          kicked = true
          disconnectLocal()
          return
        }
        const payload = parsePushPayload(raw)
        if (!isInboxPush(payload.type)) return
        const userId = options.getUserId()
        const category = resolveMessageCategory(payload.type, payload.source)
        const content = payload.data ? String(payload.data.noticeContent ?? '') : ''
        const record = toMessageRecord({
          messageId: payload.messageId ?? `${payload.type}:${payload.timestamp}:${payload.message}`,
          type: payload.type,
          source: payload.source,
          title: resolveMessageTitle(category),
          message: payload.message ?? '',
          content: content || undefined,
          timestamp: payload.timestamp,
          category,
        }, userId, category)
        if (!record) return
        messages.value = upsertMessage(messages.value, record)
      },
      retries: 5,
      retryDelayMs: 5000,
    })
    closeSse = close
  }

  async function start(): Promise<void> {
    started = true
    kicked = false
    const userId = options.getUserId()
    try {
      const box = await options.loadBox()
      messages.value = mergeMessageBox(box, userId)
    } catch {
      messages.value = []
    }
    connect()
  }

  function markRead(messageId: string): void {
    const userId = options.getUserId()
    markReadIds(userId, [messageId])
    messages.value = messages.value.map(item => (
      item.messageId === messageId ? { ...item, read: true } : item
    ))
  }

  function markAllRead(): void {
    const userId = options.getUserId()
    const ids = messages.value.map(item => item.messageId)
    markReadIds(userId, ids)
    messages.value = messages.value.map(item => ({ ...item, read: true }))
  }

  function resumeIfNeeded(): void {
    if (!started || !kicked || !options.getConnection().token) return
    if (document.visibilityState !== 'visible') return
    if (resumeTimer) clearTimeout(resumeTimer)
    resumeTimer = setTimeout(() => {
      resumeTimer = undefined
      if (!started || !kicked || !options.getConnection().token) return
      void start()
    }, 300)
  }

  window.addEventListener('focus', resumeIfNeeded)
  document.addEventListener('visibilitychange', resumeIfNeeded)
  window.addEventListener('online', resumeIfNeeded)

  onBeforeUnmount(() => {
    window.removeEventListener('focus', resumeIfNeeded)
    document.removeEventListener('visibilitychange', resumeIfNeeded)
    window.removeEventListener('online', resumeIfNeeded)
    void stop()
  })

  return {
    messages,
    panelOpen,
    unreadCount,
    start,
    stop,
    markRead,
    markAllRead,
  }
}
