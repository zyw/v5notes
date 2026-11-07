<template>
  <div>
    <transition :enter-active-class="animateConfig.searchAnimate.enter" :leave-active-class="animateConfig.searchAnimate.leave">
      <div v-show="showSearch" class="mb-[10px]">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="query-form">
            <el-form-item label="关键字" prop="name">
              <el-input v-model="queryParams.searchValue" placeholder="输入关键字搜索标题和内容" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="创建时间" style="width: 308px">
              <el-date-picker
                v-model="dateRange"
                value-format="YYYY-MM-DD HH:mm:ss"
                type="daterange"
                range-separator="-"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                :default-time="[new Date(2000, 1, 1, 0, 0, 0), new Date(2000, 1, 1, 23, 59, 59)]"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
              <el-button icon="Refresh" @click="resetQuery">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </div>
    </transition>

    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="table-heading list-heading">
          <h3>笔记列表</h3>
          <p>共 {{ total }} 篇笔记，按目录归类维护。</p>
        </div>
        <el-row :gutter="10" class="mb8">
          <el-col :span="1.5">
            <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['notes:notes:add']">新增</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()" v-hasPermi="['notes:notes:edit']">修改</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="danger" plain icon="Delete" :disabled="multiple" v-hasPermi="['notes:notes:remove']" @click="handleDelete()">删除</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="warning" plain icon="Download" @click="handleExport" v-hasPermi="['notes:notes:export']">导出</el-button>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList" />
        </el-row>
      </template>

      <el-table v-loading="loading" class="data-table" :data="notesList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column label="笔记名" align="left" prop="name" min-width="300" width="auto" />
        <el-table-column label="文件大小" align="center" prop="fileSize" width="150" />
        <el-table-column label="修改时间" align="center" prop="updateTime" width="180" />
        <el-table-column label="操作" align="center" class-name="small-padding fixed-width" width="200">
          <template #default="scope">
            <el-tooltip content="查看笔记" placement="top">
              <el-button link type="primary" icon="View" @click="handleViewOrEdit('preview', scope.row.id)" v-hasPermi="['notes:notes:query']"></el-button>
            </el-tooltip>
            <el-tooltip content="编辑笔记" placement="top">
              <el-button link type="primary" icon="Document" @click="handleViewOrEdit('editor', scope.row.id)" v-hasPermi="['notes:notes:edit']"></el-button>
            </el-tooltip>
            <el-tooltip content="修改笔记名称" placement="top">
              <el-button link icon="Edit" @click="handleUpdate(scope.row as NotesVO)" v-hasPermi="['notes:notes:edit']"></el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button link type="danger" icon="Delete" @click="handleDelete(scope.row as NotesVO)" v-hasPermi="['notes:notes:remove']"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />
    </el-card>

    <!-- 添加或修改笔记对话框 -->
    <el-dialog :title="dialog.title" v-model="dialog.visible" width="500px" @open="handleOpen" @close="handleClose" append-to-body class="app-dialog">
      <template #header>
        <div class="app-dialog-hero">
          <div class="app-dialog-hero__top">
            <img src="@/assets/logo/logo.png" alt="" />
            <span>V5Notes 笔记</span>
          </div>
          <div class="app-dialog-hero__main">
            <div class="app-dialog-hero__icon">{{ (form.name || '笔').slice(0, 1) }}</div>
            <div>
              <div class="app-dialog-hero__name">{{ form.name || dialog.title }}</div>
              <div class="app-dialog-hero__meta"><span>{{ dialog.title }}</span></div>
            </div>
          </div>
        </div>
      </template>

      <el-form ref="notesFormRef" :model="form" :rules="rules" label-position="top" class="app-dialog-form">
        <section class="app-dialog-section">
          <h4>基本信息</h4>
          <el-form-item label="所属目录" prop="dirId">
            <el-tree-select
              v-model="form.dirId"
              :data="dirTreeData"
              value-key="id"
              default-expand-all
              check-strictly
              :render-after-expand="false"
              placeholder="请选择所属目录"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="笔记名" prop="name">
            <el-input v-model="form.name" placeholder="请输入笔记名" />
          </el-form-item>
        </section>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="cancel">取消</el-button>
          <el-button :loading="buttonLoading" type="primary" @click="submitForm">确定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="NotesList" lang="ts">
import { addNotes, delNotes, getNotes, listNotes, updateNotes } from '@/api/notes/notes';
import type { NotesForm, NotesQuery, NotesVO } from '@/api/notes/notes/types';
import { dirTree } from '@/api/notes/directory';
import type { NotesTreeVo } from '@/api/notes/directory/types';
import animateConfig from '@/animate';
import modal from '@/plugins/modal';
import { download } from '@/utils/request';
import { addDateRange } from '@/utils/ruoyi';

