<script setup lang="ts">
import { ref } from 'vue'
import AccountPanel from '../components/AccountPanel.vue'
import type { AccountState } from '../account'
import {
  applyAppearance,
  BUILTIN_THEMES,
  loadAppearancePrefs,
  saveAppearancePrefs,
  type AppearancePrefs,
  type BuiltinThemeId,
  type ColorMode,
} from '../appearance/themes'

defineProps<{
  account: AccountState
}>()

const prefs = ref<AppearancePrefs>(loadAppearancePrefs())

function commit(next: AppearancePrefs) {
  prefs.value = next
  saveAppearancePrefs(next)
  applyAppearance(next)
}

function setTheme(theme: BuiltinThemeId) {
  commit({ ...prefs.value, theme })
}

function setColorMode(colorMode: ColorMode) {
  commit({ ...prefs.value, colorMode })
}
</script>

<template>
  <section class="panel settings" aria-labelledby="settings-title">
    <p class="eyebrow">SETTINGS</p>
    <h1 id="settings-title">设置</h1>
    <p class="lede">
      本地 Vault 优先。账号登录可选，用于套餐与后续同步；未登录不影响建库与编辑。
    </p>

    <AccountPanel :account="account" />

    <section class="settings-block" aria-labelledby="appearance-title">
      <h2 id="appearance-title">外观</h2>
      <p class="settings-help">切换内置主题与色模式。变量契约见 <code>styles/tokens.css</code>，供 Phase 6 Theme API 校验。</p>

      <div class="choice-row" role="group" aria-label="内置主题">
        <button
          v-for="theme in BUILTIN_THEMES"
          :key="theme.id"
          type="button"
          class="choice"
          :class="{ active: prefs.theme === theme.id }"
          @click="setTheme(theme.id)"
        >
          <strong>{{ theme.label }}</strong>
          <span>{{ theme.description }}</span>
        </button>
      </div>

      <div class="choice-row" role="group" aria-label="色模式">
        <button
          v-for="mode in [
            { id: 'system' as const, label: '跟随系统' },
            { id: 'light' as const, label: '浅色' },
            { id: 'dark' as const, label: '深色' },
          ]"
          :key="mode.id"
          type="button"
          class="choice compact-choice"
          :class="{ active: prefs.colorMode === mode.id }"
          @click="setColorMode(mode.id)"
        >
          <strong>{{ mode.label }}</strong>
        </button>
      </div>
    </section>

    <dl class="meta">
      <div>
        <dt>产品</dt>
        <dd>V5Notes Vault</dd>
      </div>
      <div>
        <dt>Bundle ID</dt>
        <dd><code>xin.v5ai.v5notes.vault</code></dd>
      </div>
      <div>
        <dt>Deep link</dt>
        <dd><code>v5notes-vault://</code></dd>
      </div>
      <div>
        <dt>同步</dt>
        <dd>Phase 4 SyncEngine（本阶段仅账号与引导）</dd>
      </div>
    </dl>
  </section>
</template>
