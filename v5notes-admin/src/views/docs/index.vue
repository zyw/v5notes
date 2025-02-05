<template>
  <div class="p-2">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-[10px]">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="文件名称" prop="name">
              <el-input v-model="queryParams.name" placeholder="请输入文件名称" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="文件类型" prop="type">
              <el-select v-model="queryParams.type" placeholder="请选择文件类型" clearable>
                <el-option label="全部" value="" />
                <el-option label="图片" value="image" />
                <el-option label="文档" value="doc" />
                <el-option label="视频" value="video" />
                <el-option label="音频" value="audio" />
                <el-option label="其他" value="other" />
              </el-select>
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

    <el-card shadow="never">
      <template #header>
        <el-row :gutter="10" class="mb8">
          <el-col :span="1.5">
            <el-button type="primary" plain icon="Upload" @click="handleUpload">上传</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete">删除</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="warning" plain icon="Download" :disabled="multiple" @click="handleDownload">下载</el-button>
          </el-col>
          <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
        </el-row>
      </template>

      <el-row :gutter="20">
        <el-col :span="4">
          <el-card shadow="hover" class="h-full">
            <template #header>
              <div class="flex items-center justify-between">
                <span>文件类型</span>
              </div>
            </template>
            <el-menu
              :default-active="activeType"
              class="w-full"
              @select="handleTypeSelect"
            >
              <el-menu-item index="all">
                <el-icon><Folder /></el-icon>
                <span>全部文件</span>
              </el-menu-item>
              <el-menu-item index="markdown">
                &nbsp;<svg-icon icon-class="markdown" />&nbsp;&nbsp;
                <span>MarkDown</span>
              </el-menu-item>
              <el-menu-item index="pdf">
                &nbsp;<svg-icon icon-class="pdf" />&nbsp;&nbsp;
                <span>PDF</span>
              </el-menu-item>
              <el-menu-item index="doc">
                <el-icon><Document /></el-icon>
                <span>文档</span>
              </el-menu-item>
              <el-menu-item index="image">
                <el-icon><Picture /></el-icon>
                <span>图片</span>
              </el-menu-item>
              <el-menu-item index="other">
                <el-icon><More /></el-icon>
                <span>其他</span>
              </el-menu-item>
            </el-menu>
          </el-card>
        </el-col>

        <el-col :span="20">
          <el-table
            v-loading="loading"
            :data="fileList"
            @selection-change="handleSelectionChange"
          >
            <el-table-column type="selection" width="55" align="center" />
            <el-table-column label="文件名称" align="left" prop="name" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="flex items-center">
                  <el-icon class="mr-2">
                    <Document v-if="row.type === 'doc'" />
                    <Picture v-else-if="row.type === 'image'" />
                    <VideoCamera v-else-if="row.type === 'video'" />
                    <Headset v-else-if="row.type === 'audio'" />
                    <More v-else />
                  </el-icon>
                  <span>{{ row.name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="文件大小" align="center" prop="size" width="120">
              <template #default="{ row }">
                {{ formatFileSize(row.size) }}
              </template>
            </el-table-column>
            <el-table-column label="扩展名" align="center" prop="suffix" width="100">
              <template #default="scope">
                <el-tag type="primary">{{ scope.row.suffix }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="更新时间" align="center" prop="updateTime" width="180">
              <template #default="{ row }">
                <span>{{ parseTime(row.updateTime) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" align="center" width="180">
              <template #default="{ row }">
                <el-button link type="primary" icon="Edit" @click="handleRename(row)">重命名</el-button>
                <el-button link type="primary" icon="Position" @click="handleMove(row)">移动</el-button>
                <el-dropdown>
                  <el-button link type="primary">
                    <el-icon><More /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item icon="Download" @click="handleDownload(row)">下载</el-dropdown-item>
                      <el-dropdown-item icon="Delete" @click="handleDelete(row)">删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
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

    <!-- 上传文件对话框 -->
    <el-dialog v-model="dialog.visible" :title="dialog.title" width="400px" append-to-body>
      <!-- <el-upload
        class="upload-demo"
        drag
        action="/upload"
        multiple
        :on-success="handleUploadSuccess">
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          将文件拖到此处，或<em>点击上传</em>
        </div>
      </el-upload> -->
      <el-form ref="ossFormRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="文件名">
          <fileUpload v-model="form.file" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button :loading="buttonLoading" type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 重命名对话框 -->
    <el-dialog title="重命名" v-model="rename.open" width="400px" append-to-body>
      <el-form :model="rename.form" label-width="80px">
        <el-form-item label="文件名称" prop="name">
          <el-input v-model="rename.form.name" placeholder="请输入文件名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="confirmRename">确 定</el-button>
          <el-button @click="rename.open = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 移动文件对话框 -->
    <el-dialog title="移动到" v-model="move.open" width="400px" append-to-body>
      <el-tree
        :data="folderTree"
        :props="{ label: 'name' }"
        @node-click="handleMoveSelect"
      />
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="confirmMove">确 定</el-button>
          <el-button @click="move.open = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="Docs">
import { getCurrentInstance, ref, reactive } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { parseTime } from '@/utils/ruoyi'
import { listFile, delFile } from '@/api/basics/file';
import { FileForm, FileQuery, FileVO } from '@/api/basics/file/types';

const { proxy } = getCurrentInstance() as ComponentInternalInstance

// 遮罩层
const loading = ref(false)
const buttonLoading = ref(false);
// 选中数组
const ids = ref<Array<string | number>>([])
// 非单个禁用
const single = ref(true)
// 非多个禁用
const multiple = ref(true)
// 显示搜索条件
const showSearch = ref(true)
// 总条数
const total = ref(0)
// 日期范围
const dateRange = ref<[DateModelType, DateModelType]>(['', ''])
// 当前选中的文件类型
const activeType = ref('all')

const previewListResource = ref(true);
const dateRangeCreateTime = ref<[DateModelType, DateModelType]>(['', '']);

const ossFormRef = ref<ElFormInstance>();
const queryFormRef = ref<ElFormInstance>();

const dialog = reactive<DialogOption>({
  visible: false,
  title: '上传文件'
});

const initFormData = {
  file: undefined
};

const data = reactive<PageData<FileForm, FileQuery>>({
  form: { ...initFormData },
  // 查询参数
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    name: '',
    type: undefined,
    createTime: undefined
  },
  rules: {
    file: [{ required: true, message: '文件不能为空', trigger: 'blur' }]
  }
});

// 查询参数
const { queryParams, form, rules } = toRefs(data);


// const queryParams = reactive({
//   pageNum: 1,
//   pageSize: 10,
//   name: undefined,
//   type: undefined,
// })

// 文件列表数据
const fileList = ref([])

// 上传参数
// const upload = reactive({
//   open: false
// })

// 重命名参数
const rename = reactive({
  open: false,
  form: {
    id: undefined,
    name: undefined
  }
})

// 移动参数
const move = reactive({
  open: false,
  targetId: undefined
})

// 文件夹树形数据
const folderTree = ref([])

/** 查询文件列表 */
const getList = async () => {
  loading.value = true;
  const res = await proxy?.getConfigKey('sys.file.previewListResource');
  previewListResource.value = res?.data === undefined ? true : res.data === 'true';
  const response = await listFile(proxy?.addDateRange(queryParams.value, dateRangeCreateTime.value, 'CreateTime'));
  fileList.value = response.rows;
  total.value = response.total;
  loading.value = false;
  // showTable.value = true;
}

/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.value.pageNum = 1
  getList()
}

/** 重置按钮操作 */
const resetQuery = () => {
  dateRange.value = ['', '']
  queryParams.value.pageNum = 1
  queryFormRef.value.resetFields()
  handleQuery()
}

/** 文件类型选择 */
const handleTypeSelect = (index: string) => {
  activeType.value = index
  queryParams.value.type = index === 'all' ? undefined : index
  handleQuery()
}

/** 多选框选中数据 */
const handleSelectionChange = (selection: any[]) => {
  ids.value = selection.map(item => item.id)
  single.value = selection.length !== 1
  multiple.value = !selection.length
}

/** 上传按钮操作 */
const handleUpload = () => {
  dialog.visible = true
}

/** 上传成功回调 */
// const handleUploadSuccess = () => {
//   dialog.visible = false
//   getList()
//   ElMessage.success('上传成功')
// }

/** 重命名按钮操作 */
const handleRename = (row?: any) => {
  rename.form.id = row?.id || ids.value[0]
  rename.form.name = row?.name
  rename.open = true
}

/** 确认重命名 */
const confirmRename = async () => {
  // TODO: 调用后端API重命名文件
  rename.open = false
  getList()
  ElMessage.success('重命名成功')
}

/** 移动按钮操作 */
const handleMove = (row?: any) => {
  move.targetId = undefined
  // TODO: 获取文件夹树形数据
  move.open = true
}

/** 移动目标选择 */
const handleMoveSelect = (data: any) => {
  move.targetId = data.id
}

/** 确认移动 */
const confirmMove = async () => {
  if (!move.targetId) {
    ElMessage.warning('请选择目标文件夹')
    return
  }
  // TODO: 调用后端API移动文件
  move.open = false
  getList()
  ElMessage.success('移动成功')
}

/** 下载按钮操作 */
const handleDownload = (row?: any) => {
  const _ids = row?.id || ids.value
  // TODO: 调用后端API下载文件
}

/** 删除按钮操作 */
const handleDelete = async (row?: any) => {
  const _ids = row?.id || ids.value
  await ElMessageBox.confirm('是否确认删除选中的文件?', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
  // TODO: 调用后端API删除文件
  getList()
  ElMessage.success('删除成功')
}

/** 格式化文件大小 */
const formatFileSize = (size: number) => {
  if (!size) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index++
  }
  return `${size.toFixed(2)} ${units[index]}`
}

/** 表单重置 */
function reset() {
  form.value = { ...initFormData };
  ossFormRef.value?.resetFields();
}

/** 提交按钮 */
const submitForm = () => {
  dialog.visible = false;
  getList();
};
/** 取消按钮 */
function cancel() {
  dialog.visible = false;
  reset();
}
onMounted(() => {
  getList();
});
</script>