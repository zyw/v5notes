<template>
  <div class="p-2">
    <div class="search-wrap">
      <el-card shadow="hover" class="search-panel" :class="{ 'is-collapsed': !showSearch }">
        <template #header>
          <div class="panel-heading search-panel-toggle" @click.stop="showSearch = !showSearch">
            <div>
              <span class="panel-kicker">{{ $t('vault.spaces.kicker') }}</span>
              <h3>{{ $t('common.filter') }}</h3>
            </div>
          </div>
        </template>
        <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="query-form">
          <el-form-item :label="$t('vault.spaces.userKeyword')" prop="keyword">
            <el-input
              v-model="queryParams.keyword"
              :placeholder="$t('vault.spaces.userKeywordPh')"
              clearable
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item :label="$t('vault.spaces.name')" prop="name">
            <el-input
              v-model="queryParams.name"
              :placeholder="$t('vault.spaces.namePh')"
              clearable
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item :label="$t('vault.spaces.status')" prop="status">
            <el-select v-model="queryParams.status" :placeholder="$t('vault.spaces.allStatus')" clearable style="width: 140px">
              <el-option :label="$t('vault.spaces.statusNormal')" value="normal" />
              <el-option :label="$t('vault.spaces.statusOverQuota')" value="over_quota" />
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
            <span class="panel-kicker">{{ $t('vault.spaces.kicker') }}</span>
            <h3>{{ $t('vault.spaces.title') }}</h3>
          </div>
          <div class="toolbar-actions">
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList" />
          </div>
        </div>
      </template>

      <error-state v-if="errorInfo" :kind="errorInfo.kind" :title="errorInfo.title" :message="errorInfo.message" @retry="getList" />
      <el-table v-else v-loading="loading && rows.length > 0" class="data-table" :data="rows">
        <el-table-column :label="$t('vault.spaces.name')" prop="name" min-width="160" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('vault.spaces.owner')" min-width="150" :show-overflow-tooltip="true">
          <template #default="{ row }">
            <span>{{ row.nickName || row.userName || row.userId }}</span>
            <span v-if="row.nickName && row.userName" class="sub-account"> ({{ row.userName }})</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('vault.spaces.files')" prop="fileCount" width="96" align="center" />
        <el-table-column :label="$t('vault.spaces.replicas')" width="110" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.replicaCount >= row.replicaLimit ? 'warning' : 'info'">
              {{ row.replicaCount }} / {{ row.replicaLimit }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('vault.spaces.storage')" min-width="190">
          <template #default="{ row }">
            <div class="storage-cell">
              <div class="storage-nums">
                <span :class="{ 'is-danger': row.overQuota }">{{ formatBytes(row.usedBytes) }}</span>
                <span class="sub-account"> / {{ formatBytes(row.quotaBytes) }}</span>
              </div>
              <el-progress
                :percentage="quotaPercent(row)"
                :status="row.overQuota ? 'exception' : undefined"
                :show-text="false"
                :stroke-width="5"
              />
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="$t('vault.spaces.lastSyncAt')" width="170" align="center">
          <template #default="{ row }">{{ parseTime(row.lastSyncAt) || '-' }}</template>
        </el-table-column>
        <el-table-column :label="$t('common.createTime')" width="170" align="center">
          <template #default="{ row }">{{ parseTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column :label="$t('common.operate')" width="108" align="center" class-name="small-padding fixed-width">
          <template #default="{ row }">
            <el-tooltip :content="$t('vault.spaces.detail')" placement="top">
              <el-button
                v-hasPermi="['vault:space:query']"
                link
                type="primary"
                icon="View"
                :aria-label="$t('vault.spaces.detail')"
                @click="openDetail(row)"
              />
            </el-tooltip>
            <el-tooltip :content="$t('vault.spaces.deleteSpace')" placement="top">
              <el-button
                v-hasPermi="['vault:space:remove']"
                link
                type="danger"
                icon="Delete"
                :aria-label="$t('vault.spaces.deleteSpace')"
                @click="handleDelete(row)"
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

    <space-detail-drawer v-model="drawerOpen" :space="activeSpace" @changed="getList" />
  </div>
</template>

<script setup lang="ts" name="VaultSpaces">
import { useI18n } from 'vue-i18n';
import ErrorState from '@/components/ErrorState/ErrorState.vue';
import TableSkeleton from '@/components/Skeleton/TableSkeleton.vue';
import { listVaultSpaces, removeVaultSpace } from '@/api/vault/spaces';
import type { VaultAdminSpace, VaultSpaceQuery } from '@/api/vault/spaces/types';
import { classifyRequestError } from '@/utils/errorKind';
import type { ErrorInfo } from '@/utils/errorKind';
import { parseTime } from '@/utils/ruoyi';
import SpaceDetailDrawer from './space-detail-drawer.vue';

const { t } = useI18n();
const route = useRoute();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const loading = ref(true);
const errorInfo = ref<ErrorInfo | null>(null);
const showSearch = ref(true);
const rows = ref<VaultAdminSpace[]>([]);
const total = ref(0);
const queryFormRef = ref<ElFormInstance>();
const drawerOpen = ref(false);
const activeSpace = ref<VaultAdminSpace | null>(null);

const queryParams = ref<VaultSpaceQuery>({
  pageNum: 1,
  pageSize: 20,
  keyword: typeof route.query.keyword === 'string' ? route.query.keyword : undefined,
  name: typeof route.query.name === 'string' ? route.query.name : undefined,
  status: undefined
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

const quotaPercent = (row: any) => {
  if (!row.quotaBytes || row.quotaBytes <= 0) return 0;
  return Math.min(100, Math.round((row.usedBytes / row.quotaBytes) * 100));
};

const getList = async () => {
  loading.value = true;
  try {
    const res = await listVaultSpaces(queryParams.value);
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
  queryParams.value.keyword = undefined;
  queryParams.value.name = undefined;
  queryParams.value.status = undefined;
  handleQuery();
};

const openDetail = (row: any) => {
  activeSpace.value = row as VaultAdminSpace;
  drawerOpen.value = true;
};

const handleDelete = async (row: any) => {
  try {
    const { value } = await ElMessageBox.prompt(
      t('vault.spaces.deleteConfirm', { name: row.name }),
      t('vault.spaces.deleteTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        confirmButtonClass: 'el-button--danger',
        type: 'warning',
        inputPlaceholder: row.name,
        inputValidator: (input) => (input?.trim() === row.name ? true : t('vault.spaces.deleteMismatch'))
      }
    );
    if (value?.trim() !== row.name) return;
    await removeVaultSpace(row.vaultId);
    proxy?.$modal.msgSuccess(t('vault.spaces.deleteSuccess'));
    if (activeSpace.value?.vaultId === row.vaultId) {
      drawerOpen.value = false;
    }
    await getList();
  } catch {
    // cancelled
  }
};

onMounted(() => {
  getList();
});
</script>

<style scoped lang="scss">
.sub-account {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.storage-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.storage-nums {
  font-size: 12px;
}

.is-danger {
  color: var(--el-color-danger);
}
</style>
