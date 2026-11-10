<template>
  <div class="editor-container">
    <div class="note-title">
      <el-card shadow="hover">
        <div class="note-title-bar">
          <el-text size="large">
            <el-tooltip class="box-item" effect="dark" :content="$t('notes.editor.saveTooltip')" placement="top">
              <el-link :icon="MessageBox" @click="handleSaveContent">&nbsp;{{ mdEditorForm?.name }}</el-link>
            </el-tooltip>
          </el-text>
          <el-button v-hasPermi="['notes:notes:query']" :disabled="mdEditorForm?.id == null" icon="Clock" @click="historyVisible = true">{{ $t('notes.history.title') }}</el-button>
        </div>
      </el-card>
    </div>
    <note-history-drawer v-if="historyVisible" v-model="historyVisible" :note-id="mdEditorForm?.id" :note-name="mdEditorForm?.name" @restored="onHistoryRestored" />
    <div class="editor-wrapper">
      <div id="contentVditor" class="vditor"></div>
    </div>
  </div>
</template>

<script setup lang="ts" name="EditorMd">
import { onBeforeUnmount, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { MessageBox } from '@element-plus/icons-vue';
import { ElLoading, ElMessage } from 'element-plus';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import { getNotes, updateNotes } from '@/api/notes/notes';
import type { NotesForm } from '@/api/notes/notes/types';
import NoteHistoryDrawer from '@/views/notes/notes/history-drawer.vue';
import modal from '@/plugins/modal';
import { getToken } from '@/utils/auth';

const { t, locale } = useI18n();

const vditorLang = () => {
  if (locale.value === 'zh_TW' || locale.value === 'en_US') {
    return locale.value;
  }
  return 'zh_CN' as const;
};

const saveSvg =
  '<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M853.3 298.7l-128-128c-12.8-12.8-29.9-21.4-49.1-21.4H213.3C172.8 149.3 149.3 172.8 149.3 213.3v597.4c0 40.5 23.5 64 64 64h597.4c40.5 0 64-23.5 64-64V341.3c0-19.2-8.6-36.3-21.4-42.6zM512 810.7c-64 0-115.2-51.2-115.2-115.2S448 580.3 512 580.3s115.2 51.2 115.2 115.2S576 810.7 512 810.7zM640 362.7H256V256h384v106.7z" fill="#E16B5A"/></svg>';

const vditor = ref<Vditor>();
const mdEditorForm = ref<NotesForm>();
const historyVisible = ref(false);

/** 保存笔记内容 */
const handleSaveContent = async () => {
  if (!vditor.value || !mdEditorForm.value) {
    return;
  }
  mdEditorForm.value.content = vditor.value.getValue();
  await updateNotes(mdEditorForm.value);
  modal.msgSuccess(t('notes.editor.saved'));
};

// 编辑器配置项
const buildOptions = (): IOptions => ({
  height: '100%',
  mode: 'ir',
  theme: 'classic',
  lang: vditorLang(),
  toolbar: [
    {
      hotkey: '⌘S',
      name: 'save-md',
      tipPosition: 's',
      tip: t('notes.editor.saveTip'),
      className: 'save-btn',
      icon: saveSvg,
      click: handleSaveContent
    },
    '|',
    'emoji',
    'headings',
    'bold',
    'italic',
    'strike',
    'link',
    '|',
    'list',
    'ordered-list',
    'check',
    'outdent',
    'indent',
    '|',
    'quote',
    'line',
    'code',
    'inline-code',
    'insert-before',
    'insert-after',
    '|',
    'upload',
    'table',
    '|',
    'undo',
    'redo',
    '|',
    'fullscreen',
    'preview',
    'outline',
    'edit-mode',
    'export'
  ],
  outline: {
    enable: true,
    position: 'right'
  },
  cache: {
    enable: false
  },
  blur(md: string) {
    if (mdEditorForm.value != null) {
      mdEditorForm.value.content = md;
    }
  },
  upload: {
    accept: 'image/*,.mp3, .mp4, .rar, .zip',
    headers: {
      Authorization: 'Bearer ' + getToken(),
      clientid: import.meta.env.VITE_APP_CLIENT_ID
    },
    url: import.meta.env.VITE_APP_BASE_API + '/basics/base/file',
    linkToImgUrl: import.meta.env.VITE_APP_BASE_API + '/basics/base/file',
    filename(name: string) {
      return name
        .replace(/[^(a-zA-Z0-9\u4e00-\u9fa5.)]/g, '')
        .replace(/[?\\/:|<>*[\]()$%{}@~]/g, '')
        .replace(/\s/g, '');
    },
    linkToImgCallback(responseText: string) {
      console.log(responseText, 'linkToImgCallback====');
    },
    linkToImgFormat(responseText: string): string {
      const resJson = JSON.parse(responseText);

      const respJson = {
        msg: resJson.msg,
        code: 0,
        data: {
          originalURL: '',
          url: resJson.data.url
        }
      };

      return JSON.stringify(respJson);
    },
    format(files: File[], responseText: string): string {
      const resJson = JSON.parse(responseText);

      const msg = resJson.msg;
      const code = resJson.code;

      const respJson = {
        msg: msg,
        code: 0,
        data: {
          errFiles: [],
          succMap: {
            [files[0].name]: resJson.data?.url
          }
        }
      };

      if (code !== 200) {
        ElMessage.error(msg);
        respJson.code = code;
        return JSON.stringify(respJson);
      }

      return JSON.stringify(respJson);
    },
    error(msg: string) {
      ElMessage.error(msg);
    }
  },
  after: () => {
    // 编辑器初始化完成后的回调
    vditor.value?.focus();
  }
});

const initEditor = () => {
  vditor.value = new Vditor('contentVditor', buildOptions());
};

/** 载入笔记内容用于编辑 */
const notesInfo = async (id: string | number) => {
  const loading = ElLoading.service({
    target: '.editor-container',
    lock: true,
    text: t('notes.editor.loading')
  });
  try {
    const res = await getNotes(id);
    mdEditorForm.value = res.data;
    const content = res.data?.content ?? '';
    vditor.value?.setValue(content);
  } finally {
    loading.close();
  }
};

// Ctrl/Cmd + S 保存
const handleKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    handleSaveContent();
  }
};

const onHistoryRestored = () => {
  if (mdEditorForm.value?.id != null) {
    notesInfo(mdEditorForm.value.id);
  }
};

defineExpose({ notesInfo });

onMounted(() => {
  initEditor();
  window.addEventListener('keydown', handleKeydown);
});

watch(locale, () => {
  const content = vditor.value?.getValue();
  vditor.value?.destroy();
  initEditor();
  if (content != null) {
    vditor.value?.setValue(content);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  vditor.value?.destroy();
});
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
  }
}
</style>
