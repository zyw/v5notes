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
          <el-form-item :label="$t('notes.list.keyword')" prop="name">
            <el-input v-model="queryParams.searchValue" :placeholder="$t('notes.list.keywordPh')" clearable @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item :label="$t('common.createTime')" style="width: 308px">
            <el-date-picker
              v-model="dateRange"
              value-format="YYYY-MM-DD HH:mm:ss"
              type="daterange"
              range-separator="-"
              :start-placeholder="$t('common.startDate')"
              :end-placeholder="$t('common.endDate')"
              :default-time="[new Date(2000, 1, 1, 0, 0, 0), new Date(2000, 1, 1, 23, 59, 59)]"
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
            <span class="panel-kicker">{{ $t('notes.list.dataset') }}</span>
            <h3>{{ $t('notes.list.title') }}</h3>
            <p>{{ $t('notes.list.listDesc', { total }) }}</p>
          </div>
          <div class="toolbar-actions">
            <el-button type="primary" plain icon="Plus" :disabled="!queryParams.userId" @click="handleAdd" v-hasPermi="['notes:notes:add']">{{ $t('common.add') }}</el-button>
            <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()" v-hasPermi="['notes:notes:edit']">{{ $t('common.edit') }}</el-button>
            <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()" v-hasPermi="['notes:notes:remove']">{{ $t('common.delete') }}</el-button>
            <el-button type="warning" plain icon="Download" @click="handleExport" v-hasPermi="['notes:notes:export']">{{ $t('common.export') }}</el-button>
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList" />
          </div>
        </div>
      </template>

      <error-state
        v-if="errorInfo"
        :kind="errorInfo.kind"
        :title="errorInfo.title"
        :message="errorInfo.message"
        @retry="getList"
      />
      <el-table v-else v-loading="loading && (notesList).length > 0" class="data-table" :data="notesList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column :label="$t('notes.list.name')" align="left" prop="name" min-width="220" width="auto" />
        <el-table-column :label="$t('notes.owner')" align="center" prop="userName" width="140" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('notes.list.fileSize')" align="center" prop="fileSize" width="120" />
        <el-table-column :label="$t('notes.list.modifiedAt')" align="center" prop="updateTime" width="180" />
        <el-table-column :label="$t('common.operate')" align="center" class-name="small-padding fixed-width" width="240">
          <template #default="scope">
            <el-tooltip :content="$t('notes.list.view')" placement="top">
              <el-button link type="primary" icon="View" @click="handleViewOrEdit('preview', scope.row.id)" v-hasPermi="['notes:notes:query']"></el-button>
            </el-tooltip>
            <el-tooltip :content="$t('notes.history.title')" placement="top">
              <el-button link type="primary" icon="Clock" @click="openHistory(scope.row as NotesVO)" v-hasPermi="['notes:notes:query']"></el-button>
            </el-tooltip>
            <el-tooltip :content="$t('notes.list.edit')" placement="top">
              <el-button link type="primary" icon="Document" @click="handleViewOrEdit('editor', scope.row.id)" v-hasPermi="['notes:notes:edit']"></el-button>
            </el-tooltip>
            <el-tooltip :content="$t('notes.list.rename')" placement="top">
              <el-button link icon="Edit" @click="handleUpdate(scope.row as NotesVO)" v-hasPermi="['notes:notes:edit']"></el-button>
            </el-tooltip>
            <el-tooltip :content="$t('common.delete')" placement="top">
              <el-button link type="danger" icon="Delete" @click="handleDelete(scope.row as NotesVO)" v-hasPermi="['notes:notes:remove']"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
        <template #empty>
          <table-skeleton v-if="loading" :rows="8" />
          <div v-else class="empty-hint">{{ $t('common.noData') }}</div>
        </template>
      </el-table>

      <pagination v-show="total > 0 && !errorInfo" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />
    </el-card>

    <!-- 添加或修改笔记对话框 -->
    <el-dialog :title="dialog.title" v-model="dialog.visible" width="500px" @open="handleOpen" @close="handleClose" append-to-body class="app-dialog">
      <template #header>
        <div class="app-dialog-hero">
          <div class="app-dialog-hero__top">
            <img src="@/assets/logo/logo.png" alt="" />
            <span>{{ $t('notes.list.brand') }}</span>
          </div>
          <div class="app-dialog-hero__main">
            <div class="app-dialog-hero__icon">{{ (form.name || $t('notes.glyph')).slice(0, 1) }}</div>
            <div>
              <div class="app-dialog-hero__name">{{ form.name || dialog.title }}</div>
              <div class="app-dialog-hero__meta"><span>{{ dialog.title }}</span></div>
            </div>
          </div>
        </div>
      </template>

      <el-form ref="notesFormRef" :model="form" :rules="rules" label-position="top" class="app-dialog-form">
        <section class="app-dialog-section">
          <h4>{{ $t('common.basicInfo') }}</h4>
          <el-form-item :label="$t('notes.dir.parent')" prop="dirId">
            <el-tree-select
              v-model="form.dirId"
              :data="dirTreeData"
              value-key="id"
              default-expand-all
              check-strictly
              :render-after-expand="false"
              :placeholder="$t('common.pleaseSelect', { label: $t('notes.dir.parent') })"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item :label="$t('notes.list.name')" prop="name">
            <el-input v-model="form.name" :placeholder="$t('common.pleaseInput', { label: $t('notes.list.name') })" />
          </el-form-item>
        </section>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="cancel">{{ $t('common.cancel') }}</el-button>
          <submit-button :loading="buttonLoading" type="primary" @click="submitForm">{{ $t('common.confirm') }}</submit-button>
        </div>
      </template>
    </el-dialog>
    <note-history-drawer v-if="historyVisible" v-model="historyVisible" :note-id="historyNoteId" :note-name="historyNoteName" @restored="getList" />
  </div>
