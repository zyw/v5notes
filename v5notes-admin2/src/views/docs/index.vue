<template>
  <div class="p-2 docs-page">
    <!-- 搜索 -->
    <div class="search-wrap">
      <el-card shadow="hover" class="search-panel" :class="{ 'is-collapsed': !showSearch }">
        <template #header>
          <div class="panel-heading search-panel-toggle" @click.stop="showSearch = !showSearch">
            <div>
              <span class="panel-kicker">{{ $t('docs.kicker.search') }}</span>
              <h3>{{ $t('common.filter') }}</h3>
            </div>
          </div>
        </template>
        <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="query-form">
          <el-form-item :label="$t('docs.fileName')" prop="name">
            <el-input v-model="queryParams.name" :placeholder="$t('common.pleaseInput', { label: $t('docs.fileName') })" clearable @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item :label="$t('docs.fileType')" prop="type">
            <el-select v-model="queryParams.type" :placeholder="$t('common.pleaseSelect', { label: $t('docs.fileType') })" clearable style="width: 160px">
              <el-option :label="$t('common.all')" value="" />
              <el-option label="Markdown" value="markdown" />
              <el-option label="PDF" value="pdf" />
              <el-option :label="$t('docs.doc')" value="doc" />
              <el-option :label="$t('docs.image')" value="image" />
              <el-option :label="$t('docs.other')" value="other" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleQuery">{{ $t('common.search') }}</el-button>
            <el-button icon="Refresh" @click="resetQuery">{{ $t('common.reset') }}</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>

    <el-card shadow="hover" class="table-panel docs-table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="panel-kicker">{{ $t('docs.kicker.dataset') }}</span>
            <h3>{{ $t('docs.listTitle') }}</h3>
            <p>{{ $t('docs.listDesc', { total }) }}</p>
          </div>
          <div class="toolbar-actions">
            <el-button type="primary" plain icon="Upload" @click="handleUpload">{{ $t('common.upload') }}</el-button>
            <el-button type="danger" plain icon="Delete" :disabled="!ids.length" @click="handleDelete()">{{ $t('common.delete') }}</el-button>
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList" />
          </div>
        </div>
      </template>

      <el-row :gutter="20">
        <el-col :span="4" :xs="24">
          <el-card shadow="hover" class="docs-type-card">
            <template #header>
              <div class="docs-type-head">
                <span>{{ $t('docs.fileType') }}</span>
              </div>
            </template>
            <nav class="docs-type-nav">
              <button
                v-for="item in docTypeItems"
                :key="item.value"
                type="button"
                class="docs-type-item"
                :class="{ 'is-active': activeType === item.value }"
                @click="handleTypeSelect(item.value)"
              >
                <el-icon class="docs-type-item__icon"><component :is="item.icon" /></el-icon>
                <span class="docs-type-item__label">{{ item.label }}</span>
                <span v-if="item.value === 'all'" class="docs-type-item__count">{{ total }}</span>
              </button>
            </nav>
          </el-card>
        </el-col>
        <el-col :span="20" :xs="24">
          <el-table v-loading="loading && (fileList).length > 0" class="data-table" :data="fileList" @selection-change="handleSelectionChange">
            <el-table-column type="selection" width="55" align="center" />
            <el-table-column :label="$t('docs.fileName')" align="left" prop="name" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="flex items-center">
                  <el-icon class="mr-2"><Document /></el-icon>
                  <span>{{ row.name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column :label="$t('docs.fileSize')" align="center" prop="size" width="120">
              <template #default="{ row }">{{ formatFileSize(row.size) }}</template>
            </el-table-column>
            <el-table-column :label="$t('docs.suffix')" align="center" prop="suffix" width="100">
              <template #default="{ row }"><el-tag type="primary">{{ row.suffix }}</el-tag></template>
            </el-table-column>
            <el-table-column :label="$t('common.updateTime')" align="center" prop="updateTime" width="180">
              <template #default="{ row }"><span>{{ parseTime(row.updateTime) }}</span></template>
            </el-table-column>
            <el-table-column :label="$t('common.operate')" align="center" width="160" fixed="right">
              <template #default="{ row }">
                <div class="docs-row-actions">
                  <el-tooltip :content="$t('common.preview')" placement="top">
                    <el-button link type="primary" icon="View" @click="handlePreview(row as FileVO)" />
                  </el-tooltip>
                  <el-tooltip :content="$t('common.download')" placement="top">
                    <el-button link type="primary" icon="Download" @click="handleDownload(row as FileVO)" />
                  </el-tooltip>
                  <el-tooltip :content="$t('common.delete')" placement="top">
                    <el-button link type="danger" icon="Delete" @click="handleDelete(row as FileVO)" />
                  </el-tooltip>
                </div>
              </template>
            </el-table-column>
            <template #empty>
              <table-skeleton v-if="loading" :rows="8" />
              <div v-else class="empty-hint">{{ $t('common.noData') }}</div>
            </template>
          </el-table>
          <pagination
            v-show="total > 0"
            :total="total"
            v-model:page="queryParams.pageNum"
            v-model:limit="queryParams.pageSize"
            @pagination="getList"
          />
        </el-col>
      </el-row>
    </el-card>

    <FilePreviewDrawer
      v-model="previewOpen"
      :file-id="previewTarget?.id"
      :file-name="previewTarget?.name"
      :suffix="previewTarget?.suffix"
      :url="previewTarget?.url"
      @download="previewTarget && handleDownload(previewTarget)"
    />

    <el-dialog v-model="uploadOpen" :title="$t('docs.uploadTitle')" width="440px" append-to-body class="app-dialog">
      <template #header>
        <div class="app-dialog-hero">
          <div class="app-dialog-hero__top">
            <img src="@/assets/logo/logo.png" alt="" />
            <span>{{ $t('docs.brand') }}</span>
          </div>
          <div class="app-dialog-hero__main">
            <div class="app-dialog-hero__icon">{{ $t('docs.glyph') }}</div>
            <div>
              <div class="app-dialog-hero__name">{{ $t('docs.uploadTitle') }}</div>
              <div class="app-dialog-hero__meta"><span>{{ $t('docs.uploadHint') }}</span></div>
            </div>
          </div>
        </div>
      </template>

      <el-upload
        drag
        :action="uploadUrl"
        :headers="uploadHeaders"
        :show-file-list="false"
        :on-success="handleUploadSuccess"
        :on-error="handleUploadError"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">{{ $t('docs.dropLead') }}<em>{{ $t('docs.clickUpload') }}</em></div>
      </el-upload>
    </el-dialog>
  </div>
</template>

<script setup name="Docs" lang="ts">
import TableSkeleton from '@/components/Skeleton/TableSkeleton.vue';
import FilePreviewDrawer from '@/components/FilePreviewDrawer/index.vue';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Document, Files, Memo, More, Picture, UploadFilled } from '@element-plus/icons-vue';
import { delFile, listFile } from '@/api/basics/file';
import type { FileQuery, FileVO } from '@/api/basics/file/types';
import { getToken } from '@/utils/auth';
import { globalHeaders } from '@/utils/request';
import { saveBlob } from '@/utils/save';
import { parseTime } from '@/utils/ruoyi';

const { t } = useI18n();

const loading = ref(false);
const ids = ref<Array<string | number>>([]);
const total = ref(0);
const showSearch = ref(true);
const fileList = ref<FileVO[]>([]);
const activeType = ref('all');
const previewOpen = ref(false);
const previewTarget = ref<FileVO>();

/** 左侧文件类型导航（图标 + 名称） */
const docTypeItems = computed(() => [
  { value: 'all', label: t('docs.allFiles'), icon: Files },
  { value: 'markdown', label: 'Markdown', icon: Memo },
  { value: 'pdf', label: 'PDF', icon: Document },
  { value: 'doc', label: t('docs.doc'), icon: Document },
  { value: 'image', label: t('docs.image'), icon: Picture },
  { value: 'other', label: t('docs.other'), icon: More }
]);
const uploadOpen = ref(false);
const queryFormRef = ref();

const queryParams = reactive<FileQuery>({
  pageNum: 1,
  pageSize: 10,
  name: '',
  type: '',
  createTime: ''
});

const uploadUrl = computed(() => (import.meta.env.VITE_APP_BASE_API as string) + '/basics/base/file');
const uploadHeaders = computed(() => ({
  Authorization: 'Bearer ' + (getToken() || ''),
  clientid: import.meta.env.VITE_APP_CLIENT_ID
}));

/** 查询文件列表 */
const getList = async () => {
  loading.value = true;
  try {
    const res = await listFile(queryParams);
    fileList.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

const resetQuery = () => {
  queryParams.pageNum = 1;
  queryParams.name = '';
  queryParams.type = '';
  activeType.value = 'all';
  queryFormRef.value?.resetFields();
  getList();
};

const handleTypeSelect = (index: string) => {
  activeType.value = index;
  queryParams.type = index === 'all' ? '' : index;
  handleQuery();
};

const handleSelectionChange = (selection: FileVO[]) => {
  ids.value = selection.map(item => item.id);
};

const handleUpload = () => {
  uploadOpen.value = true;
};

const handleUploadSuccess = (response: any) => {
  if (response?.code !== 200) {
    ElMessage.error(response?.msg || t('docs.uploadFail'));
    return;
  }
  ElMessage.success(t('docs.uploadOk'));
  uploadOpen.value = false;
  getList();
};

const handleUploadError = () => {
  ElMessage.error(t('docs.uploadFail'));
};

/** 预览 */
const handlePreview = (row: FileVO) => {
  previewTarget.value = row;
  previewOpen.value = true;
};

/** 下载（直接请求 basics 下载接口，携带登录令牌） */
const handleDownload = async (row?: FileVO) => {
  const id = row?.id ?? ids.value[0];
  if (!id) return;
  try {
    const response = await fetch((import.meta.env.VITE_APP_BASE_API as string) + '/basics/admin/file/download/' + id, {
      headers: globalHeaders()
    });
    if (!response.ok) {
      ElMessage.error(t('docs.downloadFail'));
      return;
    }
    const blob = await response.blob();
    saveBlob(blob, row?.name || 'download');
  } catch {
    ElMessage.error(t('docs.downloadFail'));
  }
};

/** 删除 */
const handleDelete = async (row?: FileVO) => {
  const target = row?.id ?? ids.value;
  if (!target || (Array.isArray(target) && target.length === 0)) return;
  await ElMessageBox.confirm(t('docs.deleteConfirm'), t('docs.warn'), {
    confirmButtonText: t('common.confirm'),
    cancelButtonText: t('common.cancel'),
    type: 'warning'
  });
  await delFile(target);
  ElMessage.success(t('common.deleteSuccess'));
  getList();
};

const formatFileSize = (size: number) => {
  if (!size) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;
  let value = size;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }
  return `${value.toFixed(2)} ${units[index]}`;
};

onMounted(() => {
  getList();
});
</script>

<style scoped lang="scss">
.mb8 {
  margin-bottom: 8px;
}
.h-full {
  height: 100%;
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

<style lang="scss" scoped>
/* 文档列表：内容整体撑满卡片，分页固定可见 */
.docs-table-panel :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.docs-table-panel :deep(.el-row) {
  flex: 1;
  min-height: 0;
}
.docs-table-panel :deep(.el-col) {
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.docs-table-panel :deep(.pagination-container) {
  flex: none;
  margin-top: 8px;
}
</style>

<style lang="scss" scoped>
/* ===== 文档页：左侧文件类型导航 ===== */
.docs-type-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.docs-type-card :deep(.el-card__header) {
  flex: none;
  padding: 12px 14px !important;
}
.docs-type-card :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  padding: 8px !important;
  overflow: hidden;
}
.docs-type-head {
  font-size: 13px;
  font-weight: 700;
  color: #15241e;
}
.docs-type-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.docs-type-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  height: 38px;
  padding: 0 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  font-size: 13px;
  color: #3a4a42;
  cursor: pointer;
  text-align: left;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}
.docs-type-item:hover {
  background: rgba(28, 90, 72, 0.06);
  color: #17624a;
}
.docs-type-item.is-active {
  background: #e8f2ec;
  color: #17624a;
  font-weight: 600;
}
.docs-type-item__icon {
  flex: none;
  width: 16px;
  height: 16px;
  font-size: 16px;
  color: #7c8880;
}
.docs-type-item.is-active .docs-type-item__icon,
.docs-type-item:hover .docs-type-item__icon {
  color: #1c5a48;
}
.docs-type-item__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docs-type-item__count {
  flex: none;
  padding: 1px 7px;
  border-radius: 999px;
  background: #e8f2ec;
  color: #17624a;
  font-size: 11px;
  font-weight: 700;
}
.docs-type-item.is-active .docs-type-item__count {
  background: #fff;
}

/* ===== 操作列：图标按钮不重叠 ===== */
.docs-row-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.docs-row-actions :deep(.el-button) {
  width: 28px;
  height: 28px;
  margin-left: 0 !important;
  border-radius: 8px;
}
.docs-row-actions :deep(.el-button:hover) {
  background: rgba(28, 90, 72, 0.08);
}
</style>

<style lang="scss" scoped>
/* 文档页：右栏表格撑满、分页固定；左栏内容过长时内部滚动 */
.docs-table-panel :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.docs-table-panel :deep(.el-card__body) > .el-row {
  flex: 1;
  min-height: 0;
}
.docs-table-panel :deep(.el-card__body) > .el-row > .el-col {
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.docs-table-panel :deep(.el-col > .el-table) {
  flex: 1;
  min-height: 0;
}
.docs-table-panel :deep(.pagination-container) {
  flex: none;
  margin-top: 8px;
}
.docs-type-card :deep(.el-card__body) {
  overflow-y: auto;
}
</style>

<style lang="scss" scoped>
/* ===== 文档页：整页撑满视口 ===== */
.docs-page {
  /* 76px 固定头部 + 24px .app-main 上下内边距 + 8px 余量 */
  height: calc(100vh - 76px - 24px - 8px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.app-main.with-tags-view .docs-page {
  height: calc(100vh - 111px - 24px - 8px);
}
.docs-page > .el-card {
  margin-bottom: 0 !important;
}
.docs-search-card {
  flex: none;
}
.docs-table-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.docs-table-panel :deep(.el-card__header) {
  flex: none;
}
.docs-table-panel :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.docs-table-panel :deep(.el-card__body) > .el-row {
  flex: 1;
  min-height: 0;
  margin-bottom: 0;
}
.docs-table-panel :deep(.el-card__body) > .el-row > .el-col {
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.docs-table-panel :deep(.el-card__body) > .el-row > .el-col > .el-table {
  flex: 1;
  min-height: 0;
}
.docs-table-panel :deep(.pagination-container) {
  flex: none;
  margin-top: 8px;
}
.docs-type-card {
  flex: 1;
  min-height: 0;
}
</style>

<style lang="scss" scoped>
/* 左侧类型卡片不走高：与右栏等高但内部滚动，不撑出页面 */
.docs-table-panel :deep(.el-card__body) > .el-row > .el-col:first-child {
  overflow: hidden;
}
.docs-type-card {
  max-height: 100%;
}
</style>
