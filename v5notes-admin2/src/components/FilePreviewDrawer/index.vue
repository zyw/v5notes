<template>
  <FormDrawer
    v-model="visible"
    class="file-preview-drawer"
    size="880px"
    :title="title"
    :subtitle="subtitle"
    :eyebrow="$t('file.preview.eyebrow')"
  >
    <div v-loading="loading" class="preview-body">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="preview-alert" />

      <template v-else-if="!loading && kind === 'image'">
        <div class="preview-image-wrap">
          <img v-if="objectUrl" :src="objectUrl" :alt="fileName" class="preview-image" />
        </div>
      </template>

      <template v-else-if="!loading && kind === 'text'">
        <div v-if="textContent.length" class="preview-text">
          <pre class="preview-text__gutter" aria-hidden="true">{{ textGutter }}</pre>
          <pre class="preview-text__code">{{ textContent }}</pre>
        </div>
        <el-empty v-else :description="$t('file.preview.emptyText')" />
      </template>

      <template v-else-if="!loading && kind === 'viewer' && previewFile">
        <div class="preview-viewer">
          <file-viewer :file="previewFile" :options="viewerOptions" />
        </div>
      </template>

      <el-empty
        v-else-if="!loading && kind === 'unsupported'"
        :description="$t('file.preview.unsupported')"
      />
    </div>

    <template #footer>
      <el-button @click="visible = false">{{ $t('common.close') }}</el-button>
      <el-button v-if="fileId" type="primary" @click="emit('download')">{{ $t('common.download') }}</el-button>
    </template>
  </FormDrawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { FileViewer } from '@file-viewer/vue3';
import officePreset from '@file-viewer/preset-office';
import { archiveRenderer } from '@file-viewer/renderer-archive';
import '@file-viewer/vue3/dist/file-viewer3.css';
import FormDrawer from '@/components/FormDrawer/index.vue';
import { globalHeaders } from '@/utils/request';
import { normalizeSuffix, resolvePreviewKind, type FilePreviewKind } from '@/utils/filePreview';

const { t } = useI18n();

defineOptions({
  components: { FileViewer }
});

const props = defineProps<{
  modelValue: boolean;
  fileId?: string | number;
  fileName?: string;
  suffix?: string;
  /** 公网可访问 URL；鉴权失败时可作兜底 */
  url?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  download: [];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
});

const loading = ref(false);
const error = ref('');
const kind = ref<FilePreviewKind>('unsupported');
const objectUrl = ref('');
const textContent = ref('');
const textGutter = ref('');
const previewFile = ref<File | null>(null);

const viewerOptions = {
  preset: officePreset,
  renderers: [archiveRenderer],
  rendererMode: 'replace' as const,
  theme: 'light' as const,
  toolbar: { position: 'bottom-right' as const, zoom: true }
};

const fileName = computed(() => props.fileName || t('file.preview.unnamed'));
const title = computed(() => fileName.value);
const subtitle = computed(() => {
  const ext = normalizeSuffix(props.suffix, props.fileName);
  return ext ? `.${ext}` : t('file.preview.hint');
});

const revokeObjectUrl = () => {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = '';
  }
};

const resetState = () => {
  loading.value = false;
  error.value = '';
  kind.value = 'unsupported';
  textContent.value = '';
  textGutter.value = '';
  previewFile.value = null;
  revokeObjectUrl();
};

const buildTextGutter = (text: string) => {
  const lines = text.length ? text.split('\n').length : 0;
  if (!lines) return '';
  let gutter = '';
  for (let i = 1; i <= lines; i++) {
    gutter += (i === 1 ? '' : '\n') + i;
  }
  return gutter;
};

const parseApiError = async (blob: Blob): Promise<string | null> => {
  try {
    const json = JSON.parse(await blob.text());
    if (json && typeof json === 'object' && 'code' in json && Number(json.code) !== 200) {
      return String(json.msg || t('file.preview.loadFail'));
    }
  } catch {
    /* 非 JSON 业务错误体 */
  }
  return null;
};

const fetchBlob = async (id: string | number): Promise<Blob> => {
  const baseURL = import.meta.env.VITE_APP_BASE_API as string;
  const response = await fetch(`${baseURL}/basics/admin/file/download/${id}`, {
    headers: globalHeaders()
  });
  const blob = await response.blob();
  if (!response.ok) {
    throw new Error((await parseApiError(blob)) || t('file.preview.loadFail'));
  }
  // 鉴权失败等场景可能仍返回 200 + JSON 业务体
  if ((blob.type || '').includes('application/json') && blob.size < 4096) {
    const clone = blob.slice(0);
    const apiError = await parseApiError(clone);
    if (apiError) throw new Error(apiError);
  }
  return blob;
};

const loadPreview = async () => {
  resetState();
  if (!props.fileId) {
    error.value = t('file.preview.missingId');
    return;
  }

  kind.value = resolvePreviewKind(props.suffix, props.fileName);
  if (kind.value === 'unsupported') {
    return;
  }

  loading.value = true;
  try {
    const blob = await fetchBlob(props.fileId);
    const ext = normalizeSuffix(props.suffix, props.fileName);
    const safeName = props.fileName || `preview.${ext || 'bin'}`;

    if (kind.value === 'image') {
      objectUrl.value = URL.createObjectURL(blob);
      return;
    }

    if (kind.value === 'text') {
      const text = (await blob.text()).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      textContent.value = text;
      textGutter.value = buildTextGutter(text);
      return;
    }

    // Office / PDF / ZIP → File Viewer（带扩展名的 File，便于格式识别）
    previewFile.value = new File([blob], safeName, {
      type: blob.type || 'application/octet-stream'
    });
  } catch (e: any) {
    // 图片可尝试直接用公网 url
    if (kind.value === 'image' && props.url) {
      objectUrl.value = props.url;
      error.value = '';
      return;
    }
    error.value = e?.message || t('file.preview.loadFail');
  } finally {
    loading.value = false;
  }
};

watch(
  () => [props.modelValue, props.fileId] as const,
  ([open]) => {
    if (open) {
      void loadPreview();
    } else {
      resetState();
    }
  }
);
</script>

<style scoped lang="scss">
/* 外层抽屉 body 禁止滚动，避免与预览内容双滚动条 */
:deep(.fd-body) {
  display: flex;
  flex-direction: column;
  overflow: hidden !important;
  padding: 16px 18px;
  min-height: 0;
}

.preview-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-alert {
  flex: none;
  margin-bottom: 12px;
}

.preview-image-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  overflow: hidden;
  background: #f3f5f4;
  border-radius: 12px;
}

.preview-image {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 61, 51, 0.08);
}

.preview-text {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  overflow: auto;
  border: 1px solid #e8ecea;
  border-radius: 12px;
  background: #fff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12.5px;
  line-height: 1.55;
}

.preview-text__gutter {
  margin: 0;
  padding: 12px 10px;
  min-width: 48px;
  text-align: right;
  color: #9aa59e;
  user-select: none;
  border-right: 1px solid #eef1ef;
  background: #f8faf9;
  white-space: pre;
}

.preview-text__code {
  margin: 0;
  padding: 12px 14px;
  min-width: 0;
  white-space: pre;
  color: #1f2937;
  overflow: visible;
}

.preview-viewer {
  flex: 1;
  min-height: 0;
  height: 100%;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e8ecea;
}

.preview-viewer :deep(file-viewer),
.preview-viewer :deep(.flyfish-file-viewer),
.preview-viewer :deep([class*='file-viewer']) {
  display: block;
  height: 100% !important;
  min-height: 0 !important;
  max-height: 100%;
}

.preview-body :deep(.el-empty) {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
