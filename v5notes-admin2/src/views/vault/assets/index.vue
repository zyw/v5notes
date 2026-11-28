<template>
  <div class="p-2">
    <div class="search-wrap">
      <el-card shadow="hover" class="search-panel" :class="{ 'is-collapsed': !showSearch }">
        <template #header>
          <div class="panel-heading search-panel-toggle" @click.stop="showSearch = !showSearch">
            <div>
              <span class="panel-kicker">{{ $t('vault.assets.kicker') }}</span>
              <h3>{{ $t('common.filter') }}</h3>
            </div>
          </div>
        </template>
        <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="query-form">
          <el-form-item :label="$t('vault.assets.keyword')" prop="keyword">
            <el-input
              v-model="queryParams.keyword"
              :placeholder="$t('vault.assets.keywordPh')"
              clearable
              style="width: 240px"
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item :label="$t('vault.assets.backend')" prop="backend">
            <el-select v-model="queryParams.backend" :placeholder="$t('vault.assets.allBackends')" clearable style="width: 140px">
              <el-option label="S3" value="s3" />
              <el-option label="FTP" value="ftp" />
              <el-option label="LOCAL" value="local" />
              <el-option label="SFTP" value="sftp" />
              <el-option label="DB" value="db" />
            </el-select>
          </el-form-item>
          <el-form-item :label="$t('vault.assets.mimeType')" prop="mimePrefix">
            <el-select v-model="queryParams.mimePrefix" :placeholder="$t('vault.assets.allMimeTypes')" clearable style="width: 140px">
              <el-option :label="$t('vault.assets.mimeImage')" value="image/" />
              <el-option :label="$t('vault.assets.mimePdf')" value="application/pdf" />
              <el-option :label="$t('vault.assets.mimeText')" value="text/" />
              <el-option :label="$t('vault.assets.mimeAudio')" value="audio/" />
              <el-option :label="$t('vault.assets.mimeVideo')" value="video/" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleQuery">{{ $t('common.search') }}</el-button>
            <el-button icon="Refresh" @click="resetQuery">{{ $t('common.reset') }}</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>

    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="panel-kicker">{{ $t('vault.assets.kicker') }}</span>
            <h3>{{ $t('vault.assets.title') }}</h3>
          </div>
          <div class="toolbar-actions">
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList" />
          </div>
        </div>
      </template>

      <error-state v-if="errorInfo" :kind="errorInfo.kind" :title="errorInfo.title" :message="errorInfo.message" @retry="getList" />
      <el-table v-else v-loading="loading && rows.length > 0" class="data-table" :data="rows">
        <el-table-column :label="$t('vault.assets.fileName')" min-width="220" :show-overflow-tooltip="true">
          <template #default="{ row }">
            <div class="asset-name-cell">
              <span class="asset-name-primary">{{ resolveVaultAssetFileName(row) }}</span>
              <span v-if="row.samplePath && row.samplePath !== resolveVaultAssetFileName(row)" class="asset-name-sub">
                {{ row.samplePath }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="$t('vault.spaces.owner')" min-width="140" :show-overflow-tooltip="true">
          <template #default="{ row }">{{ row.nickName || row.userName || row.userId || '-' }}</template>
        </el-table-column>
        <el-table-column :label="$t('vault.assets.vaultName')" min-width="140" :show-overflow-tooltip="true">
          <template #default="{ row }">
            <el-button link type="primary" @click="goSpace(row.vaultName)">{{ row.vaultName || row.vaultId }}</el-button>
          </template>
        </el-table-column>
        <el-table-column :label="$t('vault.files.mimeType')" min-width="140" :show-overflow-tooltip="true">
          <template #default="{ row }">{{ row.mimeType || '-' }}</template>
        </el-table-column>
        <el-table-column :label="$t('vault.files.size')" width="100" align="right">
          <template #default="{ row }">{{ formatBytes(row.sizeBytes) }}</template>
        </el-table-column>
        <el-table-column :label="$t('vault.files.refCount')" prop="refCount" width="76" align="center" />
        <el-table-column :label="$t('vault.files.backend')" min-width="140" :show-overflow-tooltip="true">
          <template #default="{ row }">
            <div class="backend-cell">
              <el-tag size="small">{{ (row.backend || '-').toUpperCase() }}</el-tag>
              <span v-if="row.configName || row.configId" class="asset-name-sub">
                {{ row.configName || `#${row.configId}` }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="$t('vault.files.hash')" min-width="180" :show-overflow-tooltip="true">
          <template #default="{ row }">
            <span class="mono-text">{{ row.sha256 }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('vault.assets.syncTime')" width="165" align="center">
          <template #default="{ row }">{{ parseTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column :label="$t('common.operate')" width="96" align="center" class-name="small-padding fixed-width">
          <template #default="{ row }">
            <el-tooltip :content="$t('vault.assets.preview')" placement="top">
              <el-button
                v-hasPermi="['vault:file:content', 'vault:asset:content']"
                link
                type="primary"
                icon="View"
                :aria-label="$t('vault.assets.preview')"
                @click="openPreview(row)"
              />
            </el-tooltip>
            <el-tooltip :content="$t('vault.assets.download')" placement="top">
              <el-button
                v-hasPermi="['vault:file:content', 'vault:asset:content']"
                link
                type="primary"
                icon="Download"
                :aria-label="$t('vault.assets.download')"
                @click="handleDownload(row)"
              />
            </el-tooltip>
          </template>
        </el-table-column>
        <template #empty>
          <table-skeleton v-if="loading" :rows="8" />
          <div v-else class="empty-hint">{{ $t('common.noData') }}</div>
        </template>
      </el-table>

      <pagination
        v-show="total > 0 && !errorInfo"
        :total="total"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        @pagination="getList"
      />
    </el-card>

    <FilePreviewDrawer
      v-model="previewOpen"
      :fetch-url="previewTarget ? vaultAssetContentPath(previewTarget.vaultId, previewTarget.assetId) : undefined"
      :file-name="previewTarget ? resolveVaultAssetFileName(previewTarget) : undefined"
      :mime-type="previewTarget?.mimeType"
      @download="previewTarget && handleDownload(previewTarget)"
    />
  </div>
</template>

<script setup lang="ts" name="VaultAssets">
import ErrorState from '@/components/ErrorState/ErrorState.vue';
import FilePreviewDrawer from '@/components/FilePreviewDrawer/index.vue';
import TableSkeleton from '@/components/Skeleton/TableSkeleton.vue';
import { listVaultGlobalAssets, resolveVaultAssetFileName, vaultAssetContentPath } from '@/api/vault/assets';
import type { VaultAdminAsset, VaultGlobalAssetQuery } from '@/api/vault/assets/types';
import { downloadVaultAssetBlob } from '@/api/vault/spaces';
import { classifyRequestError } from '@/utils/errorKind';
import type { ErrorInfo } from '@/utils/errorKind';
import { parseTime } from '@/utils/ruoyi';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const errorInfo = ref<ErrorInfo | null>(null);
const showSearch = ref(true);
const rows = ref<VaultAdminAsset[]>([]);
const total = ref(0);
const queryFormRef = ref<ElFormInstance>();

const previewOpen = ref(false);
const previewTarget = ref<VaultAdminAsset | null>(null);

const queryParams = ref<VaultGlobalAssetQuery>({
  pageNum: 1,
  pageSize: 20,
  vaultId: typeof route.query.vaultId === 'string' ? route.query.vaultId : undefined,
  keyword: typeof route.query.keyword === 'string' ? route.query.keyword : undefined,
  backend: undefined,
  mimePrefix: undefined
});

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

const getList = async () => {
  loading.value = true;
  try {
    const res = await listVaultGlobalAssets(queryParams.value);
    rows.value = res.data.rows || [];
    total.value = res.data.total || 0;
    errorInfo.value = null;
  } catch (err) {
    errorInfo.value = classifyRequestError(err);
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

const resetQuery = () => {
  queryFormRef.value?.resetFields();
  queryParams.value.vaultId = undefined;
  queryParams.value.keyword = undefined;
  queryParams.value.backend = undefined;
  queryParams.value.mimePrefix = undefined;
  handleQuery();
};

const goSpace = (vaultName?: string) => {
  router.push({ path: '/vault/spaces', query: vaultName ? { name: vaultName } : undefined });
};

const openPreview = (row: VaultAdminAsset) => {
  previewTarget.value = row;
  previewOpen.value = true;
};

const handleDownload = async (row: VaultAdminAsset) => {
  const blob = (await downloadVaultAssetBlob(row.vaultId, row.assetId)) as unknown as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = resolveVaultAssetFileName(row);
  a.click();
  URL.revokeObjectURL(url);
};

onMounted(() => {
  getList();
});
</script>

<style scoped lang="scss">
.asset-name-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.asset-name-primary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-name-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.backend-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.mono-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}
</style>
