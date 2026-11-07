<template>
  <div class="p-2 app-container system-post-page">
    <el-row :gutter="20" class="content-grid">
      <!-- 部门树 -->
      <tree-panel
        ref="treePanelRef"
        v-model:collapsed="treeCollapsed"
        title="部门结构"
        placeholder="请输入部门名称"
        :data="deptOptions"
        :expanded-span="5"
        @node-click="handleNodeClick"
      />
      <el-col
        :lg="treeCollapsed ? 23 : 19"
        :xs="24"
        class="tree-content-col content-main"
        :class="{ 'is-tree-collapsed': treeCollapsed }"
      >
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
              <el-form-item label="岗位编码" prop="postCode">
                <el-input
                  v-model="queryParams.postCode"
                  placeholder="请输入岗位编码"
                  clearable
                  @keyup.enter="handleQuery"
                />
              </el-form-item>
              <el-form-item label="类别编码" prop="postCategory">
                <el-input
                  v-model="queryParams.postCategory"
                  placeholder="请输入类别编码"
                  clearable
                  style="width: 200px"
                  @keyup.enter="handleQuery"
                />
              </el-form-item>
              <el-form-item label="岗位名称" prop="postName">
                <el-input
                  v-model="queryParams.postName"
                  placeholder="请输入岗位名称"
                  clearable
                  @keyup.enter="handleQuery"
                />
              </el-form-item>
              <el-form-item label="部门" prop="deptId">
                <el-tree-select
                  v-model="queryParams.deptId"
                  :data="deptOptions"
                  :props="{ value: 'id', label: 'label', children: 'children' } as any"
                  value-key="id"
                  placeholder="请选择部门"
                  check-strictly
                />
              </el-form-item>
              <el-form-item label="状态" prop="status">
                <el-select v-model="queryParams.status" placeholder="岗位状态" clearable>
                  <el-option
                    v-for="dict in sys_normal_disable"
                    :key="dict.value"
                    :label="dict.label"
                    :value="dict.value"
                  />
                </el-select>
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
                <span class="panel-kicker">Post Dataset</span>
                <h3>岗位列表</h3>
                <p>共 {{ total }} 条记录，支持按部门筛选、岗位维护和导出。</p>
              </div>
              <div class="toolbar-actions">
                <el-button v-hasPermi="['system:post:add']" type="primary" plain icon="Plus" @click="handleAdd">
                  新增
                </el-button>
                <el-button
                  v-hasPermi="['system:post:edit']"
                  type="success"
                  plain
                  icon="Edit"
                  :disabled="single"
                  @click="handleUpdate()"
                >
                  修改
                </el-button>
                <el-button
                  v-hasPermi="['system:post:remove']"
                  type="danger"
                  plain
                  icon="Delete"
                  :disabled="multiple"
                  @click="handleDelete()"
                >
                  删除
                </el-button>
                <el-button
                  v-hasPermi="['system:post:export']"
                  type="warning"
                  plain
                  icon="Download"
                  @click="handleExport"
                >
                  导出
                </el-button>
                <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList"></right-toolbar>
              </div>
            </div>
          </template>
          <el-table
            v-loading="loading && (postList).length > 0"
            border
            class="data-table"
            :data="postList"
            @selection-change="handleSelectionChange"
          >
            <el-table-column type="selection" width="55" align="center" />
            <el-table-column v-if="false" label="岗位编号" align="center" prop="postId" />
            <el-table-column label="岗位编码" align="center" prop="postCode" />
            <el-table-column label="类别编码" align="center" prop="postCategory" />
            <el-table-column label="岗位名称" align="center" prop="postName" />
            <el-table-column label="部门" align="center" prop="deptName" />
            <el-table-column label="排序" align="center" prop="postSort" />
            <el-table-column label="状态" align="center" prop="status">
              <template #default="scope">
                <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
              </template>
            </el-table-column>
            <el-table-column label="创建时间" align="center" prop="createTime" width="180">
              <template #default="scope">
                <span>{{ parseTime(scope.row.createTime) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180" align="center" class-name="small-padding fixed-width">
              <template #default="scope">
                <el-tooltip content="修改" placement="top">
                  <el-button
                    v-hasPermi="['system:post:edit']"
                    link
                    type="primary"
                    icon="Edit"
                    @click="handleUpdate(scope.row)"
                  ></el-button>
                </el-tooltip>
                <el-tooltip content="删除" placement="top">
                  <el-button
                    v-hasPermi="['system:post:remove']"
                    link
                    type="primary"
                    icon="Delete"
                    @click="handleDelete(scope.row)"
                  ></el-button>
                </el-tooltip>
              </template>
            </el-table-column>
            <template #empty>
              <table-skeleton v-if="loading" :rows="8" />
              <div v-else class="empty-hint">暂无数据</div>
            </template>
          </el-table>

          <pagination
            v-show="total > 0"
            v-model:page="queryParams.pageNum"
            v-model:limit="queryParams.pageSize"
            :total="total"
            @pagination="getList"
          />
        </el-card>

        <!-- 添加或修改岗位抽屉 -->
        <FormDrawer
          v-model="dialog.visible"
          :title="dialog.title"
          eyebrow="岗位配置"
          subtitle="配置岗位名称、编码、所属部门与显示状态"
          size="680px"
          submit-text="确定"
          hint="带 * 为必填项，保存后立即生效"
          @submit="submitForm"
          @closed="cancel"
        >
          <template #hero>
            <div class="drawer-hero">
              <div class="drawer-hero__top">
                <span class="drawer-hero__brand"><img :src="logoUrl" alt="" />V5Notes · 岗位</span>
                <span class="drawer-hero__divider">·</span>
                <span class="drawer-hero__action">{{ dialog.title }}</span>
              </div>
              <div class="drawer-hero__profile">
                <div class="drawer-hero__icon">{{ (form.postName || '岗').trim().slice(0, 1) }}</div>
                <div class="drawer-hero__info">
                  <div class="drawer-hero__name">{{ form.postName || '未命名岗位' }}</div>
                  <div class="drawer-hero__meta">
                    <span class="drawer-hero__tag">{{ postStatusLabel }}</span>
                    <span v-if="form.postCode">{{ form.postCode }}</span>
                    <span v-else>未设置编码</span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <el-form ref="postFormRef" :model="form" :rules="rules" label-position="top" class="post-form">
            <section class="form-section">
              <h4>基本信息</h4>
              <el-row :gutter="18">
                <el-col :span="12">
                  <el-form-item label="岗位名称" prop="postName">
                    <el-input v-model="form.postName" placeholder="请输入岗位名称" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="岗位编码" prop="postCode">
                    <el-input v-model="form.postCode" placeholder="请输入编码名称" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="部门" prop="deptId">
                    <el-tree-select
                      v-model="form.deptId"
                      :data="deptOptions"
                      :props="{ value: 'id', label: 'label', children: 'children' } as any"
                      value-key="id"
                      placeholder="请选择部门"
                      check-strictly
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="类别编码" prop="postCategory">
                    <el-input v-model="form.postCategory" placeholder="请输入类别编码" />
                  </el-form-item>
                </el-col>
              </el-row>
            </section>

            <section class="form-section">
              <h4>排序与状态</h4>
              <el-row :gutter="18">
                <el-col :span="12">
                  <el-form-item label="岗位顺序" prop="postSort">
                    <el-input-number v-model="form.postSort" controls-position="right" :min="0" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="岗位状态" prop="status">
                    <el-radio-group v-model="form.status">
                      <el-radio v-for="dict in sys_normal_disable" :key="dict.value" :value="dict.value">
                        {{ dict.label }}
                      </el-radio>
                    </el-radio-group>
                  </el-form-item>
                </el-col>
              </el-row>
            </section>

            <section class="form-section">
              <h4>备注</h4>
              <el-row :gutter="18">
                <el-col :span="24">
                  <el-form-item label="备注" prop="remark">
                    <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="请输入内容" />
                  </el-form-item>
                </el-col>
              </el-row>
            </section>
          </el-form>
        </FormDrawer>
      </el-col>
    </el-row>
  </div>
</template>

<script setup name="Post" lang="ts">
import TableSkeleton from '@/components/Skeleton/TableSkeleton.vue';
import { DeptTreeVO, DeptVO } from '@/api/system/dept/types';
import { listPost, addPost, delPost, getPost, updatePost, deptTreeSelect } from '@/api/system/post';
import { PostForm, PostQuery, PostVO } from '@/api/system/post/types';
import TreePanel from '@/components/TreePanel/index.vue';
import FormDrawer from '@/components/FormDrawer/index.vue';
import logoUrl from '@/assets/logo/logo.png';
import { useLoading } from '@/hooks/async/useLoading';
import { useFormDialog } from '@/hooks/dialog/useFormDialog';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import { useTableSelection } from '@/hooks/table/useTableSelection';
import { useTreeCollapsed } from '@/hooks/tree/useTreeCollapsed';
import modal from '@/plugins/modal';
import { useDict } from '@/utils/dict';
import { download as requestDownload } from '@/utils/request';
import { parseTime } from '@/utils/ruoyi';

const { sys_normal_disable } = toRefs<any>(useDict('sys_normal_disable'));

const postList = ref<PostVO[]>([]);
const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();
const { ids, single, multiple, handleSelectionChange } = useTableSelection<PostVO>(item => item.postId);
const total = ref(0);
const { treeCollapsed } = useTreeCollapsed();
const deptOptions = ref<DeptTreeVO[]>([]);
const treePanelRef = ref<InstanceType<typeof TreePanel>>();
const postFormRef = ref<ElFormInstance>();
const queryFormRef = ref<ElFormInstance>();

const initFormData: PostForm = {
  postId: undefined,
  deptId: undefined,
  postCode: '',
  postName: '',
  postCategory: '',
  postSort: 0,
  status: '0',
  remark: ''
};

const data = reactive<PageData<PostForm, PostQuery>>({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    deptId: undefined,
    belongDeptId: undefined,
    postCode: '',
    postName: '',
    postCategory: '',
    status: ''
  },
  rules: {
    postName: [{ required: true, message: '岗位名称不能为空', trigger: 'blur' }],
    postCode: [{ required: true, message: '岗位编码不能为空', trigger: 'blur' }],
    deptId: [{ required: true, message: '部门不能为空', trigger: 'blur' }],
    postSort: [{ required: true, message: '岗位顺序不能为空', trigger: 'blur' }]
  }
});

const { queryParams, form, rules } = toRefs<PageData<PostForm, PostQuery>>(data);
const { dialog, resetForm, openDialog, showDialog, closeDialog } = useFormDialog({
  form,
  formRef: postFormRef,
  initialFormData: initFormData
});

const postStatusLabel = computed(() => {
  const dict = (sys_normal_disable.value || []).find((item: any) => item.value === form.value.status);
  return dict?.label || '未知状态';
});
const { resetQuery } = useSearchReset({
  queryFormRef,
  queryParams,
  pageNumKey: 'pageNum',
  resetExtras: () => {
    queryParams.value.deptId = undefined;
    treePanelRef.value?.setCurrentKey(undefined);
    queryParams.value.belongDeptId = undefined;
  },
  afterReset: () => {
    handleQuery();
  }
});

/** 查询部门下拉树结构 */
const getTreeSelect = async () => {
  const res = await deptTreeSelect();
  deptOptions.value = res.data;
};

/** 节点单击事件 */
const handleNodeClick = (data: DeptVO) => {
  queryParams.value.belongDeptId = data.id;
  queryParams.value.deptId = undefined;
  handleQuery();
};

/** 查询岗位列表 */
const getList = async () => {
  await withLoading(async () => {
    const res = await listPost(queryParams.value);
    postList.value = res.data?.rows ?? [];
    total.value = res.data?.total;
  });
};

/** 取消按钮 */
const cancel = () => {
  closeDialog();
  resetForm();
};

/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.value.pageNum = 1;
  if (queryParams.value.deptId) {
    queryParams.value.belongDeptId = undefined;
  }
  getList();
};

