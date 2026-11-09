<template>
  <div class="editor-container">
    <div class="note-title">
      <el-card shadow="hover">
        <div class="note-title-bar">
          <el-text size="large">
            <el-tooltip class="box-item" effect="dark" content="编辑笔记" placement="top">
              <el-link :icon="Edit" @click="handleEditNotes">&nbsp;{{ notesName }}</el-link>
            </el-tooltip>
          </el-text>
          <el-button v-hasPermi="['notes:notes:query']" :disabled="notesId == null" icon="Clock" @click="historyVisible = true">历史版本</el-button>
        </div>
      </el-card>
    </div>
    <note-history-drawer v-if="historyVisible" v-model="historyVisible" :note-id="notesId" :note-name="notesName" @restored="onHistoryRestored" />
    <div class="editor-wrapper">
      <div id="previewVditor" class="vditor preview-content"></div>
    </div>
  </div>
</template>

<script setup lang="ts" name="PreviewMd">
import { onMounted } from 'vue';
import { Edit } from '@element-plus/icons-vue';
import { ElLoading } from 'element-plus';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import { getNotes } from '@/api/notes/notes';
import NoteHistoryDrawer from '@/views/notes/notes/history-drawer.vue';

const notesId = ref<string | number>();
const notesName = ref('');
const notesContent = ref('');
const historyVisible = ref(false);

const emit = defineEmits(['editNotes']);

/** 预览笔记内容 */
const previewNotes = async (id: string | number) => {
  const loading = ElLoading.service({
    target: '.editor-container',
    lock: true,
    text: '加载中。。。'
  });
  try {
    const res = await getNotes(id);
    if (res.data) {
      notesName.value = res.data.name;
      notesId.value = res.data.id;
      notesContent.value = res.data.content ?? '';
    }
    const previewEl = document.getElementById('previewVditor') as HTMLDivElement;
    if (previewEl) {
      await Vditor.preview(previewEl, notesContent.value, {
        mode: 'light',
        anchor: 1
      });
    }
  } finally {
    loading.close();
  }
};

const handleEditNotes = () => {
  emit('editNotes', notesId.value);
};

const onHistoryRestored = () => {
  if (notesId.value != null) {
    previewNotes(notesId.value);
  }
};

defineExpose({ previewNotes });

onMounted(() => {});
</script>

<style scoped lang="scss">
.editor-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 100px);
  background: #fff;
  border-radius: 4px;

  .note-title {
    flex: none;
    margin-bottom: 12px;
  }

  .note-title-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .editor-wrapper {
    flex: 1;
    overflow: hidden;
  }

  .vditor {
    height: 100%;
    border: 1px solid #e4e7ed;
  }
}
</style>
