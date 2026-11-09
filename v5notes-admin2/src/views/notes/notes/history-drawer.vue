<template>
  <FormDrawer
    v-model="visible"
    class="note-history-drawer"
    size="880px"
    :hint="hint"
  >
    <template #hero>
      <div class="drawer-hero">
        <div class="drawer-hero__top">
          <span class="drawer-hero__brand"><img :src="logoUrl" alt="" />V5Notes · 笔记</span>
          <span class="drawer-hero__divider">·</span>
          <span class="drawer-hero__action">历史版本</span>
        </div>
        <div class="drawer-hero__profile">
          <div class="drawer-hero__icon">{{ initial }}</div>
          <div class="drawer-hero__info">
            <div class="drawer-hero__name">{{ noteName || '未命名笔记' }}</div>
            <div class="drawer-hero__meta">
              <span class="drawer-hero__tag">最多保留 50 个版本</span>
              <span>{{ total }} 个版本</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-loading="loading" class="history-layout">
      <aside class="history-pane">
        <h4>版本列表</h4>
        <div class="history-list">
          <el-alert v-if="error" :title="error" type="error" :closable="false" />
          <el-empty v-else-if="!loading && rows.length === 0" description="还没有历史版本" />
          <button
            v-for="row in rows"
            :key="String(row.id)"
            type="button"
            class="history-item"
            :class="{ 'is-active': String(row.id) === String(selectedId) }"
            @click="select(row)"
          >
            <span class="history-item-time">
              {{ formatTime(row.createTime) }}
              <span v-if="row.head" class="history-item-tag">当前</span>
            </span>
            <span class="history-item-excerpt">{{ row.excerpt || '（空正文）' }}</span>
            <span class="history-item-size">{{ formatSize(row.size) }}</span>
          </button>
          <el-button v-if="canLoadMore" class="history-more" text :loading="loading" @click="loadMore">加载更多</el-button>
        </div>
      </aside>
      <section class="history-pane history-preview-pane">
        <h4>正文预览</h4>
        <div ref="previewEl" class="history-preview"></div>
      </section>
    </div>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-button
        v-hasPermi="['notes:notes:edit']"
        type="primary"
        :disabled="!selected || selected.head"
        :loading="restoring"
        @click="confirmRestore"
      >
        恢复此版本
      </el-button>
    </template>
  </FormDrawer>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import { getNoteRevision, listNoteRevisions, restoreNoteRevision } from '@/api/notes/notes';
import type { NoteRevisionDetailVO, NoteRevisionVO } from '@/api/notes/notes/types';
import FormDrawer from '@/components/FormDrawer/index.vue';
import logoUrl from '@/assets/logo/logo.png';
import { isHandledRequestError } from '@/utils/request';

const props = defineProps<{
  modelValue: boolean;
  noteId?: string | number;
  noteName?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  restored: [];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
});

const rows = ref<NoteRevisionVO[]>([]);
const total = ref(0);
const page = ref(1);
const selectedId = ref<string | number>();
const selected = ref<NoteRevisionDetailVO | null>(null);
const loading = ref(false);
const restoring = ref(false);
const error = ref('');
const previewEl = ref<HTMLDivElement>();
const pageSize = 20;
let loadSeq = 0;

const initial = computed(() => (props.noteName || '笔').trim().slice(0, 1) || '笔');
const canLoadMore = computed(() => rows.value.length < total.value);
const hint = computed(() => {
  if (selected.value?.head) {
    return '这是当前正文';
  }
  if (selected.value) {
    return '恢复前的正文会先记入历史，编辑区里尚未保存的修改会被替换';
  }
  return '选择一个版本查看正文';
});

watch(
  () => props.modelValue,
  (open) => {
    if (!open) {
      rows.value = [];
      selected.value = null;
      selectedId.value = undefined;
      error.value = '';
      page.value = 1;
      return;
    }
    void load(true);
  },
  { immediate: true }
);

