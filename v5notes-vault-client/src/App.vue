<script setup lang="ts">
import { ref } from 'vue'
import WelcomeView from './views/WelcomeView.vue'
import SettingsView from './views/SettingsView.vue'

type Page = 'welcome' | 'settings'
const page = ref<Page>('welcome')
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <img class="brand-mark" src="./assets/brand-icon.png" width="28" height="28" alt="" />
        <span class="brand-name">V5Notes Vault</span>
      </div>
      <nav class="nav">
        <button type="button" :class="{ active: page === 'welcome' }" @click="page = 'welcome'">欢迎</button>
        <button type="button" :class="{ active: page === 'settings' }" @click="page = 'settings'">设置</button>
      </nav>
    </header>
    <main class="main">
      <WelcomeView v-if="page === 'welcome'" />
      <SettingsView v-else />
    </main>
  </div>
</template>
