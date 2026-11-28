<template>
  <div class="p-2">
    <div class="search-wrap">
      <el-card shadow="hover" class="search-panel" :class="{ 'is-collapsed': !showSearch }">
        <template #header>
          <div class="panel-heading search-panel-toggle" @click.stop="showSearch = !showSearch">
            <div>
              <span class="panel-kicker">{{ $t('vault.replicas.kicker') }}</span>
              <h3>{{ $t('common.filter') }}</h3>
            </div>
          </div>
        </template>
        <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="query-form">
          <el-form-item :label="$t('vault.replicas.keyword')" prop="keyword">
            <el-input
              v-model="queryParams.keyword"
              :placeholder="$t('vault.replicas.keywordPh')"
              clearable
              style="width: 220px"
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item :label="$t('vault.replicas.deviceId')" prop="deviceId">
            <el-input
              v-model="queryParams.deviceId"
              :placeholder="$t('vault.replicas.deviceIdPh')"
              clearable
              style="width: 180px"
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item :label="$t('vault.replicas.inactiveDays')" prop="inactiveDays">
            <el-select v-model="queryParams.inactiveDays" :placeholder="$t('vault.replicas.allActivity')" clearable style="width: 160px">
              <el-option :label="$t('vault.replicas.inactive7')" :value="7" />
              <el-option :label="$t('vault.replicas.inactive30')" :value="30" />
              <el-option :label="$t('vault.replicas.inactive90')" :value="90" />
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
            <span class="panel-kicker">{{ $t('vault.replicas.kicker') }}</span>
            <h3>{{ $t('vault.replicas.title') }}</h3>
          </div>
          <div class="toolbar-actions">
            <el-button
              v-hasPermi="['vault:replica:remove']"
              type="danger"
              plain
              icon="Delete"
              :disabled="selectedIds.length === 0"
              @click="handleKickBatch"
            >
              {{ $t('vault.replicas.kickBatch') }}
            </el-button>
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList" />
          </div>
        </div>
      </template>

      <error-state v-if="errorInfo" :kind="errorInfo.kind" :title="errorInfo.title" :message="errorInfo.message" @retry="getList" />
      <el-table
        v-else
        v-loading="loading && rows.length > 0"
        class="data-table"
        :data="rows"
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="48" align="center" />
        <el-table-column :label="$t('vault.spaces.owner')" min-width="140" :show-overflow-tooltip="true">
          <template #default="{ row }">{{ row.nickName || row.userName || row.userId }}</template>
        </el-table-column>
        <el-table-column :label="$t('vault.replicas.vaultName')" prop="vaultName" min-width="140" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('vault.replicas.clientInfo')" prop="clientInfo" min-width="160" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('vault.replicas.replicaId')" prop="replicaId" min-width="170" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('vault.replicas.deviceId')" prop="deviceId" min-width="170" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('vault.replicas.lastSeenAt')" width="165" align="center">
          <template #default="{ row }">{{ parseTime(row.lastSeenAt) }}</template>
        </el-table-column>
        <el-table-column :label="$t('vault.replicas.boundAt')" width="165" align="center">
          <template #default="{ row }">{{ parseTime(row.boundAt) }}</template>
        </el-table-column>
        <el-table-column :label="$t('common.operate')" width="84" align="center" class-name="small-padding fixed-width">
          <template #default="{ row }">
            <el-tooltip :content="$t('vault.replicas.kick')" placement="top">
              <el-button
                v-hasPermi="['vault:replica:remove']"
                link
                type="danger"
                icon="Delete"
                :aria-label="$t('vault.replicas.kick')"
                @click="handleKick(row)"
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
  </div>
</template>

<script setup lang="ts" name="VaultReplicas">
import { useI18n } from 'vue-i18n';
import ErrorState from '@/components/ErrorState/ErrorState.vue';
import TableSkeleton from '@/components/Skeleton/TableSkeleton.vue';
import { kickVaultReplica, kickVaultReplicasBatch, listVaultReplicas } from '@/api/vault/replicas';
import type { VaultAdminReplica, VaultReplicaQuery } from '@/api/vault/replicas/types';
import { classifyRequestError } from '@/utils/errorKind';
import type { ErrorInfo } from '@/utils/errorKind';
import { parseTime } from '@/utils/ruoyi';

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const loading = ref(true);
const errorInfo = ref<ErrorInfo | null>(null);
const showSearch = ref(true);
const rows = ref<VaultAdminReplica[]>([]);
const total = ref(0);
const selectedIds = ref<string[]>([]);
const queryFormRef = ref<ElFormInstance>();

const queryParams = ref<VaultReplicaQuery>({
  pageNum: 1,
  pageSize: 20,
  keyword: undefined,
  deviceId: undefined,
  inactiveDays: undefined
});

const getList = async () => {
  loading.value = true;
  try {
    const res = await listVaultReplicas(queryParams.value);
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
  queryParams.value.deviceId = undefined;
  queryParams.value.inactiveDays = undefined;
  handleQuery();
};

const onSelectionChange = (selection: VaultAdminReplica[]) => {
  selectedIds.value = selection.map((item) => item.id);
};

const handleKick = async (row: any) => {
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
    await getList();
  } catch {
    // cancelled
  }
};

const handleKickBatch = async () => {
  if (selectedIds.value.length === 0) return;
  try {
    await ElMessageBox.confirm(
      t('vault.replicas.kickBatchConfirm', { count: selectedIds.value.length }),
      t('common.warning'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        confirmButtonClass: 'el-button--danger',
        type: 'warning'
      }
    );
    await kickVaultReplicasBatch(selectedIds.value);
    proxy?.$modal.msgSuccess(t('vault.replicas.kickSuccess'));
    selectedIds.value = [];
    await getList();
  } catch {
    // cancelled
  }
};

onMounted(() => {
  getList();
});
</script>