</template>

<script setup name="NotesList" lang="ts">
import { useI18n } from 'vue-i18n';
import TableSkeleton from '@/components/Skeleton/TableSkeleton.vue';
import SubmitButton from '@/components/Loading/SubmitButton.vue';
import ErrorState from '@/components/ErrorState/ErrorState.vue';
import { classifyRequestError } from '@/utils/errorKind';
import type { ErrorInfo } from '@/utils/errorKind';
import { addNotes, delNotes, getNotes, listNotes, updateNotes } from '@/api/notes/notes';
import type { NotesForm, NotesQuery, NotesVO } from '@/api/notes/notes/types';
import NoteHistoryDrawer from '@/views/notes/notes/history-drawer.vue';
import { dirTree } from '@/api/notes/directory';
import type { NotesTreeVo } from '@/api/notes/directory/types';
import modal from '@/plugins/modal';
import { download } from '@/utils/request';
import { addDateRange } from '@/utils/ruoyi';

const { t } = useI18n();

const dateRange = ref<any>(['', '']);

const notesList = ref<NotesVO[]>([]);
const buttonLoading = ref(false);
const loading = ref(true);
const errorInfo = ref<ErrorInfo | null>(null);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const historyVisible = ref(false);
const historyNoteId = ref<string | number>();
const historyNoteName = ref('');

const queryFormRef = ref<ElFormInstance>();
const notesFormRef = ref<ElFormInstance>();

const props = defineProps<{
  /** 左侧树选中的所属用户，列表与新增归属均按此隔离 */
  ownerUserId?: string | number;
}>();

const emit = defineEmits<{
  clearQuery: [];
  viewOrEdtor: [info: { type: string; notesId: string | number }];
}>();

const dialog = reactive<DialogOption>({
  visible: false,
  title: ''
});
const dirTreeData = ref<NotesTreeVo[]>([
  {
    id: 0,
    label: '',
    type: 1
  } as NotesTreeVo
]);

