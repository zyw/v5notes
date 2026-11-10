<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { getVersion } from '@tauri-apps/api/app'
import { invoke, isTauri } from '@tauri-apps/api/core'
import brandIcon from '../assets/brand-icon.png'
import { settingsActionLabel } from '../models/appUpdate'
import { OFFICIAL_SERVER, normalizeServer } from '../models/serverSettings'

const props = defineProps<{
  defaultOutlineVisible: boolean
  defaultDirectoryVisible: boolean
  defaultTreeExpanded: boolean
  server: string
  useOfficial: boolean
  updateChecking?: boolean
  offeredVersion?: string | null
  releaseNotesAvailable?: boolean
}>()
const emit = defineEmits<{
  close: []
  'set-default-outline-visible': [visible: boolean]
  'set-default-directory-visible': [visible: boolean]
  'set-default-tree-expanded': [expanded: boolean]
  'save-server': [address: string, official: boolean]
  'check-update': []
  'show-release-notes': []
}>()
const updateLabel = computed(() => settingsActionLabel(props.updateChecking === true, props.offeredVersion ?? null))
const version = ref('读取中…')
/** 官方地址只在代码里，勾选官方时输入框不显示 URL。 */
const serverDraft = ref(props.useOfficial ? '' : props.server)
const officialDraft = ref(props.useOfficial)
const serverMessage = ref('')
const serverError = ref('')
const serverDirty = computed(() => {
  if (officialDraft.value !== props.useOfficial) return true
  if (officialDraft.value) return false
  const draft = serverDraft.value.trim()
  try {
    return normalizeServer(draft) !== props.server
  } catch {
    return draft.length > 0 || props.server !== OFFICIAL_SERVER
  }
})

watch(() => props.server, () => { serverMessage.value = '' })
watch(() => props.useOfficial, value => { officialDraft.value = value })

function toggleOfficial(event: Event): void {
  const checked = (event.target as HTMLInputElement).checked
  officialDraft.value = checked
  serverError.value = ''
  serverMessage.value = ''
  if (!checked && !serverDraft.value && props.server !== OFFICIAL_SERVER) serverDraft.value = props.server
}

function onServerInput(event: Event): void {
  serverDraft.value = (event.target as HTMLInputElement).value
  serverError.value = ''
  serverMessage.value = ''
}

function saveServer(): void {
  serverError.value = ''
  serverMessage.value = ''
  try {
    const address = officialDraft.value ? OFFICIAL_SERVER : normalizeServer(serverDraft.value)
    if (!officialDraft.value) serverDraft.value = address
    emit('save-server', address, officialDraft.value)
    serverMessage.value = '已保存'
  } catch (cause) {
    serverError.value = cause instanceof Error ? cause.message : '服务器地址无效，请检查后重试'
  }
}
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
        <button ref="closeButton" class="settings-close" type="button" aria-label="关闭设置" @click="emit('close')">×</button>
      </header>

      <section class="settings-conn" aria-labelledby="settings-conn-title">
        <div class="settings-conn-head">
          <span class="conn-dot" :class="{ 'is-custom': !officialDraft }" aria-hidden="true" />
          <strong id="settings-conn-title">连接</strong>
          <span class="settings-conn-state">{{ officialDraft ? '官方服务器' : '自定义服务器' }}</span>
        </div>
        <div class="settings-conn-body">
          <input
            class="conn-input"
            type="url"
            :value="serverDraft"
            :disabled="officialDraft"
            :placeholder="officialDraft ? '官方服务器 · 不可编辑' : 'https://notes.example.com'"
            aria-label="服务器地址"
            autocomplete="url"
            @input="onServerInput"
          >
          <label class="conn-check" :class="{ 'is-checked': officialDraft }">
            <input type="checkbox" :checked="officialDraft" @change="toggleOfficial">
            <span class="conn-box" aria-hidden="true" />
            使用官方地址
          </label>
          <button class="conn-save" type="button" :disabled="!serverDirty" @click="saveServer">保存</button>
        </div>
        <p v-if="serverError" class="conn-error" role="alert">{{ serverError }}</p>
        <p v-else-if="serverMessage && !serverDirty" class="conn-hint" role="status">{{ serverMessage }}</p>
        <p v-else class="conn-hint">保存连接设置后，需要用该服务器上的账号重新登录。</p>
      </section>

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

      <footer class="settings-footer">
        <div class="about-app">
          <img :src="brandIcon" alt="" />
          <div>
            <strong>v5notes</strong>
            <span>版本 {{ version }}<button class="update-check" type="button" :disabled="updateChecking" @click="emit('check-update')">{{ updateLabel }}</button><button v-if="releaseNotesAvailable" class="update-check" type="button" @click="emit('show-release-notes')">查看本版更新说明</button></span>
          </div>
        </div>
        <a class="project-link" href="https://github.com/zyw/v5notes" target="_blank" rel="noopener noreferrer" aria-label="项目主页（GitHub）" @click="openProjectLink">
          github.com/zyw/v5notes
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4h9v9M16 4 8 12M14 11v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" /></svg>
        </a>
        <button class="primary" type="button" @click="emit('close')">完成</button>
        <p v-if="linkError" class="dialog-error" role="alert">{{ linkError }}</p>
      </footer>
    </section>
  </div>
</template>
