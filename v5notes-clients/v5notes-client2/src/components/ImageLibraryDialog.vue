<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkspaceContext } from '../hooks/workspaceContext'
import type { LibraryImage, MediaKind } from '../service/api'

const VIDEO_EXTS = new Set(['.mp4', '.m4v', '.webm', '.ogv', '.ogg', '.mov'])
const AUDIO_EXTS = new Set(['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.oga', '.opus', '.flac', '.webm'])
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.avif', '.ico'])

function extensionOfName(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 && dot < fileName.length - 1 ? fileName.slice(dot).toLowerCase() : ''
}

function isAcceptedFile(file: File, kind: MediaKind): boolean {
  const type = file.type.toLowerCase()
  const ext = extensionOfName(file.name)
  if (kind === 'video') {
    return type.startsWith('video/') || type === 'application/ogg' || VIDEO_EXTS.has(ext)
  }
  if (kind === 'audio') {
    return type.startsWith('audio/') || type === 'application/ogg' || AUDIO_EXTS.has(ext)
  }
  return type.startsWith('image/') || IMAGE_EXTS.has(ext)
}

const { t } = useI18n()
const open = defineModel<boolean>({ default: false })
const props = withDefaults(defineProps<{ kind?: MediaKind }>(), { kind: 'image' })
const emit = defineEmits<{ insert: [image: LibraryImage] }>()
const { api } = useWorkspaceContext()
const pageSize = 24
const dialogRef = ref<HTMLElement | null>(null)
const pageNum = ref(1)
const total = ref(0)
const images = ref<LibraryImage[]>([])
const name = ref('')
const selectedId = ref('')
const loading = ref(false)
const uploading = ref(false)
const error = ref('')

const copyScope = computed(() =>
  props.kind === 'video' ? 'videos' : props.kind === 'audio' ? 'audios' : 'images',
)
const eyebrow = computed(() =>
  props.kind === 'video' ? 'VIDEO' : props.kind === 'audio' ? 'AUDIO' : 'IMAGE',
)
const acceptAttr = computed(() => {
  if (props.kind === 'video') return 'video/*,.mp4,.m4v,.webm,.ogv,.ogg,.mov'
  if (props.kind === 'audio') return 'audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac,.webm'
  return 'image/*'
})
const selected = computed(() => images.value.find(image => image.id === selectedId.value) ?? null)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

watch([open, () => props.kind], ([visible]) => {
  if (!visible) return
  pageNum.value = 1
  name.value = ''
  selectedId.value = ''
  error.value = ''
  void load()
  void nextTick(() => dialogRef.value?.focus())
})

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const page = await api.listMyMedia(props.kind, pageNum.value, name.value)
    images.value = page.rows
    total.value = page.total
    if (selectedId.value && !images.value.some(image => image.id === selectedId.value)) selectedId.value = ''
  } catch (cause) {
    images.value = []
    total.value = 0
    error.value = cause instanceof Error ? cause.message : t(`${copyScope.value}.loadFailed`)
  } finally {
    loading.value = false
  }
}

function close(): void {
  if (uploading.value) return
  open.value = false
}

function search(): void {
  pageNum.value = 1
  void load()
}

function go(page: number): void {
  pageNum.value = page
  void load()
}

async function upload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!isAcceptedFile(file, props.kind)) {
    error.value = props.kind === 'image' ? t('images.chooseImage') : t(`${copyScope.value}.chooseFile`)
    return
  }
  uploading.value = true
  error.value = ''
  try {
    const url = await api.upload(file)
    pageNum.value = 1
    name.value = ''
    await load()
    const uploaded = images.value.find(image => image.url === url)
    if (uploaded) selectedId.value = uploaded.id
    else if (!error.value) error.value = t(`${copyScope.value}.uploadedPickAgain`)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t(`${copyScope.value}.uploadFailed`)
  } finally {
    uploading.value = false
  }
}

