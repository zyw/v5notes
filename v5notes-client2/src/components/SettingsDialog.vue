<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { getVersion } from '@tauri-apps/api/app'
import { invoke, isTauri } from '@tauri-apps/api/core'
import brandIcon from '../assets/brand-icon.png'

const props = defineProps<{ defaultOutlineVisible: boolean; defaultDirectoryVisible: boolean; defaultTreeExpanded: boolean }>()
const emit = defineEmits<{
  close: []
  'set-default-outline-visible': [visible: boolean]
  'set-default-directory-visible': [visible: boolean]
  'set-default-tree-expanded': [expanded: boolean]
}>()
const version = ref('读取中…')
const linkError = ref('')
const closeButton = ref<HTMLButtonElement | null>(null)
const autostartSupported = ref(false)
const autostartEnabled = ref(false)
const autostartLoading = ref(isTauri())
const autostartReady = ref(false)
const autostartBusy = ref(false)
const autostartError = ref('')

onMounted(async () => {
  await nextTick()
  closeButton.value?.focus()
  try {
    version.value = await getVersion()
  } catch {
    version.value = '0.1.0'
  }
  if (!isTauri()) return
  try {
    autostartSupported.value = await invoke<boolean>('autostart_is_supported')
    if (autostartSupported.value) {
      autostartEnabled.value = await invoke<boolean>('autostart_is_enabled')
      autostartReady.value = true
    }
  } catch (cause) {
    autostartError.value = cause instanceof Error ? cause.message : '读取登录启动状态失败。'
  } finally {
    autostartLoading.value = false
  }
})

async function toggleAutostart(): Promise<void> {
  if (!autostartReady.value || autostartBusy.value) return
  const enabled = !autostartEnabled.value
  autostartBusy.value = true
  autostartError.value = ''
  try {
    await invoke('set_autostart_enabled', { enabled })
    autostartEnabled.value = enabled
  } catch (cause) {
    autostartError.value = cause instanceof Error ? cause.message : '更新登录启动设置失败，请重试。'
  } finally {
    autostartBusy.value = false
  }
}

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

      <section v-if="autostartSupported || autostartError" class="settings-section" aria-labelledby="settings-general-title">
        <h3 id="settings-general-title">通用</h3>
        <div v-if="autostartSupported" class="settings-preference-row">
          <div class="settings-preference-copy">
            <strong>登录系统后自动启动 v5notes</strong>
            <span>开启后应用会在你登录系统后自动启动；默认关闭。</span>
          </div>
          <button class="settings-switch" :class="{ 'is-on': autostartEnabled }" type="button" role="switch" :aria-checked="autostartEnabled" :disabled="autostartLoading || autostartBusy || !autostartReady" aria-label="登录系统后自动启动 v5notes" @click="toggleAutostart">
            <span />
          </button>
        </div>
        <p v-if="autostartError" class="dialog-error" role="alert">{{ autostartError }}</p>
      </section>

      <section class="settings-section" aria-labelledby="settings-workspace-title">
        <h3 id="settings-workspace-title">工作区</h3>
        <div class="settings-preference-list">
          <div class="settings-preference-row">
            <div class="settings-preference-copy">
              <strong>启动时显示左侧栏</strong>
              <span>应用启动时默认显示左侧目录栏；工具栏可临时收起。</span>
            </div>
            <button class="settings-switch" :class="{ 'is-on': props.defaultDirectoryVisible }" type="button" role="switch" :aria-checked="props.defaultDirectoryVisible" aria-label="启动时显示左侧栏" @click="emit('set-default-directory-visible', !props.defaultDirectoryVisible)">
              <span />
            </button>
          </div>
          <div class="settings-preference-row">
            <div class="settings-preference-copy">
              <strong>默认展开目录树</strong>
              <span>展开全部目录并记住此选择；关闭后只自动展开当前笔记所在路径。</span>
            </div>
            <button class="settings-switch" :class="{ 'is-on': props.defaultTreeExpanded }" type="button" role="switch" :aria-checked="props.defaultTreeExpanded" aria-label="默认展开目录树" @click="emit('set-default-tree-expanded', !props.defaultTreeExpanded)">
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
