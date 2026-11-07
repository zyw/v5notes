<template>
  <div class="p-2 app-container system-notice-page">
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
          <el-form-item label="公告标题" prop="noticeTitle">
            <el-input
              v-model="queryParams.noticeTitle"
              placeholder="请输入公告标题"
              clearable
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item label="操作人员" prop="createByName">
            <el-input
              v-model="queryParams.createByName"
              placeholder="请输入操作人员"
              clearable
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item label="类型" prop="noticeType">
            <el-select v-model="queryParams.noticeType" placeholder="公告类型" clearable>
              <el-option v-for="dict in sys_notice_type" :key="dict.value" :label="dict.label" :value="dict.value" />
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
            <span class="panel-kicker">Notice Dataset</span>
            <h3>公告列表</h3>
            <p>共 {{ total }} 条记录，支持类型筛选、内容编辑和状态管理。</p>
          </div>
          <div class="toolbar-actions">
            <el-button v-hasPermi="['system:notice:add']" type="primary" plain icon="Plus" @click="handleAdd">
              新增
            </el-button>
            <el-button
              v-hasPermi="['system:notice:edit']"
              type="success"
              plain
              icon="Edit"
              :disabled="single"
              @click="handleUpdate()"
            >
              修改
            </el-button>
            <el-button
              v-hasPermi="['system:notice:remove']"
              type="danger"
              plain
              icon="Delete"
              :disabled="multiple"
              @click="handleDelete()"
            >
              删除
            </el-button>
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList"></right-toolbar>
          </div>
        </div>
      </template>

      <el-table
        v-loading="loading"
        border
        class="data-table"
        :data="noticeList"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column v-if="false" label="序号" align="center" prop="noticeId" width="100" />
        <el-table-column label="公告标题" align="center" prop="noticeTitle" :show-overflow-tooltip="true" />
        <el-table-column label="公告类型" align="center" prop="noticeType" width="100">
          <template #default="scope">
            <dict-tag :options="sys_notice_type" :value="scope.row.noticeType" />
          </template>
        </el-table-column>
        <el-table-column label="状态" align="center" prop="status" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === '0' ? 'success' : 'info'">
              {{ scope.row.status === '0' ? '已发送' : '未发送' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建者" align="center" prop="createByName" width="100" />
        <el-table-column label="创建时间" align="center" prop="createTime" width="160">
          <template #default="scope">
            <span>{{ parseTime(scope.row.createTime, '{y}-{m}-{d}') }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip content="详情" placement="top">
              <el-button link type="primary" icon="View" @click="handleDetail(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip v-if="scope.row.status === '1'" content="发送" placement="top">
              <el-button
                v-hasPermi="['system:notice:edit']"
                link
                type="success"
                icon="Promotion"
                @click="handleSend(scope.row)"
              ></el-button>
            </el-tooltip>
            <el-tooltip content="修改" placement="top">
              <el-button
                v-hasPermi="['system:notice:edit']"
                link
                type="primary"
                icon="Edit"
                @click="handleUpdate(scope.row)"
              ></el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button
                v-hasPermi="['system:notice:remove']"
                link
                type="primary"
                icon="Delete"
                @click="handleDelete(scope.row)"
              ></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        @pagination="getList"
      />
    </el-card>
    <!-- 添加或修改公告抽屉 -->
    <FormDrawer
      v-model="dialog.visible"
      :title="dialog.title"
      eyebrow="V5Notes · 通知公告"
      subtitle="配置通知公告的标题、类型、内容与显示状态"
      size="680px"
      submit-text="确定"
      hint="带 * 为必填项，保存后立即生效"
      @submit="submitForm"
      @closed="cancel"
    >
      <template #hero>
        <div class="drawer-hero">
          <div class="drawer-hero__top">
            <span class="drawer-hero__brand"><img :src="logoUrl" alt="" />V5Notes · 通知公告</span>
            <span class="drawer-hero__divider">·</span>
            <span class="drawer-hero__action">{{ dialog.title }}</span>
          </div>
          <div class="drawer-hero__profile">
            <div class="drawer-hero__icon">{{ (form.noticeTitle || '通').slice(0, 1) }}</div>
            <div class="drawer-hero__info">
              <div class="drawer-hero__name">{{ form.noticeTitle || '未命名公告' }}</div>
              <div class="drawer-hero__meta">
                <span class="drawer-hero__tag">{{ noticeTypeLabel }}</span>
                <span>{{ noticeStatusLabel }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <el-form ref="noticeFormRef" :model="form" :rules="rules" label-position="top" class="notice-form">
        <section class="form-section">
          <h4>基本信息</h4>
          <el-row :gutter="18">
            <el-col :span="12">
              <el-form-item label="公告标题" prop="noticeTitle">
                <el-input v-model="form.noticeTitle" placeholder="请输入公告标题" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="公告类型" prop="noticeType">
                <el-select v-model="form.noticeType" placeholder="请选择">
                  <el-option
                    v-for="dict in sys_notice_type"
                    :key="dict.value"
                    :label="dict.label"
                    :value="dict.value"
                  ></el-option>
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
        </section>

        <section class="form-section">
          <h4>公告内容</h4>
          <el-form-item label="内容">
            <editor v-model="form.noticeContent" :min-height="192" />
          </el-form-item>
        </section>
      </el-form>
    </FormDrawer>

    <el-dialog
      v-model="detailDialog.visible"
      title="公告详情"
      width="820px"
      append-to-body
      @closed="handleDetailDialogClosed" class="app-dialog">
      <template #header>
        <div class="app-dialog-hero">
          <div class="app-dialog-hero__top">
            <img src="@/assets/logo/logo.png" alt="" />
            <span>V5Notes 通知公告</span>
          </div>
          <div class="app-dialog-hero__main">
            <div class="app-dialog-hero__icon">{{ (detailForm.noticeTitle || '公').slice(0, 1) }}</div>
            <div>
              <div class="app-dialog-hero__name">{{ detailForm.noticeTitle || '公告详情' }}</div>
              <div class="app-dialog-hero__meta"><span>{{ detailForm.status === '0' ? '已发送' : '未发送' }} · {{ detailForm.createByName || '-' }}</span></div>
            </div>
          </div>
        </div>
      </template>

      <div class="notice-detail">
        <div class="notice-detail__header">
          <div class="notice-detail__title">{{ detailForm.noticeTitle || '-' }}</div>
          <div class="notice-detail__meta">
            <div class="notice-detail__meta-item">
              <span class="notice-detail__meta-label">类型：</span>
              <dict-tag :options="sys_notice_type" :value="detailForm.noticeType" />
            </div>
            <div class="notice-detail__meta-item">
              <span class="notice-detail__meta-label">状态：</span>
              <span>{{ detailForm.status === '0' ? '已发送' : '未发送' }}</span>
            </div>
            <div class="notice-detail__meta-item">
              <span class="notice-detail__meta-label">创建者：</span>
              <span>{{ detailForm.createByName || '-' }}</span>
            </div>
            <div class="notice-detail__meta-item">
              <span class="notice-detail__meta-label">创建时间：</span>
              <span>{{ parseTime(detailForm.createTime, '{y}-{m}-{d} {h}:{i}:{s}') || '-' }}</span>
            </div>
          </div>
        </div>
        <el-divider />
        <div class="notice-detail__content" v-html="safeNoticeContent"></div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup name="Notice" lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { listNotice, getNotice, delNotice, addNotice, updateNotice } from '@/api/system/notice';
import { NoticeForm, NoticeQuery, NoticeVO } from '@/api/system/notice/types';
import { useLoading } from '@/hooks/async/useLoading';
import { useDialogState } from '@/hooks/dialog/useDialogState';
import { useFormDialog } from '@/hooks/dialog/useFormDialog';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import { useTableSelection } from '@/hooks/table/useTableSelection';
import modal from '@/plugins/modal';
import { useDict } from '@/utils/dict';
import { resolveOssContent } from '@/utils/ossContent';
import { parseTime } from '@/utils/ruoyi';
import { sanitizeHtml } from '@/utils/sanitize';
import FormDrawer from '@/components/FormDrawer/index.vue';
import logoUrl from '@/assets/logo/logo.png';

const { sys_notice_type } = toRefs<any>(useDict('sys_notice_type'));
const route = useRoute();
const router = useRouter();

const noticeList = ref<NoticeVO[]>([]);
const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();
const total = ref(0);

const queryFormRef = ref<ElFormInstance>();
const noticeFormRef = ref<ElFormInstance>();
const routeDetailSyncing = ref(false);
const emptyNoticeContent = '<p>暂无公告内容</p>';

const initFormData: NoticeForm = {
  noticeId: undefined,
  noticeTitle: '',
  noticeType: '',
  noticeContent: '',
  status: '1',
  remark: '',
  createByName: ''
};
const detailForm = ref<NoticeVO>({} as NoticeVO);
const safeNoticeContent = computed(() => sanitizeHtml(detailForm.value.noticeContent || emptyNoticeContent));
const noticeTypeLabel = computed(() => {
  return sys_notice_type.value.find((d: any) => d.value === form.value.noticeType)?.label || '未设置类型';
});
const noticeStatusLabel = computed(() => (form.value.status === '0' ? '已发送' : '未发送'));
const data = reactive<PageData<NoticeForm, NoticeQuery>>({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    noticeTitle: '',
    createByName: '',
    status: '',
    noticeType: ''
  },
  rules: {
    noticeTitle: [{ required: true, message: '公告标题不能为空', trigger: 'blur' }],
    noticeType: [{ required: true, message: '公告类型不能为空', trigger: 'change' }]
  }
});

const { queryParams, form, rules } = toRefs(data);
const { ids, single, multiple, handleSelectionChange } = useTableSelection<NoticeVO>(item => item.noticeId);
const {
  dialog,
  resetForm: reset,
  openDialog,
  showDialog,
  closeDialog
} = useFormDialog({
  form,
  formRef: noticeFormRef,
  initialFormData: initFormData
});
const {
  dialog: detailDialog,
  openDialog: openDetailDialog,
  closeDialog: closeDetailDialog
} = useDialogState('公告详情');

/** 查询公告列表 */
const getList = async () => {
  await withLoading(async () => {
    const res = await listNotice(queryParams.value);
    noticeList.value = res.data?.rows;
    total.value = res.data?.total;
  });
};
/** 取消按钮 */
const cancel = () => {
  closeDialog();
  reset();
};
/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};
const { resetQuery } = useSearchReset({
  queryFormRef,
  queryParams,
  pageNumKey: 'pageNum',
  afterReset: () => {
    handleQuery();
  }
});
/** 新增按钮操作 */
const handleAdd = () => {
  openDialog('添加公告');
};
/**修改按钮操作 */
const handleUpdate = async (row?: Partial<NoticeVO>) => {
  reset();
  const noticeId = row?.noticeId || ids.value[0];
  const { data } = await getNotice(noticeId);
  Object.assign(form.value, data);
  showDialog('修改公告');
};
/** 详情按钮操作 */
const handleDetail = async (row: Partial<NoticeVO>) => {
  await openDetail(row.noticeId);
};
/** 发送按钮操作：新增/编辑后不立即发送，点发送才发出 */
const handleSend = async (row: Partial<NoticeVO>) => {
  await modal.confirm('确定发送公告"' + row.noticeTitle + '"吗？');
  const { data } = await getNotice(row.noticeId!);
  data.status = '0';
  await updateNotice(data);
  modal.msgSuccess('发送成功');
  await getList();
};
/** 打开详情 */
const openDetail = async (noticeId: string | number) => {
  const { data } = await getNotice(noticeId);
  data.noticeContent = await resolveOssContent(data.noticeContent);
  detailForm.value = data;
  openDetailDialog();
};
/** 详情弹窗关闭后移除路由参数 */
const handleDetailDialogClosed = async () => {
  if (!route.query.noticeId) {
    return;
  }
  routeDetailSyncing.value = true;
  await router.replace({
    path: route.path,
    query: {
      ...route.query,
      noticeId: undefined
    }
  });
  routeDetailSyncing.value = false;
};
/** 提交按钮 */
const submitForm = () => {
  noticeFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      form.value.noticeId ? await updateNotice(form.value) : await addNotice(form.value);
      modal.msgSuccess('操作成功');
      closeDialog();
      await getList();
    }
  });
};
/** 删除按钮操作 */
const handleDelete = async (row?: Partial<NoticeVO>) => {
  const noticeIds = row?.noticeId || ids.value;
  await modal.confirm('是否确认删除公告编号为"' + noticeIds + '"的数据项？');
  await delNotice(noticeIds);
  await getList();
  modal.msgSuccess('删除成功');
};

