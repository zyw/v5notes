<template>
  <el-drawer
    :model-value="modelValue"
    size="74%"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div v-if="space" class="drawer-title">
        <span class="title-name">{{ space.name }}</span>
        <el-tag size="small" type="info">{{ space.nickName || space.userName || space.userId }}</el-tag>
        <el-tag size="small" :type="space.overQuota ? 'danger' : 'success'">
          {{ formatBytes(space.usedBytes) }} / {{ formatBytes(space.quotaBytes) }}
        </el-tag>
      </div>
    </template>

    <el-tabs v-if="space" v-model="activeTab" @tab-change="onTabChange">
      <!-- 1. 绑定副本 -->
      <el-tab-pane :label="$t('vault.spaces.tabReplicas')" name="replicas">
        <el-table v-loading="replicaLoading" :data="replicas" class="data-table">
          <el-table-column :label="$t('vault.replicas.clientInfo')" prop="clientInfo" min-width="160" :show-overflow-tooltip="true" />
          <el-table-column :label="$t('vault.replicas.replicaId')" prop="replicaId" min-width="180" :show-overflow-tooltip="true" />
          <el-table-column :label="$t('vault.replicas.deviceId')" prop="deviceId" min-width="180" :show-overflow-tooltip="true" />
          <el-table-column :label="$t('vault.replicas.lastSeenAt')" width="165" align="center">
            <template #default="{ row }">{{ parseTime(row.lastSeenAt) }}</template>
          </el-table-column>
          <el-table-column :label="$t('vault.replicas.boundAt')" width="165" align="center">
            <template #default="{ row }">{{ parseTime(row.boundAt) }}</template>
          </el-table-column>
          <el-table-column :label="$t('common.operate')" width="84" align="center">
            <template #default="{ row }">
              <el-tooltip :content="$t('vault.replicas.kick')" placement="top">
                <el-button
                  v-hasPermi="['vault:replica:remove']"
                  link
                  type="danger"
                  icon="Delete"
                  :aria-label="$t('vault.replicas.kick')"
                  @click="handleKickReplica(row)"
                />
              </el-tooltip>
            </template>
          </el-table-column>
          <template #empty>
            <div class="empty-hint">{{ $t('common.noData') }}</div>
          </template>
        </el-table>
        <pagination
          v-show="replicaTotal > 0"
          :total="replicaTotal"
          v-model:page="replicaQuery.pageNum"
          v-model:limit="replicaQuery.pageSize"
          @pagination="loadReplicas"
        />
      </el-tab-pane>

      <!-- 2. 文件清单 -->
      <el-tab-pane :label="$t('vault.spaces.tabFiles')" name="files">
        <el-form :inline="true" class="tab-filter">
          <el-form-item>
            <el-input
              v-model="fileQuery.keyword"
              :placeholder="$t('vault.files.pathPh')"
              clearable
              style="width: 220px"
              @keyup.enter="searchFiles"
            />
          </el-form-item>
          <el-form-item>
            <el-select v-model="fileQuery.fileType" :placeholder="$t('vault.files.allTypes')" clearable style="width: 130px" @change="searchFiles">
              <el-option :label="$t('vault.files.typeNote')" value="note" />
              <el-option :label="$t('vault.files.typeAsset')" value="asset" />
              <el-option :label="$t('vault.files.typeConfig')" value="config" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-checkbox v-model="fileQuery.includeDeleted" @change="searchFiles">{{ $t('vault.files.includeDeleted') }}</el-checkbox>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="searchFiles">{{ $t('common.search') }}</el-button>
          </el-form-item>
        </el-form>

        <el-table v-loading="fileLoading" :data="files" class="data-table">
          <el-table-column :label="$t('vault.files.path')" prop="path" min-width="220" :show-overflow-tooltip="true" />
          <el-table-column :label="$t('vault.files.type')" width="84" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="fileTypeTag(row.fileType)">{{ fileTypeLabel(row.fileType) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="$t('vault.files.size')" width="100" align="right">
            <template #default="{ row }">{{ formatBytes(row.sizeBytes) }}</template>
          </el-table-column>
          <el-table-column :label="$t('vault.files.rev')" prop="rev" width="76" align="center" />
          <el-table-column :label="$t('vault.files.state')" width="84" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="row.deleted ? 'info' : 'success'">
                {{ row.deleted ? $t('vault.files.stateDeleted') : $t('vault.files.stateLive') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="$t('common.updateTime')" width="165" align="center">
            <template #default="{ row }">{{ parseTime(row.updateTime) }}</template>
          </el-table-column>
          <el-table-column :label="$t('common.operate')" width="96" align="center">
            <template #default="{ row }">
              <el-tooltip :content="$t('vault.files.preview')" placement="top">
                <el-button
                  v-hasPermi="['vault:file:content']"
                  link
                  type="primary"
                  icon="View"
                  :aria-label="$t('vault.files.preview')"
                  @click="openPreview(row)"
                />
              </el-tooltip>
              <el-tooltip v-if="!row.deleted" :content="$t('vault.files.tombstoneDelete')" placement="top">
                <el-button
                  v-hasPermi="['vault:file:remove']"
                  link
                  type="danger"
                  icon="Delete"
                  :aria-label="$t('vault.files.tombstoneDelete')"
                  @click="handleDeleteFile(row)"
                />
              </el-tooltip>
            </template>
          </el-table-column>
          <template #empty>
            <div class="empty-hint">{{ $t('common.noData') }}</div>
          </template>
        </el-table>
        <pagination
          v-show="fileTotal > 0"
          :total="fileTotal"
          v-model:page="fileQuery.pageNum"
          v-model:limit="fileQuery.pageSize"
          @pagination="loadFiles"
        />
      </el-tab-pane>

      <!-- 3. 附件引用 -->
      <el-tab-pane :label="$t('vault.spaces.tabAssets')" name="assets">
        <el-form :inline="true" class="tab-filter">
          <el-form-item>
            <el-input
              v-model="assetQuery.keyword"
              :placeholder="$t('vault.files.hash')"
              clearable
              style="width: 240px"
              @keyup.enter="searchAssets"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="searchAssets">{{ $t('common.search') }}</el-button>
          </el-form-item>
        </el-form>

        <el-table v-loading="assetLoading" :data="assets" class="data-table">
          <el-table-column :label="$t('vault.files.hash')" prop="sha256" min-width="200" :show-overflow-tooltip="true" />
          <el-table-column :label="$t('vault.files.mimeType')" prop="mimeType" min-width="130" :show-overflow-tooltip="true" />
          <el-table-column :label="$t('vault.files.size')" width="100" align="right">
            <template #default="{ row }">{{ formatBytes(row.sizeBytes) }}</template>
          </el-table-column>
          <el-table-column :label="$t('vault.files.refCount')" prop="refCount" width="76" align="center" />
          <el-table-column :label="$t('vault.files.backend')" width="96" align="center">
            <template #default="{ row }">
              <el-tag size="small">{{ row.backend || '-' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="$t('vault.files.configId')" prop="configId" width="100" align="center" />
          <el-table-column :label="$t('common.operate')" width="76" align="center">
            <template #default="{ row }">
              <el-tooltip :content="$t('vault.files.downloadAsset')" placement="top">
                <el-button
                  v-hasPermi="['vault:file:content']"
                  link
                  type="primary"
                  icon="Download"
                  :aria-label="$t('vault.files.downloadAsset')"
                  @click="handleDownloadAsset(row)"
                />
              </el-tooltip>
            </template>
          </el-table-column>
          <template #empty>
            <div class="empty-hint">{{ $t('common.noData') }}</div>
          </template>
        </el-table>
        <pagination
          v-show="assetTotal > 0"
          :total="assetTotal"
          v-model:page="assetQuery.pageNum"
          v-model:limit="assetQuery.pageSize"
          @pagination="loadAssets"
        />
      </el-tab-pane>

      <!-- 4. 变更日志 -->
      <el-tab-pane :label="$t('vault.spaces.tabChanges')" name="changes">
        <el-form :inline="true" class="tab-filter">
          <el-form-item>
            <el-select v-model="changeQuery.op" :placeholder="$t('vault.changes.allOps')" clearable style="width: 130px" @change="searchChanges">
              <el-option :label="$t('vault.overview.opUpsert')" value="upsert" />
              <el-option :label="$t('vault.overview.opDelete')" value="delete" />
              <el-option :label="$t('vault.overview.opRename')" value="rename" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-input
              v-model="changeQuery.keyword"
              :placeholder="$t('vault.files.pathPh')"
              clearable
              style="width: 220px"
              @keyup.enter="searchChanges"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="searchChanges">{{ $t('common.search') }}</el-button>
          </el-form-item>
        </el-form>

        <el-table v-loading="changeLoading" :data="changes" class="data-table">
          <el-table-column :label="$t('vault.changes.cursor')" prop="cursor" width="175" :show-overflow-tooltip="true" />
          <el-table-column :label="$t('vault.changes.op')" width="96" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="opTag(row.op)">{{ row.op }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="$t('vault.changes.path')" prop="path" min-width="200" :show-overflow-tooltip="true" />
          <el-table-column :label="$t('vault.changes.fromPath')" prop="fromPath" min-width="150" :show-overflow-tooltip="true">
            <template #default="{ row }">{{ row.fromPath || '-' }}</template>
          </el-table-column>
          <el-table-column :label="$t('vault.changes.rev')" prop="remoteRev" width="76" align="center" />
          <el-table-column :label="$t('vault.changes.size')" width="96" align="right">
            <template #default="{ row }">{{ row.sizeBytes != null ? formatBytes(row.sizeBytes) : '-' }}</template>
          </el-table-column>
          <el-table-column :label="$t('vault.changes.time')" width="165" align="center">
            <template #default="{ row }">{{ parseTime(row.createTime) }}</template>
          </el-table-column>
          <template #empty>
            <div class="empty-hint">{{ $t('common.noData') }}</div>
          </template>
        </el-table>
        <pagination
          v-show="changeTotal > 0"
          :total="changeTotal"
          v-model:page="changeQuery.pageNum"
          v-model:limit="changeQuery.pageSize"
          @pagination="loadChanges"
        />
      </el-tab-pane>
    </el-tabs>

    <file-preview-dialog
      v-model="previewOpen"
      :vault-id="space?.vaultId || ''"
      :file-id="previewFileId"
    />
  </el-drawer>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { kickVaultReplica, listVaultReplicas } from '@/api/vault/replicas';
import type { VaultAdminReplica } from '@/api/vault/replicas/types';
import {
  downloadVaultAssetBlob,
  listVaultAssets,
  listVaultChanges,
  listVaultFiles,
  removeVaultFile
} from '@/api/vault/spaces';
import type {
  VaultAdminAsset,
  VaultAdminChange,
  VaultAdminFile,
  VaultAdminSpace
} from '@/api/vault/spaces/types';
import { parseTime } from '@/utils/ruoyi';
import FilePreviewDialog from './file-preview-dialog.vue';

const props = defineProps<{
  modelValue: boolean;
  space: VaultAdminSpace | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'changed'): void;
}>();

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const activeTab = ref('replicas');
const previewOpen = ref(false);
const previewFileId = ref('');

const replicaLoading = ref(false);
const replicas = ref<VaultAdminReplica[]>([]);
const replicaTotal = ref(0);
const replicaQuery = ref({ pageNum: 1, pageSize: 20 });

const fileLoading = ref(false);
const files = ref<VaultAdminFile[]>([]);
const fileTotal = ref(0);
const fileQuery = ref({ pageNum: 1, pageSize: 20, keyword: '', fileType: '', includeDeleted: false });

const assetLoading = ref(false);
const assets = ref<VaultAdminAsset[]>([]);
const assetTotal = ref(0);
const assetQuery = ref({ pageNum: 1, pageSize: 20, keyword: '' });

const changeLoading = ref(false);
const changes = ref<VaultAdminChange[]>([]);
const changeTotal = ref(0);
const changeQuery = ref({ pageNum: 1, pageSize: 20, op: '', keyword: '' });

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

const fileTypeTag = (type: string) => {
  if (type === 'asset') return 'warning';
  if (type === 'config') return 'info';
  return 'primary';
};

const fileTypeLabel = (type: string) => {
  if (type === 'asset') return t('vault.files.typeAsset');
  if (type === 'config') return t('vault.files.typeConfig');
  return t('vault.files.typeNote');
};

const opTag = (op: string) => {
  if (op === 'delete') return 'danger';
  if (op === 'rename') return 'warning';
  return 'success';
};

const loadReplicas = async () => {
  if (!props.space) return;
  replicaLoading.value = true;
  try {
    const res = await listVaultReplicas({ vaultId: props.space.vaultId, ...replicaQuery.value });
    replicas.value = res.data.rows || [];
    replicaTotal.value = res.data.total || 0;
  } finally {
    replicaLoading.value = false;
  }
};

const loadFiles = async () => {
  if (!props.space) return;
  fileLoading.value = true;
  try {
    const res = await listVaultFiles(props.space.vaultId, {
      pageNum: fileQuery.value.pageNum,
      pageSize: fileQuery.value.pageSize,
      keyword: fileQuery.value.keyword || undefined,
      fileType: fileQuery.value.fileType || undefined,
      includeDeleted: fileQuery.value.includeDeleted
    });
    files.value = res.data.rows || [];
    fileTotal.value = res.data.total || 0;
  } finally {
    fileLoading.value = false;
  }
};

const searchFiles = () => {
  fileQuery.value.pageNum = 1;
  loadFiles();
};

const loadAssets = async () => {
  if (!props.space) return;
  assetLoading.value = true;
  try {
    const res = await listVaultAssets(props.space.vaultId, {
      pageNum: assetQuery.value.pageNum,
      pageSize: assetQuery.value.pageSize,
      keyword: assetQuery.value.keyword || undefined
    });
    assets.value = res.data.rows || [];
    assetTotal.value = res.data.total || 0;
  } finally {
    assetLoading.value = false;
  }
};

const searchAssets = () => {
  assetQuery.value.pageNum = 1;
  loadAssets();
};

const loadChanges = async () => {
  if (!props.space) return;
  changeLoading.value = true;
  try {
    const res = await listVaultChanges(props.space.vaultId, {
      pageNum: changeQuery.value.pageNum,
      pageSize: changeQuery.value.pageSize,
      op: changeQuery.value.op || undefined,
      keyword: changeQuery.value.keyword || undefined
    });
    changes.value = res.data.rows || [];
    changeTotal.value = res.data.total || 0;
  } finally {
    changeLoading.value = false;
  }
};

const searchChanges = () => {
  changeQuery.value.pageNum = 1;
  loadChanges();
};

const onTabChange = (name: string | number) => {
  if (name === 'replicas') loadReplicas();
  else if (name === 'files') loadFiles();
  else if (name === 'assets') loadAssets();
  else if (name === 'changes') loadChanges();
};

const openPreview = (row: any) => {
  previewFileId.value = row.fileId;
  previewOpen.value = true;
};

const handleKickReplica = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      t('vault.replicas.kickConfirm', { name: row.clientInfo || row.replicaId }),
      t('common.warning'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        confirmButtonClass: 'el-button--danger',
        type: 'warning'
      }
    );
    await kickVaultReplica(row.id);
    proxy?.$modal.msgSuccess(t('vault.replicas.kickSuccess'));
    await loadReplicas();
    emit('changed');
  } catch {
    // cancelled
  }
};

const handleDeleteFile = async (row: any) => {
  if (!props.space) return;
  try {
    await ElMessageBox.confirm(t('vault.files.deleteConfirm', { path: row.path }), t('common.warning'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      confirmButtonClass: 'el-button--danger',
      type: 'warning'
    });
    await removeVaultFile(props.space.vaultId, row.fileId);
    proxy?.$modal.msgSuccess(t('vault.files.deleteSuccess'));
    await loadFiles();
    emit('changed');
  } catch {
    // cancelled
  }
};

const handleDownloadAsset = async (row: any) => {
  if (!props.space) return;
  const blob = (await downloadVaultAssetBlob(props.space.vaultId, row.assetId)) as unknown as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${row.assetId}`;
  a.click();
  URL.revokeObjectURL(url);
};

watch(
  () => [props.modelValue, props.space?.vaultId] as const,
  ([open, vaultId]) => {
    if (!open || !vaultId) return;
    activeTab.value = 'replicas';
    replicaQuery.value.pageNum = 1;
    fileQuery.value.pageNum = 1;
    assetQuery.value.pageNum = 1;
    changeQuery.value.pageNum = 1;
    loadReplicas();
  }
);
</script>

<style scoped lang="scss">
.drawer-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  .title-name {
    font-size: 16px;
    font-weight: 600;
  }
}

.tab-filter {
  margin-bottom: 8px;
}
</style>
