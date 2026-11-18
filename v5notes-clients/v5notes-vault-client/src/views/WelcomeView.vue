<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { isTauri } from '@tauri-apps/api/core'
import brandIcon from '../assets/brand-icon.png'
import CreateVaultDialog from '../components/CreateVaultDialog.vue'
import TreeIcon from '../components/TreeIcon.vue'
import {
  VAULT_COLOR_PALETTE,
  applyPendingWelcomeColor,
  commitPendingWelcomeColor,
  getPendingWelcomeColor,
  resolveVaultColor,
  setPendingWelcomeColor,
  type VaultColorSwatch,
} from '../appearance/vaultColors'
import { VaultPathError } from '../path/identity'
import type { OpenedVault, RecentVaultEntry } from '../vault/types'
import { hydrateRecentVaults } from '../vault/recent'
import { vaultWorkspace } from '../vault/workspace'

const emit = defineEmits<{
  opened: [vault: OpenedVault]
}>()

const error = ref<string | null>(null)
const busy = ref(false)
const createOpen = ref(false)
const createError = ref<string | null>(null)
const recent = ref<RecentVaultEntry[]>(vaultWorkspace.listRecent())
const pending = ref<VaultColorSwatch>(getPendingWelcomeColor())
const inTauri = isTauri()

const canUseFs = computed(() => inTauri)

function refreshRecent() {
  recent.value = vaultWorkspace.listRecent()
}

function colorFor(entry: RecentVaultEntry) {
  return resolveVaultColor(entry.rootPath)
}

onMounted(() => {
  pending.value = applyPendingWelcomeColor()
  void hydrateRecentVaults().then(entries => {
    recent.value = entries
  })
})

function pickColor(id: string) {
  pending.value = setPendingWelcomeColor(id)
}

function explain(errorValue: unknown): string {
  if (errorValue instanceof VaultPathError) return errorValue.message
  if (errorValue instanceof Error) return errorValue.message
  return String(errorValue)
}

function afterOpened(vault: OpenedVault, options?: { bindPendingColor?: boolean }) {
  if (options?.bindPendingColor !== false) {
    commitPendingWelcomeColor(vault.rootPath)
  }
  refreshRecent()
  emit('opened', vault)
}

async function run(
  action: () => Promise<OpenedVault | null>,
  options?: { bindPendingColor?: boolean },
) {
  if (!canUseFs.value) {
    error.value = '请通过桌面应用（tauri dev / 安装包）打开，浏览器预览无法访问本地文件夹。'
    return
  }
  busy.value = true
  error.value = null
  try {
    const vault = await action()
    if (vault) afterOpened(vault, options)
  } catch (err) {
    error.value = explain(err)
  } finally {
    busy.value = false
  }
}

function openCreate() {
  createError.value = null
  createOpen.value = true
}

async function submitCreate(name: string) {
  createError.value = null
  busy.value = true
  try {
    const vault = await vaultWorkspace.pickAndCreateVault(name)
    if (vault) {
      createOpen.value = false
      afterOpened(vault)
    }
  } catch (err) {
    createError.value = explain(err)
  } finally {
    busy.value = false
  }
}

function openExisting() {
  void run(() => vaultWorkspace.pickAndOpenVault())
}

function openDefault() {
  void run(() => vaultWorkspace.openDefaultVault())
}

function openRecent(entry: RecentVaultEntry) {
  void run(
    async () => {
      try {
        return await vaultWorkspace.openRecent(entry.rootPath)
      } catch (err) {
        vaultWorkspace.forgetRecent(entry.rootPath)
        refreshRecent()
        const base = explain(err)
        throw new Error(
          `${base}。库可能已移动或权限失效，已从最近列表移除；请用「打开已有库」重新授权。`,
        )
      }
    },
    { bindPendingColor: false },
  )
}

function forget(entry: RecentVaultEntry) {
  vaultWorkspace.forgetRecent(entry.rootPath)
  refreshRecent()
}
</script>

