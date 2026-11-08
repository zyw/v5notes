<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useWorkspaceContext } from '../hooks/workspaceContext'
import type { LibraryImage } from '../service/api'

const open = defineModel<boolean>({ default: false })
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

const selected = computed(() => images.value.find(image => image.id === selectedId.value) ?? null)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

watch(open, (visible) => {
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
    const page = await api.listMyImages(pageNum.value, name.value)
    images.value = page.rows
    total.value = page.total
    if (selectedId.value && !images.value.some(image => image.id === selectedId.value)) selectedId.value = ''
  } catch (cause) {
    images.value = []
    total.value = 0
    error.value = cause instanceof Error ? cause.message : '图片列表加载失败'
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
  if (!file.type.startsWith('image/')) {
    error.value = '请选择图片文件'
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
    else if (!error.value) error.value = '图片已上传，请在图库中重新选择'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '图片上传失败，请重试'
  } finally {
    uploading.value = false
  }
}

function confirmInsert(): void {
  if (!selected.value || uploading.value) return
  emit('insert', selected.value)
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" role="presentation" @click.self="close">
    <section ref="dialogRef" class="modal image-library" role="dialog" aria-modal="true" aria-labelledby="image-library-title" tabindex="-1" @keydown.esc.stop="close">
      <span class="eyebrow">IMAGE</span>
      <h2 id="image-library-title">选择图片</h2>
      <p>从图库中选择一张图片插入笔记。没有合适的图片时，先上传，再选择刚上传的图片。</p>
      <form class="image-library-search" @submit.prevent="search">
        <input v-model="name" type="search" aria-label="按文件名筛选" placeholder="按文件名筛选" :disabled="uploading" />
        <button type="submit" :disabled="loading || uploading">筛选</button>
        <label class="secondary-action image-library-upload" :class="{ disabled: uploading }">
          {{ uploading ? '正在上传…' : '上传图片' }}
          <input type="file" accept="image/*" :disabled="uploading" @change="upload" />
        </label>
      </form>
      <p v-if="error" class="dialog-error" role="alert">{{ error }}</p>
      <div class="image-library-body">
        <p v-if="loading" class="image-library-empty">正在加载图片…</p>
        <p v-else-if="images.length === 0" class="image-library-empty">图库里还没有图片。上传一张后，再选择它插入笔记。</p>
        <div v-else class="image-library-grid" role="listbox" aria-label="我的图片">
          <button v-for="image in images" :key="image.id" type="button" role="option" class="image-library-item" :class="{ 'is-selected': image.id === selectedId }" :aria-selected="image.id === selectedId" :title="image.name" @click="selectedId = image.id" @dblclick="selectedId = image.id; confirmInsert()">
            <img :src="image.url" :alt="image.name" />
            <span>{{ image.name }}</span>
          </button>
        </div>
      </div>
      <div v-if="total > pageSize" class="image-library-pager">
        <button type="button" :disabled="pageNum <= 1 || loading || uploading" @click="go(pageNum - 1)">上一页</button>
        <span>{{ pageNum }} / {{ pageCount }}</span>
        <button type="button" :disabled="pageNum >= pageCount || loading || uploading" @click="go(pageNum + 1)">下一页</button>
      </div>
      <div class="modal-actions">
        <button type="button" :disabled="uploading" @click="close">取消</button>
        <button class="primary" type="button" :disabled="!selected || uploading" @click="confirmInsert">插入</button>
      </div>
    </section>
  </div>
</template>
