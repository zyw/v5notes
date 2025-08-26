<template>
  <div class="p-2">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-[10px]">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="所属目录" prop="pid">
              <el-tree-select
                v-model="queryParams.pid"
                :data="dirTreeData"
                value-key="id"
                default-expand-all
                check-strictly
                :render-after-expand="false"
                placeholder="请选择所属目录"
              />
            </el-form-item>
            <el-form-item label="目录名称" prop="name">
              <el-input v-model="queryParams.name" placeholder="请输入目录名称" clearable @keyup.enter="handleQuery" />
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
            <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['system:directory:add']">新增</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()" v-hasPermi="['system:directory:edit']">修改</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()" v-hasPermi="['system:directory:remove']">删除</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="warning" plain icon="Download" @click="handleExport" v-hasPermi="['system:directory:export']">导出</el-button>
          </el-col>
          <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
        </el-row>
      </template>

      <el-table v-loading="loading" :data="directoryList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column label="ID" align="center" prop="id" v-if="true" />
        <!-- <el-table-column label="目录所属用户ID" align="center" prop="userId" /> -->
        <el-table-column label="目录名称" align="center" prop="name" />
        <!-- <el-table-column label="父目录ID" align="center" prop="pid" /> -->
        <el-table-column label="描述" align="center" prop="descr" />
        <el-table-column label="创建时间" align="center" prop="createTime" width="180">
          <template #default="scope">
            <span>{{ parseTime(scope.row.createTime, '{y}-{m}-{d}') }}</span>
          </template>
        </el-table-column>
        <!-- <el-table-column label="创建部门" align="center" prop="createdDept" />
        <el-table-column label="创建者" align="center" prop="createdBy" />
        
        <el-table-column label="更新者" align="center" prop="updatedBy" />
        <el-table-column label="更新时间" align="center" prop="updatedTime" width="180">
          <template #default="scope">
            <span>{{ parseTime(scope.row.updatedTime, '{y}-{m}-{d}') }}</span>
          </template>
        </el-table-column> -->
        <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip content="修改" placement="top">
              <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['system:directory:edit']"></el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['system:directory:remove']"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />
    </el-card>
    <!-- 添加或修改目录对话框 -->
    <el-dialog :title="dialog.title" v-model="dialog.visible" width="500px" append-to-body>
      <el-form ref="directoryFormRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="所属目录" prop="userId">
          <el-tree-select
                v-model="form.pid"
                :data="dirTreeData"
                value-key="id"
                default-expand-all
                check-strictly
                :render-after-expand="false"
                placeholder="请选择所属目录"
              />
        </el-form-item>
        <el-form-item label="目录名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入目录名称" />
        </el-form-item>
        <el-form-item label="描述" prop="descr">
          <el-input v-model="form.descr" placeholder="请输入描述" type="textarea" />
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

<script setup name="Directory" lang="ts">
import { listDirectory, getDirectory, delDirectory, addDirectory, updateDirectory, dirTree } from '@/api/notes/directory';
import { DirectoryVO, DirectoryQuery, DirectoryForm, NotesTreeVo } from '@/api/notes/directory/types';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const dateRange = ref<[DateModelType, DateModelType]>(['', '']);

const directoryList = ref<DirectoryVO[]>([]);
const buttonLoading = ref(false);
const loading = ref(true);
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

const dirTreeData = ref<NotesTreeVo[]>([{
  id: 0,
  label: '根节点',
  type: 1
} as NotesTreeVo]);

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
    pid: undefined,
    params: {}
  },
  rules: {
    id: [{ required: true, message: 'ID不能为空', trigger: 'blur' }],
    name: [{ required: true, message: '目录名称不能为空', trigger: 'blur' }],
    pid: [{ required: true, message: '父目录ID不能为空', trigger: 'blur' }],
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询目录列表 */
const getList = async () => {
  loading.value = true;
  const res = await listDirectory(proxy?.addDateRange(queryParams.value, dateRange.value));
  directoryList.value = res.rows;
  total.value = res.total;
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
  directoryFormRef.value?.resetFields();
};

/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
}

/** 重置按钮操作 */
const resetQuery = () => {
  dateRange.value = ['', ''];
  queryParams.value.pageNum = 1;
  queryFormRef.value?.resetFields();
  handleQuery();
}

/** 多选框选中数据 */
const handleSelectionChange = (selection: DirectoryVO[]) => {
  ids.value = selection.map((item) => item.id);
  single.value = selection.length != 1;
  multiple.value = !selection.length;
}

/** 新增按钮操作 */
const handleAdd = () => {
  reset();
  dialog.visible = true;
  dialog.title = "添加目录";
}

/** 修改按钮操作 */
const handleUpdate = async (row?: DirectoryVO) => {
  reset();
  const _id = row?.id || ids.value[0]
  const res = await getDirectory(_id);
  Object.assign(form.value, res.data);
  dialog.visible = true;
  dialog.title = "修改目录";
}

/** 提交按钮 */
const submitForm = () => {
  directoryFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      buttonLoading.value = true;
      if (form.value.id) {
        await updateDirectory(form.value).finally(() =>  buttonLoading.value = false);
      } else {
        await addDirectory(form.value).finally(() =>  buttonLoading.value = false);
      }
      proxy?.$modal.msgSuccess("操作成功");
      dialog.visible = false;
      await getList();
    }
  });
}

/** 删除按钮操作 */
const handleDelete = async (row?: DirectoryVO) => {
  const _ids = row?.id || ids.value;
  await proxy?.$modal.confirm('删除目录将删除目录下全部的子目录和笔记！！！是否确认删除目录编号为"' + _ids + '"的数据项？').finally(() => loading.value = false);
  await delDirectory(_ids);
  proxy?.$modal.msgSuccess("删除成功");
  await getList();
}

/** 导出按钮操作 */
const handleExport = () => {
  proxy?.download('system/directory/export', {
    ...queryParams.value
  }, `directory_${new Date().getTime()}.xlsx`)
}

const dirTreeList = async () => {
  const res = await dirTree()
  dirTreeData.value[0].children = res.data
}

onMounted(() => {
  dirTreeList();
  getList();
});
</script>
