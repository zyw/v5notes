<script setup lang="ts">
import { computed, ref } from 'vue'
import { isTauri } from '@tauri-apps/api/core'
import CreateVaultDialog from '../components/CreateVaultDialog.vue'
import { VaultPathError } from '../path/identity'
import type { OpenedVault, RecentVaultEntry } from '../vault/types'
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
      throw err
    }
  })
}

function forget(entry: RecentVaultEntry) {
  vaultWorkspace.forgetRecent(entry.rootPath)
  refreshRecent()
}
</script>

<template>
  <section class="panel welcome" aria-labelledby="welcome-title">
    <p class="eyebrow">PHASE 1 · 本地 MVP</p>
    <h1 id="welcome-title">欢迎使用 V5Notes Vault</h1>
    <p class="lede">
      本地文件夹是权威；笔记正文是库内的 <code>.md</code>。Cloud 笔记与 Vault 库默认不是同一份数据。本阶段零网络、免登录。
    </p>

    <ul class="actions" aria-label="开库方式">
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

    <div v-if="recent.length" class="recent">
      <h2>最近打开</h2>
      <ul>
        <li v-for="entry in recent" :key="entry.rootPath">
          <button type="button" class="recent-open" :disabled="busy" @click="openRecent(entry)">
            <strong>{{ entry.name }}</strong>
            <span>{{ entry.rootPath }}</span>
          </button>
          <button type="button" class="ghost compact" :disabled="busy" @click="forget(entry)">移除</button>
        </li>
      </ul>
    </div>

    <p v-if="error" class="banner-error" role="alert">{{ error }}</p>
    <p class="hint">请勿把库放进网盘同步目录后再开官方 Sync。</p>

    <CreateVaultDialog
      :open="createOpen"
      :busy="busy"
      :error="createError"
      @cancel="createOpen = false"
      @submit="submitCreate"
    />
  </section>
</template>