async function load(reset: boolean) {
  if (props.noteId == null || props.noteId === '') {
    return;
  }
  loading.value = true;
  error.value = '';
  const pageNum = reset ? 1 : page.value;
  const seq = ++loadSeq;
  try {
    const res = await listNoteRevisions(props.noteId, { pageNum, pageSize });
    if (seq !== loadSeq || !props.modelValue) {
      return;
    }
    const incoming = res.data?.rows ?? [];
    rows.value = reset ? incoming : [...rows.value, ...incoming];
    total.value = res.data?.total ?? rows.value.length;
    if (reset) {
      page.value = 1;
      selected.value = null;
      selectedId.value = undefined;
      if (incoming[0]) {
        await select(incoming[0], seq);
      }
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '历史加载失败';
  } finally {
    loading.value = false;
  }
}

async function select(row: NoteRevisionVO, seq = loadSeq) {
  if (props.noteId == null) {
    return;
  }
  selectedId.value = row.id;
  try {
    const res = await getNoteRevision(props.noteId, row.id);
    if (seq !== loadSeq || !props.modelValue) {
      return;
    }
    selected.value = { ...res.data, head: row.head };
    error.value = '';
    await renderPreview(selected.value.content ?? '');
  } catch (cause) {
    if (!isHandledRequestError(cause)) {
      error.value = cause instanceof Error ? cause.message : '版本读取失败';
    }
  }
}

async function renderPreview(content: string) {
  await nextTick();
  const el = previewEl.value;
  if (!el) {
    return;
  }
  el.innerHTML = '';
  await Vditor.preview(el, content, {
    mode: 'light',
    anchor: 1
  });
}

async function loadMore() {
  page.value += 1;
  await load(false);
}

async function confirmRestore() {
  if (props.noteId == null || !selected.value || selected.value.head || restoring.value) {
    return;
  }
  try {
    await ElMessageBox.confirm(
      '恢复后，这一版会成为当前正文。恢复前的正文会先记入历史，最多保留 50 个版本。编辑区里尚未保存的修改会被替换。',
      '恢复历史版本',
      { type: 'warning', confirmButtonText: '恢复', cancelButtonText: '取消' }
    );
  } catch {
    return;
  }
  restoring.value = true;
  try {
    await restoreNoteRevision(props.noteId, selected.value.id);
    ElMessage.success('已恢复为该版本');
    visible.value = false;
    emit('restored');
  } catch (cause) {
    if (!isHandledRequestError(cause)) {
      ElMessage.error(cause instanceof Error ? cause.message : '恢复失败');
    }
  } finally {
    restoring.value = false;
  }
}

function formatTime(value?: string) {
  if (!value) {
    return '';
  }
  return String(value).replace('T', ' ').slice(0, 19);
}

function formatSize(size?: number) {
  const value = size ?? 0;
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(value >= 10 * 1024 ? 0 : 1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
</script>

<style scoped lang="scss">
.note-history-drawer {
  :deep(.fd-body) {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 18px 22px 16px;
    overflow: hidden;
  }
}

.drawer-hero {
  position: relative;
  overflow: hidden;
  padding: 24px 28px 24px;
  color: #fff;
  background: linear-gradient(148deg, #0f3d33 0%, #1c5a48 70%, #256a55 100%);
}

.drawer-hero::after {
  content: '';
  position: absolute;
  top: -130px;
  right: -90px;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
}

.drawer-hero__top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 44px;
  font-size: 12px;
  font-weight: 700;
  color: #dff1e8;
  letter-spacing: 0.02em;
}

.drawer-hero__brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.drawer-hero__brand img {
  width: 22px;
  height: 22px;
  border-radius: 6px;
}

.drawer-hero__divider {
  color: rgba(223, 241, 232, 0.5);
}

.drawer-hero__action {
  color: #c9e4d7;
}

.drawer-hero__profile {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 15px;
  margin-top: 22px;
}

.drawer-hero__icon {
  width: 58px;
  height: 58px;
  flex: none;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.16);
  font-size: 22px;
  font-weight: 700;
  color: #fff;
}

.drawer-hero__name {
  margin-bottom: 7px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.drawer-hero__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #c9e4d7;
}

.drawer-hero__tag {
  padding: 4px 9px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  color: #eafff5;
  font-size: 11.5px;
  font-weight: 700;
}

.history-layout {
  display: flex;
  flex: 1;
  gap: 18px;
  min-height: 0;
}

.history-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.history-pane h4 {
  flex: none;
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #6b7d74;
}

.history-list {
  flex: 1;
  width: 248px;
  overflow: auto;
  padding-right: 2px;
}

.history-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  margin: 0 0 8px;
  padding: 12px 14px;
  text-align: left;
  border: 1px solid #e8ecea;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
}

.history-item.is-active {
  border-color: #1c5a48;
  background: #f3faf6;
}

.history-item-time {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #15241e;
}

.history-item-tag {
  padding: 2px 8px;
  border-radius: 999px;
  background: #e7f5ee;
  color: #1c5a48;
  font-size: 11px;
  font-weight: 700;
}

.history-item-excerpt {
  font-size: 12px;
  line-height: 1.45;
  color: #5f7067;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.history-item-size {
  font-size: 12px;
  color: #8a978f;
}

.history-more {
  width: 100%;
}

.history-preview-pane {
  flex: 1;
  min-width: 0;
}

.history-preview {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px 16px;
  border: 1px solid #e8ecea;
  border-radius: 12px;
  background: #fff;
}
</style>
