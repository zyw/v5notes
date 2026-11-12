<template>
  <div class="p-2">
    <div class="search-wrap">
      <el-card shadow="hover" class="search-panel" :class="{ 'is-collapsed': !showSearch }">
        <template #header>
          <div class="panel-heading search-panel-toggle" @click.stop="showSearch = !showSearch">
            <div>
              <span class="panel-kicker">{{ $t('notes.kicker.search') }}</span>
              <h3>{{ $t('common.filter') }}</h3>
            </div>
          </div>
        </template>
        <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="query-form">
          <el-form-item :label="$t('dashboard.storageUser')" prop="keyword">
            <el-input
              v-model="queryParams.keyword"
              :placeholder="$t('dashboard.storageKeywordPh')"
              clearable
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item :label="$t('dashboard.storageSource')" prop="userSource">
            <el-select
              v-model="queryParams.userSource"
              :placeholder="$t('dashboard.storageAllSources')"
              clearable
              style="width: 160px"
            >
              <el-option :label="$t('dashboard.sourceSysAdd')" value="sys_add" />
              <el-option :label="$t('dashboard.sourceClientRegister')" value="client_register" />
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
            <span class="panel-kicker">{{ $t('dashboard.storageDataset') }}</span>
            <h3>{{ $t('dashboard.storageTitle') }}</h3>
            <p>{{ $t('dashboard.storageListDesc', { total }) }}</p>
          </div>
          <div class="toolbar-actions">
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList" />
          </div>
        </div>
      </template>

      <error-state v-if="errorInfo" :kind="errorInfo.kind" :title="errorInfo.title" :message="errorInfo.message" @retry="getList" />
      <el-table v-else v-loading="loading && rows.length > 0" class="data-table" :data="rows">
        <el-table-column :label="$t('dashboard.storageUser')" min-width="180" :show-overflow-tooltip="true">
          <template #default="{ row }">{{ row.nickName || row.userName }}</template>
        </el-table-column>
        <el-table-column :label="$t('system.user.userName')" prop="userName" min-width="140" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('dashboard.storageSource')" min-width="140">
          <template #default="{ row }">{{ sourceLabel(row.userSource) }}</template>
        </el-table-column>
        <el-table-column :label="$t('dashboard.storageNotes')" min-width="120">
          <template #default="{ row }">{{ formatBytes(row.noteBytes) }}</template>
        </el-table-column>
        <el-table-column :label="$t('dashboard.storageFiles')" min-width="120">
          <template #default="{ row }">{{ formatBytes(row.fileBytes) }}</template>
        </el-table-column>
        <el-table-column :label="$t('dashboard.storageUsed')" min-width="120">
          <template #default="{ row }">{{ formatBytes(row.usedBytes) }}</template>
        </el-table-column>
        <template #empty>
          <table-skeleton v-if="loading" :rows="8" />
          <div v-else class="empty-hint">{{ $t('dashboard.storageEmpty') }}</div>
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

<script setup lang="ts" name="ClientStorage">
import { useI18n } from 'vue-i18n';
import ErrorState from '@/components/ErrorState/ErrorState.vue';
import TableSkeleton from '@/components/Skeleton/TableSkeleton.vue';
import { listClientStorage } from '@/api/notes/dashboard';
import type { ClientStorageQuery, ClientStorageRank } from '@/api/notes/dashboard/types';
import { classifyRequestError } from '@/utils/errorKind';
import type { ErrorInfo } from '@/utils/errorKind';

const { t } = useI18n();
const loading = ref(true);
const errorInfo = ref<ErrorInfo | null>(null);
const showSearch = ref(true);
const rows = ref<ClientStorageRank[]>([]);
const total = ref(0);
const queryFormRef = ref<ElFormInstance>();

const queryParams = ref<ClientStorageQuery>({
  pageNum: 1,
  pageSize: 20,
  keyword: undefined,
  userSource: undefined
});

const sourceLabel = (source?: string) => {
  if (source === 'client_register') return t('dashboard.sourceClientRegister');
  return t('dashboard.sourceSysAdd');
};

const formatBytes = (value?: number) => {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`;
};

const getList = async () => {
  loading.value = true;
  errorInfo.value = null;
  try {
    const res = await listClientStorage(queryParams.value);
    rows.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } catch (error) {
    errorInfo.value = classifyRequestError(error);
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
  handleQuery();
};

onMounted(getList);
</script>
