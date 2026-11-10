<template>
  <div class="p-2 app-container system-dept-page">
    <div class="search-wrap">
      <el-card shadow="hover" class="search-panel" :class="{ 'is-collapsed': !showSearch }">
        <template #header>
          <div class="panel-heading search-panel-toggle" @click.stop="showSearch = !showSearch">
            <div>
              <span class="panel-kicker">{{ $t('system.dept.searchKicker') }}</span>
              <h3>{{ $t('common.filter') }}</h3>
            </div>
          </div>
        </template>
        <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="query-form">
          <el-form-item :label="$t('system.dept.deptName')" prop="deptName">
            <el-input
              v-model="queryParams.deptName"
              :placeholder="$t('common.pleaseInput', { label: $t('system.dept.deptName') })"
              clearable
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item :label="$t('system.dept.category')" prop="deptCategory">
            <el-input
              v-model="queryParams.deptCategory"
              :placeholder="$t('common.pleaseInput', { label: $t('system.dept.category') })"
              clearable
              style="width: 240px"
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item :label="$t('common.status')" prop="status">
            <el-select v-model="queryParams.status" :placeholder="$t('system.dept.deptStatus')" clearable>
              <el-option v-for="dict in sys_normal_disable" :key="dict.value" :label="dict.label" :value="dict.value" />
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
            <span class="panel-kicker">{{ $t('system.dept.datasetKicker') }}</span>
            <h3>{{ $t('system.dept.listTitle') }}</h3>
            <p>{{ $t('system.dept.listDesc') }}</p>
          </div>
          <div class="toolbar-actions">
            <el-button v-hasPermi="['system:dept:add']" type="primary" plain icon="Plus" @click="handleAdd()">
              {{ $t('common.add') }}
            </el-button>
            <el-button type="info" plain icon="Sort" @click="handleToggleExpandAll">{{ $t('system.dept.expandToggle') }}</el-button>
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList"></right-toolbar>
          </div>
        </div>
      </template>

      <el-table
        ref="deptTableRef"
        v-loading="loading && (deptList).length > 0"
        class="data-table"
        :data="deptList"
        row-key="deptId"
        border
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        :default-expand-all="isExpandAll"
      >
        <el-table-column prop="deptName" :label="$t('system.dept.deptName')" width="260"></el-table-column>
        <el-table-column prop="deptCategory" align="center" :label="$t('system.dept.category')" width="200"></el-table-column>
        <el-table-column prop="orderNum" align="center" :label="$t('system.dept.order')" width="200"></el-table-column>
        <el-table-column prop="status" align="center" :label="$t('common.status')" width="100">
          <template #default="scope">
            <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.createTime')" align="center" prop="createTime" width="160">
          <template #default="scope">
            <span>{{ parseTime(scope.row.createTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column fixed="right" align="center" :label="$t('common.operate')">
          <template #default="scope">
            <el-tooltip :content="$t('common.edit')" placement="top">
              <el-button
                v-hasPermi="['system:dept:edit']"
                link
                type="primary"
                icon="Edit"
                @click="handleUpdate(scope.row)"
              />
            </el-tooltip>
            <el-tooltip :content="$t('common.add')" placement="top">
              <el-button
                v-hasPermi="['system:dept:add']"
                link
                type="primary"
                icon="Plus"
                @click="handleAdd(scope.row)"
              />
            </el-tooltip>
            <el-tooltip :content="$t('common.delete')" placement="top">
              <el-button
                v-hasPermi="['system:dept:remove']"
                link
                type="primary"
                icon="Delete"
                @click="handleDelete(scope.row)"
              />
            </el-tooltip>
          </template>
        </el-table-column>
        <template #empty>
          <table-skeleton v-if="loading" :rows="8" />
          <div v-else class="empty-hint">{{ $t('common.noData') }}</div>
        </template>
      </el-table>
    </el-card>

    <FormDrawer
      v-model="dialog.visible"
      :title="dialog.title"
      :eyebrow="$t('system.dept.eyebrow')"
      :subtitle="$t('system.dept.subtitle')"
      size="680px"
      :submit-text="$t('common.confirm')"
      :hint="$t('system.dept.requiredHint')"
      @submit="submitForm"
      @closed="cancel"
    >
      <template #hero>
        <div class="drawer-hero">
          <div class="drawer-hero__top">
            <span class="drawer-hero__brand"><img :src="logoUrl" alt="" />{{ $t('system.dept.brand') }}</span>
            <span class="drawer-hero__divider">·</span>
            <span class="drawer-hero__action">{{ dialog.title }}</span>
          </div>
          <div class="drawer-hero__profile">
            <div class="drawer-hero__icon">{{ (form.deptName || $t('system.dept.initial')).slice(0, 1) }}</div>
            <div class="drawer-hero__info">
              <div class="drawer-hero__name">{{ form.deptName || $t('system.dept.unnamed') }}</div>
              <div class="drawer-hero__meta">
                <span class="drawer-hero__tag">{{ form.deptCategory || $t('system.dept.shortName') }}</span>
                <span v-if="heroParentName">{{ heroParentName }}</span>
                <span v-else>{{ $t('system.dept.sortStatus', { sort: form.orderNum ?? 0, status: form.status === '0' ? $t('common.normal') : $t('common.disable') }) }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <el-form ref="deptFormRef" :model="form" :rules="rules" label-position="top" class="dept-form">
        <section class="form-section">
          <h4>{{ $t('common.basicInfo') }}</h4>
          <el-row :gutter="18">
            <el-col v-if="form.parentId !== 0" :span="24">
              <el-form-item :label="$t('system.dept.parent')" prop="parentId">
                <el-tree-select
                  v-model="form.parentId"
                  :data="deptOptions"
                  :props="{ value: 'deptId', label: 'deptName', children: 'children' } as any"
                  value-key="deptId"
                  :placeholder="$t('system.dept.selectParent')"
                  check-strictly
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('system.dept.deptName')" prop="deptName">
                <el-input v-model="form.deptName" :placeholder="$t('common.pleaseInput', { label: $t('system.dept.deptName') })" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('system.dept.category')" prop="deptCategory">
                <el-input v-model="form.deptCategory" :placeholder="$t('common.pleaseInput', { label: $t('system.dept.category') })" />
              </el-form-item>
            </el-col>
          </el-row>
        </section>

        <section class="form-section">
          <h4>{{ $t('system.dept.leaderSection') }}</h4>
          <el-row :gutter="18">
            <el-col :span="12">
              <el-form-item :label="$t('system.dept.leader')" prop="leader">
                <el-select v-model="form.leader" :placeholder="$t('common.pleaseSelect', { label: $t('system.dept.leader') })">
                  <el-option
                    v-for="item in deptUserList"
                    :key="item.userId"
                    :label="item.userName"
                    :value="item.userId"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('system.dept.phone')" prop="phone">
                <el-input v-model="form.phone" :placeholder="$t('common.pleaseInput', { label: $t('system.dept.phone') })" maxlength="11" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('system.dept.email')" prop="email">
                <el-input v-model="form.email" :placeholder="$t('common.pleaseInput', { label: $t('system.dept.email') })" maxlength="50" />
              </el-form-item>
            </el-col>
          </el-row>
        </section>

        <section class="form-section">
          <h4>{{ $t('system.dept.displaySection') }}</h4>
          <el-row :gutter="18">
            <el-col :span="12">
              <el-form-item :label="$t('system.dept.displaySort')" prop="orderNum">
                <el-input-number v-model="form.orderNum" controls-position="right" :min="0" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('system.dept.deptStatus')">
                <el-radio-group v-model="form.status">
                  <el-radio v-for="dict in sys_normal_disable" :key="dict.value" :value="dict.value">
                    {{ dict.label }}
                  </el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
          </el-row>
        </section>
      </el-form>
    </FormDrawer>
  </div>
</template>

<script setup name="Dept" lang="ts">
import TableSkeleton from '@/components/Skeleton/TableSkeleton.vue';
import { listDept, getDept, delDept, addDept, updateDept, listDeptExcludeChild } from '@/api/system/dept';
import { DeptForm, DeptQuery, DeptVO } from '@/api/system/dept/types';
import { listUserByDeptId } from '@/api/system/user';
import { UserVO } from '@/api/system/user/types';
import { useLoading } from '@/hooks/async/useLoading';
import { useDialogState } from '@/hooks/dialog/useDialogState';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import { useTreeTableExpand } from '@/hooks/tree/useTreeTableExpand';
import modal from '@/plugins/modal';
import { useDict } from '@/utils/dict';
import { handleTree, parseTime } from '@/utils/ruoyi';
import FormDrawer from '@/components/FormDrawer/index.vue';
import logoUrl from '@/assets/logo/logo.png';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

interface DeptOptionsType {
  deptId: number | string;
  deptName: string;
  children: DeptOptionsType[];
}

const { sys_normal_disable } = toRefs<any>(useDict('sys_normal_disable'));

const deptList = ref<DeptVO[]>([]);
const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();
const deptOptions = ref<DeptOptionsType[]>([]);
const deptUserList = ref<UserVO[]>([]);

const deptTableRef = ref<ElTableInstance>();
const queryFormRef = ref<ElFormInstance>();
const deptFormRef = ref<ElFormInstance>();
const { isExpandAll, handleToggleExpandAll } = useTreeTableExpand<DeptVO>({
  tableRef: deptTableRef,
  data: deptList
});

const initFormData: DeptForm = {
  deptId: undefined,
  parentId: undefined,
  deptName: undefined,
  deptCategory: undefined,
  orderNum: 0,
  leader: undefined,
  phone: undefined,
  email: undefined,
  status: '0'
};
const initData: PageData<DeptForm, DeptQuery> = {
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    deptName: undefined,
    deptCategory: undefined,
    status: undefined
  },
  rules: {}
};
const data = reactive<PageData<DeptForm, DeptQuery>>(initData);

const { queryParams, form } = toRefs<PageData<DeptForm, DeptQuery>>(data);
const rules = computed<ElFormRules>(() => ({
  parentId: [{ required: true, message: t('system.dept.required', { label: t('system.dept.parent') }), trigger: 'blur' }],
  deptName: [{ required: true, message: t('system.dept.required', { label: t('system.dept.deptName') }), trigger: 'blur' }],
  orderNum: [{ required: true, message: t('system.dept.required', { label: t('system.dept.displaySort') }), trigger: 'blur' }],
  email: [
    {
      type: 'email',
      message: t('system.user.emailInvalid'),
      trigger: ['blur', 'change']
    }
  ],
  phone: [
    {
      pattern: /^1[3456789][0-9]\d{8}$/,
      message: t('system.user.phoneInvalid'),
      trigger: 'blur'
    }
  ]
}));
const { dialog, openDialog, closeDialog, setTitle } = useDialogState();

/** 抽屉 hero 的上级部门名称（优先从部门树反查，回退到 parentName） */
const heroParentName = computed(() => {
  const parentId = form.value.parentId;
  if (parentId === undefined || parentId === null || parentId === 0) return '';
  const findName = (nodes: DeptOptionsType[]): string => {
    for (const node of nodes) {
      if (String(node.deptId) === String(parentId)) return node.deptName;
      const childName = findName(node.children || []);
      if (childName) return childName;
    }
    return '';
  };
  return findName(deptOptions.value) || form.value.parentName || '';
});

/** 查询菜单列表 */
const getList = async () => {
  await withLoading(async () => {
    const res = await listDept(queryParams.value);
    const data = handleTree<DeptVO>(res.data, 'deptId');
    if (data) {
      deptList.value = data;
    }
  });
};

/** 查询当前部门的所有用户 */
async function getDeptAllUser(deptId: any) {
  if (deptId !== null && deptId !== '' && deptId !== undefined) {
    const res = await listUserByDeptId(deptId);
    deptUserList.value = res.data;
  }
}

/** 取消按钮 */
const cancel = () => {
  reset();
  closeDialog();
};
/** 表单重置 */
const reset = () => {
  form.value = { ...initFormData };
  deptFormRef.value?.resetFields();
};

/** 搜索按钮操作 */
const handleQuery = () => {
  getList();
};
const { resetQuery } = useSearchReset({
  queryFormRef,
  queryParams,
  afterReset: () => {
    handleQuery();
  }
});

/** 新增按钮操作 */
const handleAdd = async (row?: Partial<DeptVO>) => {
  reset();
  const res = await listDept();
  const data = handleTree<DeptOptionsType>(res.data, 'deptId');
  if (data) {
    deptOptions.value = data;
    if (row && row.deptId) {
      form.value.parentId = row?.deptId;
    }
    setTitle(t('system.dept.addTitle'));
    openDialog();
  }
};

/** 修改按钮操作 */
const handleUpdate = async (row: Partial<DeptVO>) => {
  reset();
  //查询当前部门所有用户
  getDeptAllUser(row.deptId);
  const res = await getDept(row.deptId);
  form.value = res.data;
  const response = await listDeptExcludeChild(row.deptId);
  const data = handleTree<DeptOptionsType>(response.data, 'deptId');
  if (data) {
    deptOptions.value = data;
    if (data.length === 0) {
      const noResultsOptions: DeptOptionsType = {
        deptId: res.data.parentId,
        deptName: res.data.parentName,
        children: []
      };
      deptOptions.value.push(noResultsOptions);
    }
  }
  setTitle(t('system.dept.editTitle'));
  openDialog();
};
/** 提交按钮 */
const submitForm = () => {
  deptFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      form.value.deptId ? await updateDept(form.value) : await addDept(form.value);
      modal.msgSuccess(t('common.actionSuccess'));
      closeDialog();
      await getList();
    }
  });
};
/** 删除按钮操作 */
const handleDelete = async (row: Partial<DeptVO>) => {
  await modal.confirm(t('system.dept.confirmDelete', { name: row.deptName }));
  await delDept(row.deptId);
  await getList();
  modal.msgSuccess(t('common.deleteSuccess'));
};