/** 新增按钮操作 */
const handleAdd = () => {
  openDialog('添加岗位');
};

/** 修改按钮操作 */
const handleUpdate = async (row?: Partial<PostVO>) => {
  resetForm();
  const postId = row?.postId || ids.value[0];
  const res = await getPost(postId);
  Object.assign(form.value, res.data);
  showDialog('修改岗位');
};

/** 提交按钮 */
const submitForm = () => {
  postFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      form.value.postId ? await updatePost(form.value) : await addPost(form.value);
      modal.msgSuccess('操作成功');
      closeDialog();
      await getList();
    }
  });
};

/** 删除按钮操作 */
const handleDelete = async (row?: Partial<PostVO>) => {
  const postIds = row?.postId || ids.value;
  await modal.confirm('是否确认删除岗位编号为"' + postIds + '"的数据项？');
  await delPost(postIds);
  await getList();
  modal.msgSuccess('删除成功');
};

/** 导出按钮操作 */
const handleExport = () => {
  requestDownload(
    'system/post/export',
    {
      ...queryParams.value
    },
    `post_${new Date().getTime()}.xlsx`
  );
};

onMounted(() => {
  getTreeSelect(); // 初始化部门数据
  getList();
});
</script>

<style lang="scss" scoped>
@use '@/assets/styles/components/page-shell' as pageShell;

@include pageShell.tree-table-crud-page;

.post-form :deep(.el-form-item) {
  margin-bottom: 16px;
}
.post-form :deep(.el-form-item__label) {
  padding-bottom: 6px;
  line-height: 1.3;
  font-size: 12.5px;
  font-weight: 600;
  color: #3f4a44;
}
.post-form :deep(.el-input__wrapper),
.post-form :deep(.el-select__wrapper),
.post-form :deep(.el-textarea__inner) {
  border-radius: 10px;
}
.post-form :deep(.el-form-item__content) {
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
