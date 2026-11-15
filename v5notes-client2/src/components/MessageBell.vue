<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkspaceContext } from '../hooks/workspaceContext'
import { MESSAGE_CATEGORY } from '../models/messages'

const { t } = useI18n()
const {
  messages,
  messagePanelOpen,
  messageUnreadCount,
  markMessageRead,
  markAllMessagesRead,
} = useWorkspaceContext()

const menuRoot = ref<HTMLDetailsElement | null>(null)
const panelStyle = ref<Record<string, string>>({})
let trackingPanel = false
let sidebarObserver: ResizeObserver | null = null

const badge = computed(() => {
  const count = messageUnreadCount.value
  if (count <= 0) return ''
  return count > 99 ? '99+' : String(count)
})

function categoryLabel(category: string): string {
  return category === MESSAGE_CATEGORY.NOTICE ? t('messages.notice') : t('messages.system')
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

function onItemClick(messageId: string): void {
  markMessageRead(messageId)
}

function panelEl(): HTMLElement | null {
  const panel = menuRoot.value?.querySelector('.message-panel')
  return panel instanceof HTMLElement ? panel : null
}

function placePanel(retry = true): void {
  const anchor = menuRoot.value?.querySelector('summary')
  const panel = panelEl()
  if (!(anchor instanceof HTMLElement) || !panel || !messagePanelOpen.value) return
  const anchorRect = anchor.getBoundingClientRect()
  const width = panel.offsetWidth
  const height = panel.offsetHeight
  if (!width || !height) {
    if (retry) requestAnimationFrame(() => placePanel(false))
    return
  }
  const gap = 8
  const margin = 8
  let top = anchorRect.top - gap - height
  top = Math.max(margin, Math.min(top, window.innerHeight - margin - height))
  let left = anchorRect.right - width
  left = Math.max(margin, Math.min(left, window.innerWidth - margin - width))
  panelStyle.value = { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` }
}

function onPanelViewportChange(): void {
  placePanel()
}

function trackPanel(track: boolean): void {
  if (track === trackingPanel) return
  trackingPanel = track
  if (track) {
    window.addEventListener('resize', onPanelViewportChange)
    document.addEventListener('scroll', onPanelViewportChange, true)
    const sidebar = menuRoot.value?.closest('.sidebar')
    if (sidebar) {
      sidebarObserver = new ResizeObserver(onPanelViewportChange)
      sidebarObserver.observe(sidebar)
    }
    return
  }
  window.removeEventListener('resize', onPanelViewportChange)
  document.removeEventListener('scroll', onPanelViewportChange, true)
  sidebarObserver?.disconnect()
  sidebarObserver = null
}

function showPanel(panel: HTMLElement): void {
  if (panel.matches(':popover-open')) return
  try {
    panel.showPopover()
  } catch {
    panel.removeAttribute('popover')
  }
}

function hidePanel(panel: HTMLElement): void {
  if (!panel.matches(':popover-open')) return
  try { panel.hidePopover() } catch { /* 节点卸载时浏览器会拒绝关闭 */ }
}

async function syncPanel(open: boolean): Promise<void> {
  await nextTick()
  if (messagePanelOpen.value !== open) return
  const panel = panelEl()
  if (!panel) return
  if (!open) {
    trackPanel(false)
    hidePanel(panel)
    panelStyle.value = {}
    return
  }
  showPanel(panel)
  placePanel()
  trackPanel(true)
}

function closePanel(event: Event): void {
  const menu = (event.currentTarget as HTMLElement).closest('details.message-menu')
  if (!(menu instanceof HTMLDetailsElement)) return
  menu.open = false
  if (event instanceof KeyboardEvent) menu.querySelector('summary')?.focus()
}

function onToggle(event: Event): void {
  if (event.target !== menuRoot.value || !(event.target instanceof HTMLDetailsElement)) return
  messagePanelOpen.value = event.target.open
}

watch(messagePanelOpen, (open) => { void syncPanel(open) })
onBeforeUnmount(() => {
  trackPanel(false)
  const panel = panelEl()
  if (panel) hidePanel(panel)
})
</script>

<template>
  <details ref="menuRoot" class="message-menu" :open="messagePanelOpen" @toggle="onToggle" @keydown.esc.prevent="closePanel">
    <summary
      class="message-trigger"
      :aria-label="t('messages.title')"
      :title="t('messages.title')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
      </svg>
      <span v-if="badge" class="message-badge" aria-hidden="true">{{ badge }}</span>
    </summary>
    <div class="message-panel" popover="manual" role="group" :aria-label="t('messages.title')" :style="panelStyle" @toggle.stop>
      <div class="message-panel-head">
        <strong>{{ t('messages.title') }}</strong>
        <button type="button" :disabled="!messages.length" @click="markAllMessagesRead">{{ t('messages.readAll') }}</button>
      </div>
      <div class="message-panel-list">
        <button
          v-for="item in messages"
          :key="item.messageId"
          type="button"
          class="message-item"
          :class="{ unread: !item.read }"
          @click="onItemClick(item.messageId)"
        >
          <div class="message-item-top">
            <span class="message-item-tag">{{ categoryLabel(item.category) }}</span>
            <span class="message-item-state">{{ item.read ? t('messages.read') : t('messages.unread') }}</span>
          </div>
          <div class="message-item-title">{{ item.title }}</div>
          <div class="message-item-body">{{ item.message }}</div>
          <div v-if="item.content" class="message-item-content">{{ item.content }}</div>
          <div class="message-item-time">{{ formatTime(item.timestamp) }}</div>
        </button>
        <p v-if="!messages.length" class="message-empty">{{ t('messages.empty') }}</p>
      </div>
    </div>
  </details>
</template>