watchEffect(() => {
  dirTreeData.value[0].label = t('notes.dir.root');
});

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
    userId: undefined,
    dirId: undefined,
    params: {}
  },
  rules: {}
});

const { queryParams, form } = toRefs(data);

const rules = computed<ElFormRules>(() => ({
  name: [{ required: true, message: t('notes.list.nameRequired'), trigger: 'blur' }],
  dirId: [{ required: true, message: t('notes.list.dirRequired'), trigger: 'blur' }]
}));

const openHistory = (row: NotesVO) => {
  historyNoteId.value = row.id;
  historyNoteName.value = row.name;
  historyVisible.value = true;
};

/** 查询笔记列表 */
const getList = async () => {
  loading.value = true;
  errorInfo.value = null;
  try {
    const res = await listNotes(addDateRange(queryParams.value, dateRange.value));
    notesList.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } catch (e) {
    errorInfo.value = classifyRequestError(e);
  } finally {
    loading.value = false;
  }
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

/** 左侧切换所属账号后同步列表范围 */
const applyOwner = (userId?: string | number) => {
  queryParams.value.userId = userId;
  queryParams.value.dirId = undefined;
  queryParams.value.pageNum = 1;
  emit('clearQuery');
  if (userId == null || userId === '') {
    notesList.value = [];
    total.value = 0;
    loading.value = false;
    errorInfo.value = null;
    return;
  }
  getList();
};

/** 点击外层目录树查询 */
const handleDirIdQuery = (dirId: string | number) => {
  queryParams.value.dirId = dirId;
  handleQuery();
};

/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.value.pageNum = 1;
  if (queryParams.value.userId == null || queryParams.value.userId === '') {
    notesList.value = [];
    total.value = 0;
    return;
  }
  getList();
};

/** 重置按钮操作 */
const resetQuery = () => {
  emit('clearQuery');
  dateRange.value = ['', ''];
  queryParams.value.pageNum = 1;
  queryParams.value.searchValue = undefined;
  queryParams.value.dirId = undefined;
  // 所属账号由左侧树控制，重置时不清除
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
  form.value.userId = queryParams.value.userId ?? props.ownerUserId;
  dialog.visible = true;
  dialog.title = t('notes.list.addTitle');
};

/** 修改按钮操作 */
const handleUpdate = async (row?: NotesVO) => {
  reset();
  const noteId = row?.id || ids.value[0];
  const res = await getNotes(noteId);
  Object.assign(form.value, res.data);
  dialog.visible = true;
  dialog.title = t('notes.list.editTitle');
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
      modal.msgSuccess(t('common.actionSuccess'));
      dialog.visible = false;
      await getList();
    }
  });
};

/** 删除按钮操作 */
const handleDelete = async (row?: NotesVO) => {
  const noteIds = row?.id || ids.value;
  await modal.confirm(t('notes.list.deleteConfirm', { ids: noteIds })).finally(() => (loading.value = false));
  await delNotes(noteIds);
  modal.msgSuccess(t('common.deleteSuccess'));
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
  const ownerId = queryParams.value.userId ?? props.ownerUserId;
  if (ownerId == null || ownerId === '') {
    dirTreeData.value[0].children = [];
    return;
  }
  const res = await dirTree({ userId: ownerId });
  dirTreeData.value[0].children = res.data;
};

const handleViewOrEdit = (type: string, notesId: number) => {
  emit('viewOrEdtor', { type, notesId });
};

defineExpose({
  handleDirIdQuery,
  applyOwner
});

onMounted(() => {
  // 首屏由父组件在选好所属账号后调用 applyOwner，避免先拉全库再刷新
  if (props.ownerUserId != null && props.ownerUserId !== '') {
    applyOwner(props.ownerUserId);
  } else {
    loading.value = false;
  }
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
