<template>
  <div class="p-2">
    <div class="search-wrap">
      <el-card shadow="hover" class="search-panel" :class="{ 'is-collapsed': !showSearch }">
        <template #header>
          <div class="panel-heading search-panel-toggle" @click.stop="showSearch = !showSearch">
            <div>
              <span class="panel-kicker">Search Filters</span>
              <h3>筛选条件</h3>
            </div>
          </div>
        </template>
        <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="query-form">
          <el-form-item label="名称" prop="name">
            <el-input v-model="queryParams.name" placeholder="请输入笔记或目录名称" clearable @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item label="类型" prop="objectType">
            <el-select v-model="queryParams.objectType" placeholder="全部类型" clearable style="width: 140px">
              <el-option label="笔记" value="1" />
              <el-option label="目录" value="2" />
            </el-select>
          </el-form-item>
          <el-form-item label="所属账号" prop="userName">
            <el-input v-model="queryParams.userName" placeholder="请输入所属用户账号" clearable @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetQuery">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>

    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="panel-kicker">Trash Dataset</span>
            <h3>回收站</h3>
            <p>共 {{ total }} 条记录，包含全部用户移入回收站的笔记和目录。</p>
          </div>
          <div class="toolbar-actions">
            <el-button v-hasPermi="['notes:trash:remove']" type="danger" plain icon="Delete" :disabled="multiple" @click="handlePurge()">
              彻底删除
            </el-button>
            <el-button v-hasPermi="['notes:trash:clean']" type="danger" plain icon="Delete" @click="handleEmpty">清空回收站</el-button>
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList" />
          </div>
        </div>
      </template>

      <error-state v-if="errorInfo" :kind="errorInfo.kind" :title="errorInfo.title" :message="errorInfo.message" @retry="getList" />
      <el-table v-else v-loading="loading && trashList.length > 0" class="data-table" :data="trashList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column label="名称" align="left" prop="name" min-width="180" :show-overflow-tooltip="true" />
        <el-table-column label="类型" align="center" prop="objectType" width="90">
          <template #default="scope">
            <span>{{ isDirectory(scope.row) ? '目录' : '笔记' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="内容" align="center" min-width="160">
          <template #default="scope">
            <span>{{ summary(scope.row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="所属账号" align="center" prop="userName" width="140" :show-overflow-tooltip="true" />
        <el-table-column label="原路径" align="left" prop="originalPath" min-width="180" :show-overflow-tooltip="true" />
        <el-table-column label="删除时间" align="center" prop="deletedTime" width="180">
          <template #default="scope">
            <span>{{ parseTime(scope.row.deletedTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="剩余天数" align="center" prop="daysLeft" width="100" />
        <el-table-column label="操作" align="center" width="160" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-button v-hasPermi="['notes:trash:restore']" link type="primary" @click="handleRestore(scope.row)">恢复</el-button>
            <el-button v-hasPermi="['notes:trash:remove']" link type="danger" @click="handlePurge(scope.row)">彻底删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <table-skeleton v-if="loading" :rows="8" />
          <div v-else class="empty-hint">暂无数据</div>
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
import ErrorState from '@/components/ErrorState/ErrorState.vue';
import TableSkeleton from '@/components/Skeleton/TableSkeleton.vue';
import { emptyTrash, listTrash, purgeTrash, restoreTrash } from '@/api/notes/trash';
import type { TrashQuery, TrashVO } from '@/api/notes/trash/types';
import modal from '@/plugins/modal';
import { classifyRequestError } from '@/utils/errorKind';
import type { ErrorInfo } from '@/utils/errorKind';
import { parseTime } from '@/utils/ruoyi';

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
    return `${row.dirCount ?? 0} 个目录，${row.noteCount ?? 0} 篇笔记`;
  }
  return '1 篇笔记';
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
    ? `原位置是「${row.originalPath}」。原位置不在时会回到该用户的根目录。`
    : '原位置不在时会回到该用户的根目录。';
  if (!(await confirmed(`恢复「${row.name}」后，它会回到所属用户的目录树。${where}`))) {
    return;
  }
  const res = await restoreTrash(row.id);
  await getList();
  modal.msgSuccess(res.msg && res.msg !== '操作成功' ? res.msg : '恢复成功');
};

const handlePurge = async (row?: TrashVO) => {
  const targetIds = row?.id != null && row.id !== '' ? [row.id] : ids.value;
  if (!targetIds.length) {
    return;
  }
  const label = row?.name ? `「${row.name}」` : `选中的 ${targetIds.length} 条记录`;
  if (!(await confirmed(`彻底删除${label}后，正文版本会一并清除，且无法再恢复。`))) {
    return;
  }
  await purgeTrash(targetIds);
  await getList();
  modal.msgSuccess('删除成功');
};

const handleEmpty = async () => {
  if (!(await confirmed('将永久删除回收站中的全部笔记、目录和正文版本。'))) {
    return;
  }
  const res = await emptyTrash();
  await getList();
  modal.msgSuccess(res.msg && res.msg !== '操作成功' ? res.msg : '清空成功');
};

onMounted(() => {
  getList();
});
</script>
