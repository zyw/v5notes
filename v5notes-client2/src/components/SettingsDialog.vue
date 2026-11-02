<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { getVersion } from '@tauri-apps/api/app'
import { invoke, isTauri } from '@tauri-apps/api/core'
import brandIcon from '../assets/brand-icon.png'

const props = defineProps<{ defaultOutlineVisible: boolean; defaultDirectoryVisible: boolean }>()
const emit = defineEmits<{
  close: []
  'set-default-outline-visible': [visible: boolean]
  'set-default-directory-visible': [visible: boolean]
}>()
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

async function openProjectLink(event: MouseEvent): Promise<void> {
  if (!isTauri()) return
  event.preventDefault()
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

      <section class="settings-section" aria-labelledby="settings-workspace-title">
        <h3 id="settings-workspace-title">工作区</h3>
        <div class="settings-preference-list">
          <div class="settings-preference-row">
            <div class="settings-preference-copy">
              <strong>启动时展开左侧目录</strong>
              <span>应用启动时默认展开目录树；工具栏可临时收起。</span>
            </div>
            <button class="settings-switch" :class="{ 'is-on': props.defaultDirectoryVisible }" type="button" role="switch" :aria-checked="props.defaultDirectoryVisible" aria-label="启动时展开左侧目录" @click="emit('set-default-directory-visible', !props.defaultDirectoryVisible)">
              <span />
            </button>
          </div>
          <div class="settings-preference-row">
            <div class="settings-preference-copy">
              <strong>默认显示大纲</strong>
              <span>应用启动时默认显示右侧大纲；工具栏可临时切换。</span>
            </div>
            <button class="settings-switch" :class="{ 'is-on': props.defaultOutlineVisible }" type="button" role="switch" :aria-checked="props.defaultOutlineVisible" aria-label="默认显示大纲" @click="emit('set-default-outline-visible', !props.defaultOutlineVisible)">
              <span />
            </button>
          </div>
        </div>
      </section>

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
          <a class="project-link" href="https://github.com/zyw/v5notes" target="_blank" rel="noopener noreferrer" @click="openProjectLink">
            github.com/zyw/v5notes
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4h9v9M16 4 8 12M14 11v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" /></svg>
          </a>
        </div>
        <p v-if="linkError" class="dialog-error" role="alert">{{ linkError }}</p>
      </section>

      <footer class="modal-actions settings-actions">
        <button class="primary" type="button" @click="emit('close')">完成</button>
      </footer>
    </section>
  </div>
</template>