function extensionLabel(fileName: string): string {
  const ext = extensionOfName(fileName).replace(/^\./, '').toUpperCase()
  return ext || (props.kind === 'audio' ? 'AUDIO' : 'VIDEO')
}

function confirmInsert(): void {
  if (!selected.value || uploading.value) return
  emit('insert', selected.value)
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" role="presentation" @click.self="close">
    <section ref="dialogRef" class="modal image-library" role="dialog" aria-modal="true" aria-labelledby="image-library-title" tabindex="-1" @keydown.esc.stop="close">
      <span class="eyebrow">{{ eyebrow }}</span>
      <h2 id="image-library-title">{{ t(`${copyScope}.title`) }}</h2>
      <p>{{ t(`${copyScope}.intro`) }}</p>
      <form class="image-library-search" @submit.prevent="search">
        <input v-model="name" type="search" :aria-label="t(`${copyScope}.filterLabel`)" :placeholder="t(`${copyScope}.filterLabel`)" :disabled="uploading" />
        <button type="submit" :disabled="loading || uploading">{{ t(`${copyScope}.filter`) }}</button>
        <label class="secondary-action image-library-upload" :class="{ disabled: uploading }">
          {{ uploading ? t(`${copyScope}.uploading`) : t(`${copyScope}.upload`) }}
          <input type="file" :accept="acceptAttr" :disabled="uploading" @change="upload" />
        </label>
      </form>
      <p v-if="error" class="dialog-error" role="alert">{{ error }}</p>
      <div class="image-library-body">
        <p v-if="loading" class="image-library-empty">{{ t(`${copyScope}.loading`) }}</p>
        <p v-else-if="images.length === 0" class="image-library-empty">{{ t(`${copyScope}.empty`) }}</p>
        <div v-else class="image-library-grid" role="listbox" :aria-label="t(`${copyScope}.list`)">
          <button v-for="item in images" :key="item.id" type="button" role="option" class="image-library-item" :class="{ 'is-selected': item.id === selectedId }" :aria-selected="item.id === selectedId" :title="item.name" @click="selectedId = item.id" @dblclick="selectedId = item.id; confirmInsert()">
            <img v-if="kind === 'image'" :src="item.url" :alt="item.name" />
            <div v-else-if="kind === 'video'" class="media-thumb media-thumb-video">
              <video :src="item.url" preload="metadata" muted playsinline />
              <span class="media-play-badge" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="12" height="12"><path d="M5 3.4v9.2L12.6 8 5 3.4Z" fill="currentColor" /></svg>
              </span>
            </div>
            <div v-else class="media-thumb media-thumb-audio">
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                <path d="M9 17.5V6.5l10-2v11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                <circle cx="6.8" cy="17.5" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6" />
                <circle cx="16.8" cy="15.5" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6" />
              </svg>
              <span class="media-ext-badge">{{ extensionLabel(item.name) }}</span>
            </div>
            <span>{{ item.name }}</span>
          </button>
        </div>
      </div>
      <audio
        v-if="kind === 'audio' && selected"
        class="media-preview-audio"
        :src="selected.url"
        controls
        preload="metadata"
      />
      <div v-if="total > pageSize" class="image-library-pager">
        <button type="button" :disabled="pageNum <= 1 || loading || uploading" @click="go(pageNum - 1)">{{ t(`${copyScope}.previous`) }}</button>
        <span>{{ pageNum }} / {{ pageCount }}</span>
        <button type="button" :disabled="pageNum >= pageCount || loading || uploading" @click="go(pageNum + 1)">{{ t(`${copyScope}.next`) }}</button>
      </div>
      <div class="modal-actions">
        <button type="button" :disabled="uploading" @click="close">{{ t('common.cancel') }}</button>
        <button class="primary" type="button" :disabled="!selected || uploading" @click="confirmInsert">{{ t(`${copyScope}.insert`) }}</button>
      </div>
    </section>
  </div>
</template>
