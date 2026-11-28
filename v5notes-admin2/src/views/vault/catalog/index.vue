<template>
  <div class="p-2">
    <div class="search-wrap">
      <el-card shadow="hover" class="search-panel" :class="{ 'is-collapsed': !showSearch }">
        <template #header>
          <div class="panel-heading search-panel-toggle" @click.stop="showSearch = !showSearch">
            <div>
              <span class="panel-kicker">{{ $t('vault.catalog.kicker') }}</span>
              <h3>{{ $t('common.filter') }}</h3>
            </div>
          </div>
        </template>
        <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="query-form">
          <el-form-item :label="$t('vault.catalog.kind')" prop="kind">
            <el-select v-model="queryParams.kind" :placeholder="$t('vault.catalog.allKinds')" clearable style="width: 130px">
              <el-option :label="$t('vault.catalog.kindPlugin')" value="plugin" />
              <el-option :label="$t('vault.catalog.kindTheme')" value="theme" />
            </el-select>
          </el-form-item>
          <el-form-item :label="$t('vault.catalog.status')" prop="status">
            <el-select v-model="queryParams.status" :placeholder="$t('vault.catalog.allStatus')" clearable style="width: 130px">
              <el-option :label="$t('vault.catalog.statusDraft')" value="0" />
              <el-option :label="$t('vault.catalog.statusPublished')" value="1" />
              <el-option :label="$t('vault.catalog.statusUnpublished')" value="2" />
            </el-select>
          </el-form-item>
          <el-form-item :label="$t('vault.catalog.keyword')" prop="keyword">
            <el-input
              v-model="queryParams.keyword"
              :placeholder="$t('vault.catalog.keywordPh')"
              clearable
              style="width: 210px"
              @keyup.enter="handleQuery"
            />
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
            <span class="panel-kicker">{{ $t('vault.catalog.kicker') }}</span>
            <h3>{{ $t('vault.catalog.title') }}</h3>
          </div>
          <div class="toolbar-actions">
            <el-button v-hasPermi="['vault:catalog:add']" type="primary" plain icon="Plus" @click="openCreate">
              {{ $t('vault.catalog.addTitle') }}
            </el-button>
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList" />
          </div>
        </div>
      </template>

      <error-state v-if="errorInfo" :kind="errorInfo.kind" :title="errorInfo.title" :message="errorInfo.message" @retry="getList" />
      <el-table v-else v-loading="loading && rows.length > 0" class="data-table" :data="rows">
        <el-table-column :label="$t('vault.catalog.id')" prop="id" min-width="150" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('vault.catalog.name')" prop="name" min-width="150" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('vault.catalog.kind')" width="96" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.kind === 'theme' ? 'success' : 'primary'">
              {{ row.kind === 'theme' ? $t('vault.catalog.kindTheme') : $t('vault.catalog.kindPlugin') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('vault.catalog.version')" prop="version" width="90" align="center" />
        <el-table-column :label="$t('vault.catalog.minAppVersion')" prop="minAppVersion" width="96" align="center" />
        <el-table-column :label="$t('vault.catalog.author')" prop="author" width="110" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('vault.catalog.permissions')" min-width="180">
          <template #default="{ row }">
            <div class="perm-list">
              <el-tag v-for="p in row.permissions" :key="p" size="small" type="info">{{ p }}</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="$t('vault.catalog.fileCount')" prop="fileCount" width="76" align="center" />
        <el-table-column :label="$t('vault.catalog.status')" width="116" align="center">
          <template #default="{ row }">
            <el-switch
              v-hasPermi="['vault:catalog:publish']"
              :model-value="row.status === '1'"
              :loading="togglingId === row.id"
              :aria-label="row.status === '1' ? $t('vault.catalog.statusPublished') : $t('vault.catalog.statusUnpublished')"
              @change="onToggleStatus(row, Boolean($event))"
            />
            <span class="status-label">{{ statusLabel(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.updateTime')" width="165" align="center">
          <template #default="{ row }">{{ parseTime(row.updateTime) }}</template>
        </el-table-column>
        <el-table-column :label="$t('common.operate')" width="96" align="center" class-name="small-padding fixed-width">
          <template #default="{ row }">
            <el-tooltip :content="$t('common.edit')" placement="top">
              <el-button
                v-hasPermi="['vault:catalog:edit']"
                link
                type="primary"
                icon="Edit"
                :aria-label="$t('common.edit')"
                @click="openEdit(row)"
              />
            </el-tooltip>
            <el-tooltip :content="$t('common.delete')" placement="top">
              <el-button
                v-hasPermi="['vault:catalog:remove']"
                link
                type="danger"
                icon="Delete"
                :disabled="row.status === '1'"
                :aria-label="$t('common.delete')"
                @click="handleDelete(row)"
              />
            </el-tooltip>
          </template>
        </el-table-column>
        <template #empty>
          <table-skeleton v-if="loading" :rows="6" />
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

    <catalog-form-dialog v-model="dialogOpen" :editing-id="editingId" @saved="getList" />
  </div>
</template>

<script setup lang="ts" name="VaultCatalog">
import { useI18n } from 'vue-i18n';
import ErrorState from '@/components/ErrorState/ErrorState.vue';
import TableSkeleton from '@/components/Skeleton/TableSkeleton.vue';
import {
  listVaultCatalog,
  removeVaultCatalog,
  updateVaultCatalogStatus
} from '@/api/vault/catalog';
import type { VaultAdminCatalogItem, VaultCatalogQuery } from '@/api/vault/catalog/types';
import { classifyRequestError } from '@/utils/errorKind';
import type { ErrorInfo } from '@/utils/errorKind';
import { parseTime } from '@/utils/ruoyi';
import CatalogFormDialog from './catalog-form-dialog.vue';

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const loading = ref(true);
const errorInfo = ref<ErrorInfo | null>(null);
const showSearch = ref(true);
const rows = ref<VaultAdminCatalogItem[]>([]);
const total = ref(0);
const queryFormRef = ref<ElFormInstance>();
const dialogOpen = ref(false);
const editingId = ref<string | null>(null);
const togglingId = ref<string | null>(null);

const queryParams = ref<VaultCatalogQuery>({
  pageNum: 1,
  pageSize: 20,
  kind: undefined,
  status: undefined,
  keyword: undefined
});

const statusLabel = (status: string) => {
  if (status === '1') return t('vault.catalog.statusPublished');
  if (status === '2') return t('vault.catalog.statusUnpublished');
  return t('vault.catalog.statusDraft');
};

const getList = async () => {
  loading.value = true;
  try {
    const res = await listVaultCatalog(queryParams.value);
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
  queryParams.value.kind = undefined;
  queryParams.value.status = undefined;
  queryParams.value.keyword = undefined;
  handleQuery();
};

const openCreate = () => {
  editingId.value = null;
  dialogOpen.value = true;
};

const openEdit = (row: any) => {
  editingId.value = row.id;
  dialogOpen.value = true;
};

const onToggleStatus = async (row: any, publish: boolean) => {
  const nextStatus = publish ? '1' : '2';
  togglingId.value = row.id;
  try {
    await updateVaultCatalogStatus(row.id, nextStatus);
    row.status = nextStatus;
    proxy?.$modal.msgSuccess(publish ? t('vault.catalog.publishSuccess') : t('vault.catalog.unpublishSuccess'));
  } finally {
    togglingId.value = null;
  }
};

const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm(t('vault.catalog.deleteConfirm', { name: row.name }), t('common.warning'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      confirmButtonClass: 'el-button--danger',
      type: 'warning'
    });
    await removeVaultCatalog(row.id);
    proxy?.$modal.msgSuccess(t('vault.catalog.deleteSuccess'));
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
.perm-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.status-label {
  margin-left: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
