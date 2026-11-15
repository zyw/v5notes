<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { isTauri } from '@tauri-apps/api/core'
import CreateVaultDialog from '../components/CreateVaultDialog.vue'
import { resolveVaultColor } from '../appearance/vaultColors'
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
const inTauri = isTauri()

const canUseFs = computed(() => inTauri)

function refreshRecent() {
  recent.value = vaultWorkspace.listRecent()
}

function colorFor(entry: RecentVaultEntry) {
  return resolveVaultColor(entry.rootPath)
}

onMounted(() => {
  void hydrateRecentVaults().then(entries => {
    recent.value = entries
  })
})

function explain(errorValue: unknown): string {
  if (errorValue instanceof VaultPathError) return errorValue.message
  if (errorValue instanceof Error) return errorValue.message
  return String(errorValue)
}

async function run(action: () => Promise<OpenedVault | null>) {
  if (!canUseFs.value) {
    error.value = '请通过桌面应用（tauri dev / 安装包）打开，浏览器预览无法访问本地文件夹。'
    return
  }
  busy.value = true
  error.value = null
  try {
    const vault = await action()
    if (vault) {
      refreshRecent()
      emit('opened', vault)
    }
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
      refreshRecent()
      emit('opened', vault)
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
  void run(async () => {
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
  })
}

function forget(entry: RecentVaultEntry) {
  vaultWorkspace.forgetRecent(entry.rootPath)
  refreshRecent()
}
</script>

<template>
  <section class="welcome-split" aria-labelledby="welcome-title">
    <aside class="welcome-list" aria-label="最近打开的库">
      <h1 id="welcome-title">打开库</h1>
      <p class="welcome-lede">
        本地文件夹是权威。最近的库列在左侧；创建与打开在右侧。Cloud 与 Vault 默认不是同一份数据。
      </p>

      <div v-if="recent.length" class="recent-stack">
        <button
          v-for="entry in recent"
          :key="entry.rootPath"
          type="button"
          class="vault-item"
          :disabled="busy"
          @click="openRecent(entry)"
        >
          <i class="vault-swatch" :style="{ background: colorFor(entry).color }" aria-hidden="true" />
          <span class="vault-item-copy">
            <strong>{{ entry.name }}</strong>
            <span>{{ entry.rootPath }}</span>
            <em>{{ colorFor(entry).term }} · {{ colorFor(entry).name }}</em>
          </span>
          <button
            type="button"
            class="ghost compact vault-forget"
            :disabled="busy"
            @click.stop="forget(entry)"
          >
            移除
          </button>
        </button>
      </div>
      <p v-else class="empty-recent">还没有最近打开的库。</p>
    </aside>

    <div class="welcome-actions">
      <p class="eyebrow">LOCAL FIRST</p>
      <p class="lede tight">
        登录可选——未登录仍可纯本地使用。备份 zip ≠ Sync；官方发布仅为产品通道。
      </p>

      <ul class="actions stacked" aria-label="开库方式">
        <li>
          <button type="button" class="primary" :disabled="busy" @click="openCreate">创建新库</button>
          <span>选择父目录并命名，写入 <code>.v5notes</code> 骨架</span>
        </li>
        <li>
          <button type="button" class="ghost" :disabled="busy" @click="openExisting">打开已有库</button>
          <span>选择已有 Vault 根目录（需含 <code>.v5notes/vault.json</code>）</span>
        </li>
        <li>
          <button type="button" class="ghost" :disabled="busy" @click="openDefault">使用默认库</button>
          <span>应用数据目录内的默认库（不存在则自动创建）</span>
        </li>
      </ul>

      <p v-if="error" class="banner-error" role="alert">{{ error }}</p>
      <p class="hint">请勿把库放进网盘同步目录后再开官方 Sync。</p>
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
