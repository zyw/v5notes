<template>
  <div class="p-2">
    <!-- 搜索 -->
    <el-card shadow="hover" class="mb-[10px]">
      <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="query-form">
        <el-form-item label="文件名称" prop="name">
          <el-input v-model="queryParams.name" placeholder="请输入文件名称" clearable @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="文件类型" prop="type">
          <el-select v-model="queryParams.type" placeholder="请选择文件类型" clearable style="width: 160px">
            <el-option label="全部" value="" />
            <el-option label="Markdown" value="markdown" />
            <el-option label="PDF" value="pdf" />
            <el-option label="文档" value="doc" />
            <el-option label="图片" value="image" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <el-row :gutter="10" class="mb8">
          <el-col :span="1.5">
            <el-button type="primary" plain icon="Upload" @click="handleUpload">上传</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="danger" plain icon="Delete" :disabled="!ids.length" @click="handleDelete()">删除</el-button>
          </el-col>
        </el-row>
      </template>

      <el-row :gutter="20">
        <el-col :span="4" :xs="24">
          <el-card shadow="hover" class="h-full">
            <template #header><span>文件类型</span></template>
            <el-menu :default-active="activeType" class="w-full" @select="handleTypeSelect">
              <el-menu-item index="all"><el-icon><Folder /></el-icon><span>全部文件</span></el-menu-item>
              <el-menu-item index="markdown"><el-icon><Document /></el-icon><span>MarkDown</span></el-menu-item>
              <el-menu-item index="pdf"><el-icon><Document /></el-icon><span>PDF</span></el-menu-item>
              <el-menu-item index="doc"><el-icon><Document /></el-icon><span>文档</span></el-menu-item>
              <el-menu-item index="image"><el-icon><Picture /></el-icon><span>图片</span></el-menu-item>
              <el-menu-item index="other"><el-icon><More /></el-icon><span>其他</span></el-menu-item>
            </el-menu>
          </el-card>
        </el-col>
        <el-col :span="20" :xs="24">
          <el-table v-loading="loading" :data="fileList" @selection-change="handleSelectionChange">
            <el-table-column type="selection" width="55" align="center" />
            <el-table-column label="文件名称" align="left" prop="name" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="flex items-center">
                  <el-icon class="mr-2"><Document /></el-icon>
                  <span>{{ row.name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="文件大小" align="center" prop="size" width="120">
              <template #default="{ row }">{{ formatFileSize(row.size) }}</template>
            </el-table-column>
            <el-table-column label="扩展名" align="center" prop="suffix" width="100">
              <template #default="{ row }"><el-tag type="primary">{{ row.suffix }}</el-tag></template>
            </el-table-column>
            <el-table-column label="更新时间" align="center" prop="updateTime" width="180">
              <template #default="{ row }"><span>{{ parseTime(row.updateTime) }}</span></template>
            </el-table-column>
            <el-table-column label="操作" align="center" width="160">
              <template #default="{ row }">
                <el-button link type="primary" icon="Download" @click="handleDownload(row)">下载</el-button>
                <el-button link type="danger" icon="Delete" @click="handleDelete(row)">删除</el-button>
              </template>
            </el-table-column>
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

    <el-dialog v-model="uploadOpen" title="上传文件" width="440px" append-to-body>
      <el-upload
        drag
        :action="uploadUrl"
        :headers="uploadHeaders"
        :show-file-list="false"
        :on-success="handleUploadSuccess"
        :on-error="handleUploadError"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
      </el-upload>
    </el-dialog>
  </div>
</template>

<script setup name="Docs" lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Document, Folder, More, Picture, UploadFilled } from '@element-plus/icons-vue';
import { delFile, listFile } from '@/api/basics/file';
import type { FileQuery, FileVO } from '@/api/basics/file/types';
import { getToken } from '@/utils/auth';
import { globalHeaders } from '@/utils/request';
import { saveBlob } from '@/utils/save';
import { parseTime } from '@/utils/ruoyi';

const loading = ref(false);
const ids = ref<Array<string | number>>([]);
const total = ref(0);
const fileList = ref<FileVO[]>([]);
const activeType = ref('all');
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
    ElMessage.error(response?.msg || '上传失败');
    return;
  }
  ElMessage.success('上传成功');
  uploadOpen.value = false;
  getList();
};

const handleUploadError = () => {
  ElMessage.error('上传失败');
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
      ElMessage.error('下载失败');
      return;
    }
    const blob = await response.blob();
    saveBlob(blob, row?.name || 'download');
  } catch {
    ElMessage.error('下载失败');
  }
};

/** 删除 */
const handleDelete = async (row?: FileVO) => {
  const target = row?.id ?? ids.value;
  if (!target || (Array.isArray(target) && target.length === 0)) return;
  await ElMessageBox.confirm('是否确认删除选中的文件?', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  });
  await delFile(target);
  ElMessage.success('删除成功');
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