const dateRange = ref<any>(['', '']);

const notesList = ref<NotesVO[]>([]);
const buttonLoading = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);

const queryFormRef = ref<ElFormInstance>();
const notesFormRef = ref<ElFormInstance>();

const emit = defineEmits(['clearQuery', 'viewOrEdtor']);

const dialog = reactive<DialogOption>({
  visible: false,
  title: ''
});
const dirTreeData = ref<NotesTreeVo[]>([
  {
    id: 0,
    label: '根节点',
    type: 1
  } as NotesTreeVo
]);

const initFormData: NotesForm = {
  id: undefined,
  userId: undefined,
  name: undefined,
  dirId: undefined,
  content: undefined
};
const data = reactive<PageData<NotesForm, NotesQuery>>({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    searchValue: undefined,
    dirId: undefined,
    params: {}
  },
  rules: {
    name: [{ required: true, message: '笔记名不能为空', trigger: 'blur' }],
    dirId: [{ required: true, message: '所属目录ID不能为空', trigger: 'blur' }]
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询笔记列表 */
const getList = async () => {
  loading.value = true;
  const res = await listNotes(addDateRange(queryParams.value, dateRange.value));
  notesList.value = res.data?.rows ?? [];
  total.value = res.data?.total ?? 0;
  loading.value = false;
};

/** 取消按钮 */
const cancel = () => {
  reset();
  dialog.visible = false;
};

/** 表单重置 */
const reset = () => {
  form.value = { ...initFormData };
  notesFormRef.value?.resetFields();
};

/** 点击外层目录树查询 */
const handleDirIdQuery = (dirId: string | number) => {
  queryParams.value.dirId = dirId;
  handleQuery();
};

/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

/** 重置按钮操作 */
const resetQuery = () => {
  emit('clearQuery');
  dateRange.value = ['', ''];
  queryParams.value.pageNum = 1;
  queryParams.value.searchValue = undefined;
  queryParams.value.dirId = undefined;
  handleQuery();
};

/** 多选框选中数据 */
const handleSelectionChange = (selection: NotesVO[]) => {
  ids.value = selection.map((item) => item.id);
  single.value = selection.length != 1;
  multiple.value = !selection.length;
};

/** 新增按钮操作 */
const handleAdd = () => {
  reset();
  dialog.visible = true;
  dialog.title = '添加笔记';
};

/** 修改按钮操作 */
const handleUpdate = async (row?: NotesVO) => {
  reset();
  const noteId = row?.id || ids.value[0];
  const res = await getNotes(noteId);
  Object.assign(form.value, res.data);
  dialog.visible = true;
  dialog.title = '修改笔记';
};

/** 提交按钮 */
const submitForm = () => {
  notesFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      buttonLoading.value = true;
      if (form.value.id) {
        await updateNotes(form.value).finally(() => (buttonLoading.value = false));
      } else {
        await addNotes(form.value).finally(() => (buttonLoading.value = false));
      }
      modal.msgSuccess('操作成功');
      dialog.visible = false;
      await getList();
    }
  });
};

/** 删除按钮操作 */
const handleDelete = async (row?: NotesVO) => {
  const noteIds = row?.id || ids.value;
  await modal.confirm('是否确认删除笔记编号为"' + noteIds + '"的数据项？').finally(() => (loading.value = false));
  await delNotes(noteIds);
  modal.msgSuccess('删除成功');
  await getList();
};

/** 导出按钮操作 */
const handleExport = () => {
  download(
    'system/notes/export',
    {
      ...queryParams.value
    },
    `notes_${new Date().getTime()}.xlsx`
  );
};

const handleOpen = () => {
  dirTreeList();
};

const handleClose = () => {
  form.value = { ...initFormData };
};

const dirTreeList = async () => {
  const res = await dirTree();
  dirTreeData.value[0].children = res.data;
};

const handleViewOrEdit = (type: string, notesId: number) => {
  emit('viewOrEdtor', { type, notesId });
};

defineExpose({
  handleDirIdQuery
});

onMounted(() => {
  getList();
});
</script>

<style lang="scss" scoped>
.notes-list:hover {
  background-color: #edf2f7;
  font-weight: 700;
}
.va-1 {
  vertical-align: -1px;
}
</style>

<style lang="scss" scoped>
/* 列表头部：标题 + 描述 */
.list-heading {
  margin-bottom: 10px;
}
.list-heading h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #15241e;
}
.list-heading p {
  margin: 4px 0 0;
  font-size: 12.5px;
  color: #5f7067;
  line-height: 1.5;
}
</style>
