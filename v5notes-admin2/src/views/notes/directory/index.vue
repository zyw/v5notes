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
          <el-form-item :label="$t('notes.owner')" prop="userId">
            <el-select
              v-model="queryParams.userId"
              filterable
              clearable
              :loading="ownerLoading"
              :placeholder="$t('common.pleaseSelect', { label: $t('notes.ownerAccount') })"
              style="width: 220px"
              @change="handleOwnerChange"
            >
              <el-option
                v-for="item in ownerOptions"
                :key="item.userId"
                :label="ownerLabel(item)"
                :value="item.userId"
              />
            </el-select>
          </el-form-item>
          <el-form-item :label="$t('notes.dir.parent')" prop="pid">
            <el-tree-select
              v-model="queryParams.pid"
              :data="dirTreeData"
              value-key="id"
              default-expand-all
              check-strictly
              :render-after-expand="false"
              :placeholder="$t('common.pleaseSelect', { label: $t('notes.dir.parent') })"
            />
          </el-form-item>
          <el-form-item :label="$t('notes.dir.name')" prop="name">
            <el-input v-model="queryParams.name" :placeholder="$t('common.pleaseInput', { label: $t('notes.dir.name') })" clearable @keyup.enter="handleQuery" />
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
            <span class="panel-kicker">{{ $t('notes.dir.dataset') }}</span>
            <h3>{{ $t('notes.dir.listTitle') }}</h3>
            <p>{{ $t('notes.dir.listDesc', { total }) }}</p>
          </div>
          <div class="toolbar-actions">
            <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['system:directory:add']">{{ $t('common.add') }}</el-button>
            <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()" v-hasPermi="['system:directory:edit']">{{ $t('common.edit') }}</el-button>
            <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()" v-hasPermi="['system:directory:remove']">{{ $t('common.delete') }}</el-button>
            <el-button type="warning" plain icon="Download" @click="handleExport" v-hasPermi="['system:directory:export']">{{ $t('common.export') }}</el-button>
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
      <el-table v-else v-loading="loading && (directoryList).length > 0" class="data-table" :data="directoryList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column label="ID" align="center" prop="id" v-if="true" />
        <el-table-column :label="$t('notes.dir.name')" align="center" prop="name" />
        <el-table-column :label="$t('notes.owner')" align="center" prop="userName" width="140" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('common.description')" align="center" prop="descr" />
        <el-table-column :label="$t('common.createTime')" align="center" prop="createTime" width="180">
          <template #default="scope">
            <span>{{ parseTime(scope.row.createTime, '{y}-{m}-{d}') }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.operate')" align="center" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip :content="$t('common.edit')" placement="top">
              <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row as DirectoryVO)" v-hasPermi="['system:directory:edit']"></el-button>
            </el-tooltip>
            <el-tooltip :content="$t('common.delete')" placement="top">
              <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row as DirectoryVO)" v-hasPermi="['system:directory:remove']"></el-button>
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

    <!-- 添加或修改目录对话框 -->
    <el-dialog :title="dialog.title" v-model="dialog.visible" width="500px" append-to-body class="app-dialog">
      <template #header>
        <div class="app-dialog-hero">
          <div class="app-dialog-hero__top">
            <img src="@/assets/logo/logo.png" alt="" />
            <span>{{ $t('notes.dir.brand') }}</span>
          </div>
          <div class="app-dialog-hero__main">
            <div class="app-dialog-hero__icon">{{ (form.name || $t('notes.directory')).slice(0, 1) }}</div>
            <div>
              <div class="app-dialog-hero__name">{{ form.name || dialog.title }}</div>
              <div class="app-dialog-hero__meta"><span>{{ dialog.title }}</span></div>
            </div>
          </div>
        </div>
      </template>

      <el-form ref="directoryFormRef" :model="form" :rules="rules" label-position="top" class="app-dialog-form">
        <section class="app-dialog-section">
          <h4>{{ $t('common.basicInfo') }}</h4>
          <el-form-item :label="$t('notes.dir.parent')" prop="pid">
            <el-tree-select
              v-model="form.pid"
              :data="dirTreeData"
              value-key="id"
              default-expand-all
              check-strictly
              :render-after-expand="false"
              :placeholder="$t('common.pleaseSelect', { label: $t('notes.dir.parent') })"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item :label="$t('notes.dir.name')" prop="name">
            <el-input v-model="form.name" :placeholder="$t('common.pleaseInput', { label: $t('notes.dir.name') })" />
          </el-form-item>
        </section>
        <section class="app-dialog-section">
          <h4>{{ $t('common.description') }}</h4>
          <el-form-item :label="$t('common.description')" prop="descr">
            <el-input v-model="form.descr" :placeholder="$t('common.pleaseInput', { label: $t('common.description') })" type="textarea" :rows="3" />
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
  </div>
