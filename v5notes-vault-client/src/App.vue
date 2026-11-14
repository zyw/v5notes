<script setup lang="ts">
import { ref } from 'vue'
import WelcomeView from './views/WelcomeView.vue'
import SettingsView from './views/SettingsView.vue'
import WorkspaceView from './views/WorkspaceView.vue'
import type { OpenedVault } from './vault/types'

type Page = 'welcome' | 'workspace' | 'settings'
const page = ref<Page>('welcome')
const vault = ref<OpenedVault | null>(null)
const banner = ref<string | null>(null)

function onOpened(opened: OpenedVault) {
  vault.value = opened
  banner.value = null
  page.value = 'workspace'
}

function closeVault() {
  vault.value = null
  page.value = 'welcome'
}

function goSettings() {
  page.value = 'settings'
}

function goHome() {
  page.value = vault.value ? 'workspace' : 'welcome'
}
</script>

<template>
  <div class="shell" :class="{ 'is-workspace': page === 'workspace' }">
    <header class="topbar">
      <div class="brand">
        <img class="brand-mark" src="./assets/brand-icon.png" width="28" height="28" alt="" />
        <span class="brand-name">V5Notes Vault</span>
      </div>
      <nav class="nav">
        <button type="button" :class="{ active: page === 'welcome' || page === 'workspace' }" @click="goHome">
          {{ vault ? '工作区' : '欢迎' }}
        </button>
        <button type="button" :class="{ active: page === 'settings' }" @click="goSettings">设置</button>
      </nav>
    </header>
    <p v-if="banner" class="app-banner" role="status">{{ banner }}</p>
    <main class="main" :class="{ 'main-fill': page === 'workspace' }">
      <WelcomeView v-if="page === 'welcome'" @opened="onOpened" />
      <WorkspaceView
        v-else-if="page === 'workspace' && vault"
        :vault="vault"
        @close="closeVault"
        @error="banner = $event"
      />
      <SettingsView v-else />
    </main>
  </div>
</template>
