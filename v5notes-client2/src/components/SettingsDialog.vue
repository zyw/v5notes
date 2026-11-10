<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getVersion } from '@tauri-apps/api/app'
import { invoke, isTauri } from '@tauri-apps/api/core'
import brandIcon from '../assets/brand-icon.png'
import { applyLocale, currentLocale, LOCALE_OPTIONS, type AppLocale } from '../i18n'
import { settingsActionLabel } from '../models/appUpdate'
import { useAppTheme } from '../hooks/useAppTheme'
import { OFFICIAL_SERVER, normalizeServer } from '../models/serverSettings'

const { t } = useI18n()
const locale = computed(() => currentLocale())
const { mode: themeMode, setMode: setThemeMode } = useAppTheme()
const themeOptions = computed(() => ([
  { value: 'auto' as const, label: t('settings.themeAuto') },
  { value: 'light' as const, label: t('settings.themeLight') },
  { value: 'dark' as const, label: t('settings.themeDark') },
]))

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
const version = ref(t('common.loading'))
/** 官方地址只在代码里，勾选官方时输入框不显示 URL。 */
const serverDraft = ref(props.useOfficial ? '' : props.server)
const officialDraft = ref(props.useOfficial)
const serverSaved = ref(false)
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

watch(() => props.server, () => { serverSaved.value = false })
watch(() => props.useOfficial, value => { officialDraft.value = value })

function toggleOfficial(event: Event): void {
  const checked = (event.target as HTMLInputElement).checked
  officialDraft.value = checked
  serverError.value = ''
  serverSaved.value = false
  if (!checked && !serverDraft.value && props.server !== OFFICIAL_SERVER) serverDraft.value = props.server
}

function onServerInput(event: Event): void {
  serverDraft.value = (event.target as HTMLInputElement).value
  serverError.value = ''
  serverSaved.value = false
}

function saveServer(): void {
  serverError.value = ''
  serverSaved.value = false
  try {
    const address = officialDraft.value ? OFFICIAL_SERVER : normalizeServer(serverDraft.value)
    if (!officialDraft.value) serverDraft.value = address
    emit('save-server', address, officialDraft.value)
    serverSaved.value = true
  } catch (cause) {
    serverError.value = cause instanceof Error ? cause.message : t('settings.invalidServer')
  }
}
/** 关闭后把焦点还回打开设置的那个按钮。 */
let restoreFocus: HTMLElement | null = null
const linkError = ref('')
const closeButton = ref<HTMLButtonElement | null>(null)
const autostartSupported = ref(false)
const autostartEnabled = ref(false)
const autostartLoading = ref(isTauri())
const autostartReady = ref(false)
const autostartBusy = ref(false)
const autostartError = ref('')

/** 「完成」= 应用并关闭：有未保存的服务器地址时先保存，校验失败就停在弹窗里。 */
function finish(): void {
  if (serverDirty.value) {
    saveServer()
    if (serverError.value) return
  }
  emit('close')
}

onMounted(async () => {
  restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  await nextTick()
  closeButton.value?.focus()
  try {
    version.value = await getVersion()
  } catch {
    version.value = '2.0.0'
  }
  if (!isTauri()) return
  try {
    autostartSupported.value = await invoke<boolean>('autostart_is_supported')
    if (autostartSupported.value) {
      autostartEnabled.value = await invoke<boolean>('autostart_is_enabled')
      autostartReady.value = true
    }
  } catch (cause) {
    autostartError.value = cause instanceof Error ? cause.message : t('settings.autostartReadFailed')
  } finally {
    autostartLoading.value = false
  }
})

onBeforeUnmount(() => {
  if (restoreFocus?.isConnected) restoreFocus.focus()
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
    autostartError.value = cause instanceof Error ? cause.message : t('settings.autostartWriteFailed')
  } finally {
    autostartBusy.value = false
  }
}

function onLocale(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'zh-CN' || value === 'zh-TW' || value === 'en') applyLocale(value as AppLocale)
}

async function openProjectLink(event: MouseEvent): Promise<void> {
  if (!isTauri()) return
  event.preventDefault()
  linkError.value = ''
  try {
    await invoke('open_project_link')
  } catch (cause) {
    linkError.value = cause instanceof Error ? cause.message : t('settings.projectOpenFailed')
  }
}
</script>