</template>

<script setup name="Directory" lang="ts">
import { useI18n } from 'vue-i18n';
import TableSkeleton from '@/components/Skeleton/TableSkeleton.vue';
import SubmitButton from '@/components/Loading/SubmitButton.vue';
import ErrorState from '@/components/ErrorState/ErrorState.vue';
import { classifyRequestError } from '@/utils/errorKind';
import type { ErrorInfo } from '@/utils/errorKind';
import { useClientOwnerOptions } from '@/composables/useClientOwnerOptions';
import { addDirectory, delDirectory, dirTree, getDirectory, listDirectory, updateDirectory } from '@/api/notes/directory';
import type { DirectoryForm, DirectoryQuery, DirectoryVO, NotesTreeVo } from '@/api/notes/directory/types';
import modal from '@/plugins/modal';
import { download } from '@/utils/request';
import { addDateRange, parseTime } from '@/utils/ruoyi';

const { t } = useI18n();
const { ownerOptions, ownerLoading, ownerLabel, loadOwnerOptions } = useClientOwnerOptions();

const dateRange = ref<any>(['', '']);

const directoryList = ref<DirectoryVO[]>([]);
const buttonLoading = ref(false);
const loading = ref(true);
const errorInfo = ref<ErrorInfo | null>(null);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);

const queryFormRef = ref<ElFormInstance>();
const directoryFormRef = ref<ElFormInstance>();

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

const initFormData: DirectoryForm = {
  id: undefined,
  userId: undefined,
  name: undefined,
  pid: undefined,
  descr: undefined
};
const data = reactive<PageData<DirectoryForm, DirectoryQuery>>({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    name: undefined,
    userId: undefined,
    pid: undefined,
    params: {}
  },
  rules: {}
});

const { queryParams, form } = toRefs(data);

const rules = computed<ElFormRules>(() => ({
  name: [{ required: true, message: t('notes.dir.nameRequired'), trigger: 'blur' }],
  pid: [{ required: true, message: t('notes.dir.parentRequired'), trigger: 'blur' }]
}));

/** 查询目录列表 */
const getList = async () => {
  loading.value = true;
  errorInfo.value = null;
  try {
    const res = await listDirectory(addDateRange(queryParams.value, dateRange.value));
    directoryList.value = res.data?.rows ?? [];
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
  directoryFormRef.value?.resetFields();
};

/** 切换所属账号后清空父目录条件，避免跨用户残留 */
const handleOwnerChange = () => {
  queryParams.value.pid = undefined;
};

/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.value.pageNum = 1;
  dirTreeList();
  getList();
};

/** 重置按钮操作 */
const resetQuery = () => {
  dateRange.value = ['', ''];
  queryParams.value.pageNum = 1;
  queryFormRef.value?.resetFields();
  handleQuery();
};

/** 多选框选中数据 */
const handleSelectionChange = (selection: DirectoryVO[]) => {
  ids.value = selection.map((item) => item.id);
  single.value = selection.length != 1;
  multiple.value = !selection.length;
};

/** 新增按钮操作 */
const handleAdd = () => {
  reset();
  form.value.userId = queryParams.value.userId;
  dialog.visible = true;
  dialog.title = t('notes.dir.addTitle');
};

/** 修改按钮操作 */
const handleUpdate = async (row?: DirectoryVO) => {
  reset();
  const dirId = row?.id || ids.value[0];
  const res = await getDirectory(dirId);
  Object.assign(form.value, res.data);
  dialog.visible = true;
  dialog.title = t('notes.dir.editTitle');
};

/** 提交按钮 */
const submitForm = () => {
  directoryFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      buttonLoading.value = true;
      if (form.value.id) {
        await updateDirectory(form.value).finally(() => (buttonLoading.value = false));
      } else {
        await addDirectory(form.value).finally(() => (buttonLoading.value = false));
      }
      modal.msgSuccess(t('common.actionSuccess'));
      dialog.visible = false;
      await getList();
    }
  });
};

/** 删除按钮操作 */
const handleDelete = async (row?: DirectoryVO) => {
  const dirIds = row?.id || ids.value;
  await modal.confirm(t('notes.dir.deleteConfirm', { ids: dirIds })).finally(() => (loading.value = false));
  await delDirectory(dirIds);
  modal.msgSuccess(t('common.deleteSuccess'));
  await getList();
};

/** 导出按钮操作 */
const handleExport = () => {
  download('system/directory/export', {
    ...queryParams.value
  }, `directory_${new Date().getTime()}.xlsx`);
};

const dirTreeList = async () => {
  const res = await dirTree({
    userId: queryParams.value.userId
  });
  dirTreeData.value[0].children = res.data;
};

onMounted(async () => {
  await loadOwnerOptions();
  dirTreeList();
  getList();
});
</script>

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