onMounted(() => {
  getList();
});
</script>

<style lang="scss" scoped>
@use '@/assets/styles/components/page-shell' as pageShell;

@include pageShell.table-crud-page;
</style>

<style lang="scss" scoped>
.dept-form :deep(.el-form-item) {
  margin-bottom: 16px;
}
.dept-form :deep(.el-form-item__label) {
  padding-bottom: 6px;
  line-height: 1.3;
  font-size: 12.5px;
  font-weight: 600;
  color: #3f4a44;
}
.dept-form :deep(.el-input__wrapper),
.dept-form :deep(.el-select__wrapper),
.dept-form :deep(.el-textarea__inner) {
  border-radius: 10px;
}
.dept-form :deep(.el-form-item__content) {
  min-width: 0;
}
.form-section {
  padding: 0 0 15px;
  margin-bottom: 18px;
  border-bottom: 1px solid #edf0ef;
}
.form-section:last-child {
  padding-bottom: 0;
  margin-bottom: 0;
  border-bottom: 0;
}
.form-section h4 {
  margin: 0 0 13px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #6b7d74;
}
</style>

<style lang="scss" scoped>
.drawer-hero {
  position: relative;
  overflow: hidden;
  padding: 24px 28px 24px;
  color: #fff;
  background: linear-gradient(148deg, #0f3d33 0%, #1c5a48 70%, #256a55 100%);
}
.drawer-hero::after {
  content: '';
  position: absolute;
  top: -130px;
  right: -90px;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
}
.drawer-hero__top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 44px;
  font-size: 12px;
  font-weight: 700;
  color: #dff1e8;
  letter-spacing: 0.02em;
}
.drawer-hero__brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.drawer-hero__brand img {
  width: 22px;
  height: 22px;
  border-radius: 6px;
}
.drawer-hero__divider {
  color: rgba(223, 241, 232, 0.5);
}
.drawer-hero__action {
  color: #c9e4d7;
}
.drawer-hero__profile {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 15px;
  margin-top: 22px;
}
.drawer-hero__icon {
  width: 58px;
  height: 58px;
  flex: none;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.16);
  font-size: 22px;
  font-weight: 700;
  color: #fff;
}
.drawer-hero__name {
  margin-bottom: 7px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.drawer-hero__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #c9e4d7;
}
.drawer-hero__tag {
  padding: 4px 9px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  color: #eafff5;
  font-size: 11.5px;
  font-weight: 700;
}
</style>
