<template>
  <el-drawer v-model="visible" :title="title" size="760px" append-to-body class="note-history-drawer">
    <div v-loading="loading" class="history-layout">
      <aside class="history-list">
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
            <el-tag v-if="row.head" size="small" type="success">当前</el-tag>
          </span>
          <span class="history-item-excerpt">{{ row.excerpt || '（空正文）' }}</span>
          <span class="history-item-size">{{ formatSize(row.size) }}</span>
        </button>
        <el-button v-if="canLoadMore" class="history-more" text :loading="loading" @click="loadMore">加载更多</el-button>
      </aside>
      <section class="history-preview-pane">
        <div ref="previewEl" class="history-preview"></div>
        <div class="history-actions">
          <el-button
            v-hasPermi="['notes:notes:edit']"
            type="primary"
            :disabled="!selected || selected.head"
            :loading="restoring"
            @click="confirmRestore"
          >
            恢复此版本
          </el-button>
        </div>
      </section>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import { getNoteRevision, listNoteRevisions, restoreNoteRevision } from '@/api/notes/notes';
import type { NoteRevisionDetailVO, NoteRevisionVO } from '@/api/notes/notes/types';
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

const title = computed(() => (props.noteName ? `历史版本 · ${props.noteName}` : '历史版本'));
const canLoadMore = computed(() => rows.value.length < total.value);

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
  }
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
.history-layout {
  display: flex;
  gap: 16px;
  height: calc(100vh - 140px);
  min-height: 360px;
}

.history-list {
  flex: none;
  width: 240px;
  overflow: auto;
  border-right: 1px solid var(--el-border-color-lighter);
  padding-right: 12px;
}

.history-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  margin: 0 0 8px;
  padding: 10px 12px;
  text-align: left;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}

.history-item.is-active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.history-item-time {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.history-item-excerpt {
  font-size: 12px;
  line-height: 1.4;
  color: var(--el-text-color-regular);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.history-item-size {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.history-more {
  width: 100%;
}

.history-preview-pane {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.history-preview {
  flex: 1;
  overflow: auto;
  padding: 4px 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.history-actions {
  flex: none;
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