onMounted(() => {
  getList();
});

watch(
  () => route.query.noticeId,
  async noticeId => {
    if (routeDetailSyncing.value || !noticeId) {
      return;
    }
    await openDetail(String(noticeId));
  },
  { immediate: true }
);
</script>

<style lang="scss" scoped>
@use '@/assets/styles/components/page-shell' as pageShell;

@include pageShell.table-crud-page;

.notice-detail {
  &__header {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__title {
    font-size: 22px;
    font-weight: 700;
    color: var(--el-text-color-primary);
    line-height: 1.4;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 20px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.6;
  }

  &__meta-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  &__meta-label {
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }

  &__content {
    max-height: 60vh;
    overflow: auto;
    color: var(--el-text-color-primary);
    line-height: 1.8;
    word-break: break-word;
  }

  :deep(.notice-detail__meta-item > div) {
    display: inline-flex;
    align-items: center;
  }
}
</style>

<style lang="scss" scoped>
.notice-form :deep(.el-form-item) {
  margin-bottom: 16px;
}
.notice-form :deep(.el-form-item__label) {
  padding-bottom: 6px;
  line-height: 1.3;
  font-size: 12.5px;
  font-weight: 600;
  color: #3f4a44;
}
.notice-form :deep(.el-input__wrapper),
.notice-form :deep(.el-select__wrapper),
.notice-form :deep(.el-textarea__inner) {
  border-radius: 10px;
}
.notice-form :deep(.el-form-item__content) {
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


