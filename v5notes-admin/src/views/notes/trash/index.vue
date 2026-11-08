<template>
  <div class="p-2">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-[10px]">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="名称" prop="name">
              <el-input v-model="queryParams.name" placeholder="请输入笔记或目录名称" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="类型" prop="objectType">
              <el-select v-model="queryParams.objectType" placeholder="全部类型" clearable>
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
    </transition>

    <el-card shadow="hover">
      <template #header>
        <el-row :gutter="10" class="mb8">
          <el-col :span="1.5">
            <el-button v-hasPermi="['notes:trash:remove']" type="danger" plain icon="Delete" :disabled="multiple" @click="handlePurge()">彻底删除</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['notes:trash:clean']" type="danger" plain icon="WarnTriangleFilled" @click="handleEmpty">清空回收站</el-button>
          </el-col>
          <right-toolbar v-model:showSearch="showSearch" @query-table="getList"></right-toolbar>
        </el-row>
      </template>

      <el-table v-loading="loading" :data="trashList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column label="名称" align="left" prop="name" min-width="180" :show-overflow-tooltip="true" />
        <el-table-column label="类型" align="center" prop="objectType" width="90">
          <template #default="scope">
            <span>{{ scope.row.objectType === '2' ? '目录' : '笔记' }}</span>
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
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>
  </div>
</template>

<script setup name="NoteTrash" lang="ts">
import { emptyTrash, listTrash, purgeTrash, restoreTrash } from '@/api/notes/trash';
import { TrashQuery, TrashVO } from '@/api/notes/trash/types';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const trashList = ref<TrashVO[]>([]);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const multiple = ref(true);
const total = ref(0);
const queryFormRef = ref<ElFormInstance>();

const data = reactive<PageData<Record<string, never>, TrashQuery>>({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    name: undefined,
    objectType: undefined,
    userName: undefined
  },
  rules: {}
});

const { queryParams } = toRefs(data);

const summary = (row: TrashVO) => {
  if (String(row.objectType).trim() === '2') {
    return `${row.dirCount ?? 0} 个目录，${row.noteCount ?? 0} 篇笔记`;
  }
  return '1 篇笔记';
};

const getList = async () => {
  loading.value = true;
  const res = await listTrash(queryParams.value);
  const nested = (res as { data?: { rows?: TrashVO[]; total?: number } }).data;
  trashList.value = res.rows ?? nested?.rows ?? [];
  total.value = res.total ?? nested?.total ?? 0;
  loading.value = false;
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

const handleRestore = async (row: TrashVO) => {
  const where = row.originalPath ? `原位置是「${row.originalPath}」。原位置不在时会回到该用户的根目录。` : '原位置不在时会回到该用户的根目录。';
  await proxy?.$modal.confirm(`恢复「${row.name}」后，它会回到所属用户的目录树。${where}`);
  const res = await restoreTrash(row.id);
  await getList();
  proxy?.$modal.msgSuccess(res.msg && res.msg !== '操作成功' ? res.msg : '恢复成功');
};

const handlePurge = async (row?: TrashVO) => {
  const targetIds = row?.id ? [row.id] : ids.value;
  const label = row?.name ? `「${row.name}」` : `选中的 ${targetIds.length} 条记录`;
  await proxy?.$modal.confirm(`彻底删除${label}后，正文版本会一并清除，且无法再恢复。`);
  await purgeTrash(targetIds);
  await getList();
  proxy?.$modal.msgSuccess('删除成功');
};

const handleEmpty = async () => {
  await proxy?.$modal.confirm('将永久删除回收站中的全部笔记、目录和正文版本。');
  const res = await emptyTrash();
  await getList();
  proxy?.$modal.msgSuccess(res.msg && res.msg !== '操作成功' ? res.msg : '清空成功');
};

onMounted(() => {
  getList();
});
</script>
