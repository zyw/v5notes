<template>
  <el-dialog
    :model-value="modelValue"
    :title="content?.path || $t('vault.files.previewTitle')"
    width="760px"
    append-to-body
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="loading" class="preview-body">
      <template v-if="content">
        <el-descriptions :column="2" border size="small" class="meta-desc">
          <el-descriptions-item :label="$t('vault.files.type')">{{ content.fileType }}</el-descriptions-item>
          <el-descriptions-item :label="$t('vault.files.rev')">{{ content.rev }}</el-descriptions-item>
          <el-descriptions-item :label="$t('vault.files.size')">{{ formatBytes(content.sizeBytes) }}</el-descriptions-item>
          <el-descriptions-item :label="$t('vault.files.state')">
            {{ content.deleted ? $t('vault.files.stateDeleted') : $t('vault.files.stateLive') }}
          </el-descriptions-item>
          <el-descriptions-item :label="$t('vault.files.hash')" :span="2">{{ content.contentHash || '-' }}</el-descriptions-item>
          <template v-if="content.fileType === 'asset'">
            <el-descriptions-item :label="$t('vault.files.mimeType')">{{ content.mimeType || '-' }}</el-descriptions-item>
            <el-descriptions-item :label="$t('vault.files.backend')">{{ content.backend || '-' }}</el-descriptions-item>
            <el-descriptions-item :label="$t('vault.files.configId')">{{ content.configId || '-' }}</el-descriptions-item>
            <el-descriptions-item :label="$t('vault.files.storageKey')">{{ content.storageKey || '-' }}</el-descriptions-item>
          </template>
        </el-descriptions>

        <div v-if="content.deleted" class="empty-state">{{ $t('vault.files.deletedNotice') }}</div>
        <div v-else-if="content.fileType === 'asset'" class="asset-actions">
          <el-button v-if="content.assetId" type="primary" icon="Download" @click="downloadAsset">
            {{ $t('vault.files.downloadAsset') }}
          </el-button>
        </div>
        <pre v-else class="code-box">{{ content.body || $t('vault.files.emptyBody') }}</pre>
      </template>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { downloadVaultAssetBlob, getVaultFileContent } from '@/api/vault/spaces';
import type { VaultAdminFileContent } from '@/api/vault/spaces/types';

const props = defineProps<{
  modelValue: boolean;
  vaultId: string;
  fileId: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const loading = ref(false);
const content = ref<VaultAdminFileContent | null>(null);

const formatBytes = (value?: number) => {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let idx = 0;
  while (v >= 1024 && idx < units.length - 1) {
    v /= 1024;
    idx += 1;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[idx]}`;
};

const load = async () => {
  if (!props.vaultId || !props.fileId) return;
  loading.value = true;
  content.value = null;
  try {
    const res = await getVaultFileContent(props.vaultId, props.fileId);
    content.value = res.data;
  } finally {
    loading.value = false;
  }
};

const downloadAsset = async () => {
  if (!content.value?.assetId) return;
  const blob = (await downloadVaultAssetBlob(props.vaultId, content.value.assetId)) as unknown as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const leaf = content.value.path.includes('/') ? content.value.path.slice(content.value.path.lastIndexOf('/') + 1) : content.value.path;
  a.href = url;
  a.download = leaf || content.value.assetId;
  a.click();
  URL.revokeObjectURL(url);
};

watch(
  () => [props.modelValue, props.vaultId, props.fileId] as const,
  ([open]) => {
    if (open) load();
  }
);
</script>

<style scoped lang="scss">
.preview-body {
  min-height: 160px;
}

.meta-desc {
  margin-bottom: 12px;
}

.code-box {
  margin: 0;
  padding: 12px;
  max-height: 460px;
  overflow: auto;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.asset-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.empty-state {
  padding: 20px;
  text-align: center;
  color: var(--el-text-color-secondary);
}
</style>
