<template>
  <div class="p-2">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-[10px]">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="原名" prop="fileName">
              <el-input v-model="queryParams.name" placeholder="请输入文件原名" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="文件类型" prop="type">
              <el-input v-model="queryParams.type" placeholder="请输入文件类型" clearable style="width: 240px" @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="创建时间" prop="params.createTime">
              <el-date-picker
                v-model="queryParams.createTime"
                value-format="YYYY-MM-DD HH:mm:ss"
                :default-time="[new Date('1 00:00:00'), new Date('1 23:59:59')]"
                type="daterange"
                range-separator="-"
                start-placeholder="开始时间"
                end-placeholder="结束时间"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" icon="search" @click="handleQuery">搜索</el-button>
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
            <el-button v-hasPermi="['basics:file:upload']" type="primary" plain icon="Upload" @click="handleFile">上传文件</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['basics:file:upload']" type="primary" plain icon="Upload" @click="handleImage">上传图片</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['basics:file:remove']" type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()">
              删除
            </el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button
              v-hasPermi="['basics:file:edit']"
              :type="previewListResource ? 'danger' : 'warning'"
              plain
              @click="handlePreviewListResource(!previewListResource)"
              >预览开关 : {{ previewListResource ? '禁用' : '启用' }}</el-button
            >
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['basics:fileConfig:list']" type="info" plain icon="Operation" @click="handleFileConfig">配置管理</el-button>
          </el-col>
          <right-toolbar v-model:showSearch="showSearch" @query-table="getList"></right-toolbar>
        </el-row>
      </template>

      <el-table
        v-if="showTable"
        v-loading="loading"
        :data="fileList"
        :header-cell-class-name="handleHeaderClass"
        @selection-change="handleSelectionChange"
        @header-click="handleHeaderCLick"
      >
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column label="序号" type="index" width="50" :index="hIndex" />
        <el-table-column label="原名" align="center" prop="name" />
        <el-table-column label="文件名" align="center" prop="path" />
        <el-table-column label="文件后缀" align="center" prop="suffix">
          <template #default="scope">
            <el-tag type="primary">{{ scope.row.suffix }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="文件展示" align="center" prop="url">
          <template #default="scope">
            <ImagePreview
              v-if="previewListResource && checkFileSuffix(scope.row.suffix)"
              :width="100"
              :height="100"
              :src="scope.row.url"
              :preview-src-list="[scope.row.url]"
            />
            <!-- <span v-if="!checkFileSuffix(scope.row.suffix) || !previewListResource" v-text="scope.row.url" /> -->
            <el-tooltip v-if="!checkFileSuffix(scope.row.suffix) || !previewListResource" :content="scope.row.url" placement="top">
              <svg-icon :icon-class="scope.row.suffix" style="width: 2.2em; height: 2.2em" />
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" align="center" prop="createTime" width="180" sortable="custom">
          <template #default="scope">
            <span>{{ parseTime(scope.row.createTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip content="下载" placement="top">
              <el-button v-hasPermi="['basics:file:download']" link type="primary" icon="Download" @click="handleDownload(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button v-hasPermi="['basics:file:remove']" link type="primary" icon="Delete" @click="handleDelete(scope.row)"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>
    <!-- 添加或修改OSS对象存储对话框 -->
    <el-dialog v-model="dialog.visible" :title="dialog.title" width="500px" append-to-body>
      <el-form ref="ossFormRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="文件名">
          <fileUpload v-if="type === 0" v-model="form.file" />
          <imageUpload v-if="type === 1" v-model="form.file" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button :loading="buttonLoading" type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="Oss" lang="ts">
import { listFile, delFile } from '@/api/basics/file';
import ImagePreview from '@/components/ImagePreview/index.vue';
import { FileForm, FileQuery, FileVO } from '@/api/basics/file/types';

const router = useRouter();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const fileList = ref<FileVO[]>([]);
const showTable = ref(true);
const buttonLoading = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const type = ref(0);
const previewListResource = ref(true);
const dateRangeCreateTime = ref<[DateModelType, DateModelType]>(['', '']);

const dialog = reactive<DialogOption>({
  visible: false,
  title: ''
});

// 默认排序
const defaultSort = ref({ prop: 'createTime', order: 'ascending' });

const ossFormRef = ref<ElFormInstance>();
const queryFormRef = ref<ElFormInstance>();

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

const { queryParams, form, rules } = toRefs(data);

const hIndex = (index: number) => {
  return index + 1 + (queryParams.value.pageNum - 1) * queryParams.value.pageSize;
};

/** 查询OSS对象存储列表 */
const getList = async () => {
  loading.value = true;
  const res = await proxy?.getConfigKey('sys.file.previewListResource');
  previewListResource.value = res?.data === undefined ? true : res.data === 'true';
  const response = await listFile(proxy?.addDateRange(queryParams.value, dateRangeCreateTime.value, 'CreateTime'));
  fileList.value = response.rows;
  total.value = response.total;
  loading.value = false;
  showTable.value = true;
};
function checkFileSuffix(fileSuffix: string | string[]) {
  const arr = ['png', 'jpg', 'jpeg'];
  const suffixArray = Array.isArray(fileSuffix) ? fileSuffix : [fileSuffix];
  // suffix.toLowerCase()
  return suffixArray.some((suffix) => arr.includes(suffix.toLowerCase()));
}
/** 取消按钮 */
function cancel() {
  dialog.visible = false;
  reset();
}
/** 表单重置 */
function reset() {
  form.value = { ...initFormData };
  ossFormRef.value?.resetFields();
}
/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}
/** 重置按钮操作 */
function resetQuery() {
  showTable.value = false;
  dateRangeCreateTime.value = ['', ''];
  queryFormRef.value?.resetFields();
  // queryParams.value.orderByColumn = defaultSort.value.prop;
  // queryParams.value.isAsc = defaultSort.value.order;
  handleQuery();
}
/** 选择条数  */
function handleSelectionChange(selection: FileVO[]) {
  ids.value = selection.map((item) => item.id);
  single.value = selection.length != 1;
  multiple.value = !selection.length;
}
/** 设置列的排序为我们自定义的排序 */
const handleHeaderClass = ({ column }: any): any => {
  column.order = column.multiOrder;
};
/** 点击表头进行排序 */
const handleHeaderCLick = (column: any) => {
  if (column.sortable !== 'custom') {
    return;
  }
  switch (column.multiOrder) {
    case 'descending':
      column.multiOrder = 'ascending';
      break;
    case 'ascending':
      column.multiOrder = '';
      break;
    default:
      column.multiOrder = 'descending';
      break;
  }
  handleOrderChange(column.property, column.multiOrder);
};
const handleOrderChange = (prop: string, order: string) => {
  let orderByArr = []; //queryParams.value.orderByColumn ? queryParams.value.orderByColumn.split(',') : [];
  let isAscArr = []; //queryParams.value.isAsc ? queryParams.value.isAsc.split(',') : [];
  let propIndex = orderByArr.indexOf(prop);
  if (propIndex !== -1) {
    if (order) {
      //排序里已存在 只修改排序
      isAscArr[propIndex] = order;
    } else {
      //如果order为null 则删除排序字段和属性
      isAscArr.splice(propIndex, 1); //删除排序
      orderByArr.splice(propIndex, 1); //删除属性
    }
  } else {
    //排序里不存在则新增排序
    orderByArr.push(prop);
    isAscArr.push(order);
  }
  //合并排序
  // queryParams.value.orderByColumn = orderByArr.join(',');
  // queryParams.value.isAsc = isAscArr.join(',');
  getList();
};
/** 任务日志列表查询 */
const handleFileConfig = () => {
  router.push('/basics/file-config/index');
};
/** 文件按钮操作 */
const handleFile = () => {
  reset();
  type.value = 0;
  dialog.visible = true;
  dialog.title = '上传文件';
};
/** 图片按钮操作 */
const handleImage = () => {
  reset();
  type.value = 1;
  dialog.visible = true;
  dialog.title = '上传图片';
};
/** 提交按钮 */
const submitForm = () => {
  dialog.visible = false;
  getList();
};
/** 下载按钮操作 */
const handleDownload = (row: FileVO) => {
  proxy?.$download.file(row.id);
};
/** 预览开关按钮  */
const handlePreviewListResource = async (preview: boolean) => {
  let text = preview ? '启用' : '停用';
  try {
    await proxy?.$modal.confirm('确认要"' + text + '""预览列表图片"配置吗?');
    await proxy?.updateConfigByKey('sys.file.previewListResource', preview);
    await getList();
    proxy?.$modal.msgSuccess(text + '成功');
  } catch {
    return;
  }
};
/** 删除按钮操作 */
const handleDelete = async (row?: FileVO) => {
  const ossIds = row?.id || ids.value;
  await proxy?.$modal.confirm('是否确认删除OSS对象存储编号为"' + ossIds + '"的数据项?');
  loading.value = true;
  await delFile(ossIds).finally(() => (loading.value = false));
  await getList();
  proxy?.$modal.msgSuccess('删除成功');
};

onMounted(() => {
  getList();
});
</script>