<template>
  <div class="modal-backdrop settings-backdrop" role="presentation" @click.self="emit('close')">
    <section class="modal settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" aria-describedby="settings-subtitle" @keydown.esc.stop.prevent="emit('close')">
      <header class="settings-header">
        <div class="settings-heading">
          <span class="eyebrow">PREFERENCES</span>
          <h2 id="settings-title">{{ t('settings.title') }}</h2>
          <p id="settings-subtitle" class="settings-subtitle">{{ t('settings.subtitle') }}</p>
        </div>
        <button ref="closeButton" class="settings-close" type="button" :aria-label="t('settings.close')" @click="emit('close')">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" /></svg>
        </button>
      </header>

      <div class="settings-body">
        <section class="settings-conn" aria-labelledby="settings-conn-title">
          <div class="settings-panel-head">
            <span class="settings-panel-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16"><rect x="2.6" y="2.8" width="10.8" height="4.2" rx="1.4" /><rect x="2.6" y="9" width="10.8" height="4.2" rx="1.4" /><path d="M5 4.9h.01M5 11.1h.01" /></svg>
            </span>
            <h3 id="settings-conn-title">{{ t('settings.connection') }}</h3>
            <span class="conn-pill" :class="{ 'is-custom': !officialDraft }">
              <span class="conn-dot" aria-hidden="true" />
              {{ officialDraft ? t('settings.official') : t('settings.custom') }}
            </span>
          </div>
          <div class="settings-conn-body">
            <label class="conn-field" :class="{ 'is-disabled': officialDraft }">
              <svg class="conn-field-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.6 9.4a2.7 2.7 0 0 0 3.8 0l1.9-1.9a2.7 2.7 0 0 0-3.8-3.8l-1 1" /><path d="M9.4 6.6a2.7 2.7 0 0 0-3.8 0L3.7 8.5a2.7 2.7 0 0 0 3.8 3.8l1-1" /></svg>
              <input
                class="conn-input"
                type="url"
                :value="serverDraft"
                :disabled="officialDraft"
                :placeholder="officialDraft ? t('settings.officialPlaceholder') : 'https://notes.example.com'"
                :aria-label="t('settings.serverAddress')"
                autocomplete="url"
                @input="onServerInput"
              >
            </label>
            <label class="conn-check" :class="{ 'is-checked': officialDraft }">
              <input type="checkbox" :checked="officialDraft" @change="toggleOfficial">
              <span class="conn-box" aria-hidden="true" />
              {{ t('settings.useOfficial') }}
            </label>
            <button class="conn-save" type="button" :disabled="!serverDirty" @click="saveServer">{{ t('settings.save') }}</button>
          </div>
          <p v-if="serverError" class="conn-error" role="alert">
            <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.6" /><path d="M8 5.4v3.4M8 11h.01" /></svg>
            {{ serverError }}
          </p>
          <p v-else-if="serverSaved && !serverDirty" class="conn-hint" role="status">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.4 8.4 6.4 11.4 12.6 5.2" /></svg>
            {{ t('settings.saved') }}
          </p>
          <p v-else class="conn-hint">
            <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.6" /><path d="M8 7.3v3.3M8 5.2h.01" /></svg>
            {{ t('settings.reloginHint') }}
          </p>
        </section>

        <section class="settings-panel" aria-labelledby="settings-general-title">
          <div class="settings-panel-head">
            <span class="settings-panel-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16"><path d="M2.8 4.6h6.1M11.9 4.6h1.3M2.8 11.4h2.3M8.1 11.4h5.1" /><circle cx="10.4" cy="4.6" r="1.5" /><circle cx="6.6" cy="11.4" r="1.5" /></svg>
            </span>
            <h3 id="settings-general-title">{{ t('settings.general') }}</h3>
          </div>
          <div class="settings-preference-row settings-row-language">
            <div class="settings-preference-copy">
              <strong>{{ t('settings.language') }}</strong>
              <span>{{ t('settings.languageHint') }}</span>
            </div>
            <select class="settings-locale" :value="locale" :aria-label="t('settings.language')" @change="onLocale">
              <option v-for="option in LOCALE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
          <div class="settings-preference-row settings-row-theme">
            <div class="settings-preference-copy">
              <strong>{{ t('settings.theme') }}</strong>
              <span>{{ t('settings.themeHint') }}</span>
            </div>
            <div class="theme-choice" role="group" :aria-label="t('settings.theme')">
              <button
                v-for="option in themeOptions"
                :key="option.value"
                type="button"
                class="theme-choice-item"
                :aria-pressed="themeMode === option.value"
                @click="setThemeMode(option.value)"
              >{{ option.label }}</button>
            </div>
          </div>
          <div v-if="autostartSupported" class="settings-preference-row is-clickable" @click="toggleAutostart">
            <div class="settings-preference-copy">
              <strong>{{ t('settings.autostart') }}</strong>
              <span>{{ t('settings.autostartHint') }}</span>
            </div>
            <button class="settings-switch" :class="{ 'is-on': autostartEnabled }" type="button" role="switch" :aria-checked="autostartEnabled" :disabled="autostartLoading || autostartBusy || !autostartReady" :aria-label="t('settings.autostart')" @click.stop="toggleAutostart">
              <span />
            </button>
          </div>
          <p v-if="autostartError" class="dialog-error" role="alert">{{ autostartError }}</p>
        </section>

        <section class="settings-panel" aria-labelledby="settings-workspace-title">
          <div class="settings-panel-head">
            <span class="settings-panel-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16"><rect x="2.4" y="3" width="11.2" height="10" rx="1.8" /><path d="M6.4 3v10" /></svg>
            </span>
            <h3 id="settings-workspace-title">{{ t('settings.workspace') }}</h3>
          </div>
          <div class="settings-preference-list">
            <div class="settings-preference-row is-clickable" @click="emit('set-default-directory-visible', !props.defaultDirectoryVisible)">
              <div class="settings-preference-copy">
                <strong>{{ t('settings.showSidebar') }}</strong>
                <span>{{ t('settings.showSidebarHint') }}</span>
              </div>
              <button class="settings-switch" :class="{ 'is-on': props.defaultDirectoryVisible }" type="button" role="switch" :aria-checked="props.defaultDirectoryVisible" :aria-label="t('settings.showSidebar')" @click.stop="emit('set-default-directory-visible', !props.defaultDirectoryVisible)">
                <span />
              </button>
            </div>
            <div class="settings-preference-row is-clickable" @click="emit('set-default-tree-expanded', !props.defaultTreeExpanded)">
              <div class="settings-preference-copy">
                <strong>{{ t('settings.expandTree') }}</strong>
                <span>{{ t('settings.expandTreeHint') }}</span>
              </div>
              <button class="settings-switch" :class="{ 'is-on': props.defaultTreeExpanded }" type="button" role="switch" :aria-checked="props.defaultTreeExpanded" :aria-label="t('settings.expandTree')" @click.stop="emit('set-default-tree-expanded', !props.defaultTreeExpanded)">
                <span />
              </button>
            </div>
            <div class="settings-preference-row is-clickable" @click="emit('set-default-outline-visible', !props.defaultOutlineVisible)">
              <div class="settings-preference-copy">
                <strong>{{ t('settings.showOutline') }}</strong>
                <span>{{ t('settings.showOutlineHint') }}</span>
              </div>
              <button class="settings-switch" :class="{ 'is-on': props.defaultOutlineVisible }" type="button" role="switch" :aria-checked="props.defaultOutlineVisible" :aria-label="t('settings.showOutline')" @click.stop="emit('set-default-outline-visible', !props.defaultOutlineVisible)">
                <span />
              </button>
            </div>
          </div>
        </section>
      </div>

      <footer class="settings-footer">
        <div class="about-app">
          <img :src="brandIcon" alt="" />
          <div>
            <strong>{{ t('app.title') }}<span class="about-tagline">{{ t('app.tagline') }}</span></strong>
            <span class="about-meta">
              {{ t('settings.version', { version }) }}
              <button class="update-check" type="button" :disabled="updateChecking" @click="emit('check-update')">{{ updateLabel }}</button>
              <button v-if="releaseNotesAvailable" class="update-check" type="button" @click="emit('show-release-notes')">{{ t('settings.releaseNotes') }}</button>
            </span>
          </div>
        </div>
        <a class="project-link" href="https://github.com/zyw/v5notes" target="_blank" rel="noopener noreferrer" :aria-label="t('settings.projectHome')" @click="openProjectLink">
          github.com/zyw/v5notes
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4h9v9M16 4 8 12M14 11v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" /></svg>
        </a>
        <button class="primary" type="button" @click="finish">{{ t('settings.done') }}</button>
        <p v-if="linkError" class="dialog-error" role="alert">{{ linkError }}</p>
      </footer>
    </section>
  </div>
</template>