<template>
  <section class="welcome-a" aria-labelledby="welcome-title">
    <div class="welcome-hero">
      <h1 id="welcome-title">选一个库色，再打开文件夹</h1>
      <p class="welcome-lede">
        本地文件夹是权威；库色是身份条，不是皮肤。Cloud 与 Vault 默认不是同一份数据。
      </p>

      <ul class="welcome-action-stack" aria-label="开库方式">
        <li>
          <button type="button" class="welcome-cta primary" :disabled="busy" @click="openCreate">
            创建新库
          </button>
          <span>选父目录并命名，写入 <code>.v5notes</code> 骨架</span>
        </li>
        <li>
          <button type="button" class="welcome-cta ghost" :disabled="busy" @click="openExisting">
            打开已有库
          </button>
          <span>选择含 <code>vault.json</code> 的根目录</span>
        </li>
        <li>
          <button type="button" class="welcome-cta ghost" :disabled="busy" @click="openDefault">
            使用默认库
          </button>
          <span>应用数据目录中的默认库</span>
        </li>
      </ul>

      <p v-if="error" class="banner-error" role="alert">{{ error }}</p>
      <p class="welcome-hint">请勿把库放进网盘同步目录后再开官方 Sync。</p>

      <div
        v-if="recent.length"
        class="welcome-recent"
        aria-label="最近打开的库"
      >
        <p class="welcome-recent-label">最近</p>
        <div class="welcome-recent-row">
          <button
            v-for="entry in recent"
            :key="entry.rootPath"
            type="button"
            class="welcome-recent-chip"
            :disabled="busy"
            @click="openRecent(entry)"
          >
            <i class="chip-swatch" :style="{ background: colorFor(entry).color }" aria-hidden="true" />
            <span class="chip-copy">
              <strong>{{ entry.name }}</strong>
              <em>{{ colorFor(entry).term }}</em>
            </span>
            <span
              class="chip-forget"
              role="button"
              tabindex="0"
              @click.stop="forget(entry)"
              @keydown.enter.stop="forget(entry)"
            >移除</span>
          </button>
        </div>
      </div>

      <div class="term-rail" role="radiogroup" aria-label="节气库色">
        <button
          v-for="swatch in VAULT_COLOR_PALETTE"
          :key="swatch.id"
          type="button"
          class="term-swatch"
          :class="{ active: pending.id === swatch.id }"
          :style="{ '--swatch': swatch.color }"
          role="radio"
          :aria-checked="pending.id === swatch.id"
          :aria-label="`${swatch.term} · ${swatch.name}`"
          @click="pickColor(swatch.id)"
        >
          <span class="term-name">{{ swatch.term }}</span>
          <span class="term-color">{{ swatch.name }}</span>
        </button>
      </div>
    </div>

    <div class="welcome-preview" aria-hidden="true">
      <div class="preview-shell">
        <aside class="preview-sidebar">
          <div class="preview-brand">
            <img :src="brandIcon" width="22" height="22" alt="" />
            <strong>V5Notes</strong>
          </div>
          <div class="preview-heading">
            <span>笔记</span>
            <span class="preview-heading-icons">
              <svg viewBox="0 0 20 20"><circle cx="9" cy="9" r="5.2" /><path d="m13 13 3.2 3.2" /></svg>
              <svg viewBox="0 0 20 20">
                <path d="M3 5.5h14M3 10h14M3 14.5h14" />
                <circle cx="7.2" cy="5.5" r="1.7" />
                <circle cx="13" cy="10" r="1.7" />
                <circle cx="6.2" cy="14.5" r="1.7" />
              </svg>
              <svg viewBox="0 0 20 20">
                <path d="M2.6 5.6h4.1l1.1 1.3h9.5v8.7H2.6z" />
                <path d="M10 9.4v4.2M7.9 11.5h4.2" />
              </svg>
            </span>
          </div>
          <ul class="preview-tree">
            <li class="folder"><TreeIcon kind="folder" />日记</li>
            <li class="note active"><TreeIcon kind="note" />今日</li>
            <li class="folder"><TreeIcon kind="folder" />项目</li>
            <li class="note nested"><TreeIcon kind="note" />草案</li>
          </ul>
          <div class="preview-footer">
            <div class="preview-trash">
              <svg viewBox="0 0 20 20"><path d="M4.2 6h11.6M8 6V4.2h4V6M5.6 6l.8 11h7.2l.8-11" /></svg>
              回收站
            </div>
            <div class="preview-profile">
              <span class="preview-avatar" :style="{ background: pending.color }">R</span>
              <span class="preview-profile-name">research-vault</span>
              <svg viewBox="0 0 16 16"><path d="M4.5 6.5 8 10l3.5-3.5" /></svg>
            </div>
          </div>
        </aside>
        <div class="preview-editor">
          <header class="preview-editor-bar">
            <span class="preview-panel-btn">
              <svg viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M8 4v12" /></svg>
            </span>
            <strong>今日</strong>
            <em class="preview-mode">预览中</em>
            <span class="preview-command">命令 ⌘K</span>
            <span class="preview-outline-toggle">
              <svg viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M12 4v12" /></svg>
            </span>
          </header>
          <div class="preview-body">
            <span class="preview-edit-pill">
              <svg viewBox="0 0 16 16"><path d="M3 12.7 4.2 9 11 2.2l2.5 2.5-6.8 6.8z" /></svg>
              编辑
            </span>
            <p class="preview-h">今日</p>
            <p>编辑器占满剩余宽度；右侧大纲与查找随手可用。</p>
          </div>
        </div>
        <aside class="preview-outline">
          <div class="preview-outline-tabs"><span class="on">大纲</span><span>查找</span></div>
          <p>今日</p>
          <p class="nested">晨间</p>
          <p class="nested">待办</p>
        </aside>
      </div>
    </div>

    <CreateVaultDialog
      :open="createOpen"
      :busy="busy"
      :error="createError"
      @cancel="createOpen = false"
      @submit="submitCreate"
    />
  </section>
</template>
