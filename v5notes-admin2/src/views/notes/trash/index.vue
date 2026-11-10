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
          <el-form-item :label="$t('common.name')" prop="name">
            <el-input v-model="queryParams.name" :placeholder="$t('common.pleaseInput', { label: $t('notes.trash.nameOrDir') })" clearable @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item :label="$t('common.type')" prop="objectType">
            <el-select v-model="queryParams.objectType" :placeholder="$t('notes.trash.allTypes')" clearable style="width: 140px">
              <el-option :label="$t('notes.note')" value="1" />
              <el-option :label="$t('notes.directory')" value="2" />
            </el-select>
          </el-form-item>
          <el-form-item :label="$t('notes.trash.owner')" prop="userName">
            <el-input v-model="queryParams.userName" :placeholder="$t('common.pleaseInput', { label: $t('notes.trash.ownerAccount') })" clearable @keyup.enter="handleQuery" />
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
            <span class="panel-kicker">{{ $t('notes.trash.dataset') }}</span>
            <h3>{{ $t('notes.trash.title') }}</h3>
            <p>{{ $t('notes.trash.listDesc', { total }) }}</p>
          </div>
          <div class="toolbar-actions">
            <el-button v-hasPermi="['notes:trash:remove']" type="danger" plain icon="Delete" :disabled="multiple" @click="handlePurge()">
              {{ $t('notes.trash.purge') }}
            </el-button>
            <el-button v-hasPermi="['notes:trash:clean']" type="danger" plain icon="Delete" @click="handleEmpty">{{ $t('notes.trash.empty') }}</el-button>
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList" />
          </div>
        </div>
      </template>

      <error-state v-if="errorInfo" :kind="errorInfo.kind" :title="errorInfo.title" :message="errorInfo.message" @retry="getList" />
      <el-table v-else v-loading="loading && trashList.length > 0" class="data-table" :data="trashList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column :label="$t('common.name')" align="left" prop="name" min-width="180" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('common.type')" align="center" prop="objectType" width="90">
          <template #default="scope">
            <span>{{ isDirectory(scope.row) ? $t('notes.directory') : $t('notes.note') }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.content')" align="center" min-width="160">
          <template #default="scope">
            <span>{{ summary(scope.row) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('notes.trash.owner')" align="center" prop="userName" width="140" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('notes.trash.originalPath')" align="left" prop="originalPath" min-width="180" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('notes.trash.deletedTime')" align="center" prop="deletedTime" width="180">
          <template #default="scope">
            <span>{{ parseTime(scope.row.deletedTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('notes.trash.daysLeft')" align="center" prop="daysLeft" width="100" />
        <el-table-column :label="$t('common.operate')" align="center" width="160" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-button v-hasPermi="['notes:trash:restore']" link type="primary" @click="handleRestore(scope.row)">{{ $t('notes.trash.restore') }}</el-button>
            <el-button v-hasPermi="['notes:trash:remove']" link type="danger" @click="handlePurge(scope.row)">{{ $t('notes.trash.purge') }}</el-button>
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

<script setup name="NoteTrash" lang="ts">
import { useI18n } from 'vue-i18n';
import ErrorState from '@/components/ErrorState/ErrorState.vue';
import TableSkeleton from '@/components/Skeleton/TableSkeleton.vue';
import { emptyTrash, listTrash, purgeTrash, restoreTrash } from '@/api/notes/trash';
import type { TrashQuery, TrashVO } from '@/api/notes/trash/types';
import modal from '@/plugins/modal';
import { classifyRequestError } from '@/utils/errorKind';
import type { ErrorInfo } from '@/utils/errorKind';
import { parseTime } from '@/utils/ruoyi';

const { t } = useI18n();

const trashList = ref<TrashVO[]>([]);
const loading = ref(true);
const errorInfo = ref<ErrorInfo | null>(null);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const multiple = ref(true);
const total = ref(0);
const queryFormRef = ref<ElFormInstance>();

const queryParams = ref<TrashQuery>({
  pageNum: 1,
  pageSize: 10,
  name: undefined,
  objectType: undefined,
  userName: undefined
});

const isDirectory = (row: TrashVO) => String(row.objectType ?? '').trim() === '2';

const summary = (row: TrashVO) => {
  if (isDirectory(row)) {
    return t('notes.trash.dirSummary', { dirs: row.dirCount ?? 0, notes: row.noteCount ?? 0 });
  }
  return t('notes.trash.oneNote');
};

const getList = async () => {
  loading.value = true;
  errorInfo.value = null;
  try {
    const res = await listTrash(queryParams.value);
    trashList.value = res.data?.rows ?? [];
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

const handleSelectionChange = (selection: TrashVO[]) => {
  ids.value = selection.map(item => item.id);
  multiple.value = !selection.length;
};

const confirmed = async (message: string) => {
  try {
    await modal.confirm(message);
    return true;
  } catch {
    return false;
  }
};

const handleRestore = async (row: TrashVO) => {
  const where = row.originalPath
    ? t('notes.trash.restoreWhere', { path: row.originalPath })
    : t('notes.trash.restoreFallback');
  if (!(await confirmed(t('notes.trash.restoreConfirm', { name: row.name, where })))) {
    return;
  }
  const res = await restoreTrash(row.id);
  await getList();
  modal.msgSuccess(res.msg && res.msg !== '操作成功' ? res.msg : t('notes.trash.restoreSuccess'));
};

const handlePurge = async (row?: TrashVO) => {
  const targetIds = row?.id != null && row.id !== '' ? [row.id] : ids.value;
  if (!targetIds.length) {
    return;
  }
  const label = row?.name ? t('notes.trash.named', { name: row.name }) : t('notes.trash.selected', { count: targetIds.length });
  if (!(await confirmed(t('notes.trash.purgeConfirm', { label })))) {
    return;
  }
  await purgeTrash(targetIds);
  await getList();
  modal.msgSuccess(t('common.deleteSuccess'));
};

const handleEmpty = async () => {
  if (!(await confirmed(t('notes.trash.emptyConfirm')))) {
    return;
  }
  const res = await emptyTrash();
  await getList();
  modal.msgSuccess(res.msg && res.msg !== '操作成功' ? res.msg : t('notes.trash.emptySuccess'));
};

onMounted(() => {
  getList();
});
</script>
