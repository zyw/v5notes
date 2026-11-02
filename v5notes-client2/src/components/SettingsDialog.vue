<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import brandIcon from '../assets/brand-icon.png'

const emit = defineEmits<{ close: [] }>()
const version = ref('读取中…')
const linkError = ref('')
const closeButton = ref<HTMLButtonElement | null>(null)

onMounted(async () => {
  await nextTick()
  closeButton.value?.focus()
  try {
    version.value = await getVersion()
  } catch {
    version.value = '0.1.0'
  }
})

async function openProjectLink(): Promise<void> {
  linkError.value = ''
  try {
    await invoke('open_project_link')
  } catch (cause) {
    linkError.value = cause instanceof Error ? cause.message : '无法打开项目主页，请稍后重试。'
  }
}
</script>

<template>
  <div class="modal-backdrop settings-backdrop" role="presentation" @click.self="emit('close')">
    <section class="modal settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" @keydown.esc.stop.prevent="emit('close')">
      <header class="settings-header">
        <div>
          <span class="eyebrow">PREFERENCES</span>
          <h2 id="settings-title">设置</h2>
        </div>
        <button ref="closeButton" class="settings-close" type="button" aria-label="关闭设置" title="关闭" @click="emit('close')">×</button>
      </header>

      <section class="settings-section" aria-labelledby="settings-about-title">
        <h3 id="settings-about-title">关于</h3>
        <div class="about-app">
          <img :src="brandIcon" alt="" />
          <div>
            <strong>v5notes</strong>
            <span>版本 {{ version }}</span>
          </div>
        </div>
        <div class="about-project">
          <span>项目主页</span>
          <button class="project-link" type="button" @click="openProjectLink">
            github.com/zyw/v5notes
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4h9v9M16 4 8 12M14 11v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" /></svg>
          </button>
        </div>
        <p v-if="linkError" class="dialog-error" role="alert">{{ linkError }}</p>
      </section>

      <footer class="modal-actions settings-actions">
        <button class="primary" type="button" @click="emit('close')">完成</button>
      </footer>
    </section>
  </div>
</template>
