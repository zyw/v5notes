<template>
  <div class="tab-p-2">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-[10px]">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="名称" prop="name">
              <el-input v-model="queryParams.name" placeholder="请输入供应商名称支持模糊查询" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="文件类型" prop="type">
              <el-select v-model="queryParams.status" placeholder="状态" clearable>
                <el-option label="全部" value="" />
                <el-option label="正常" value="0" />
                <el-option label="停用" value="1" />
              </el-select>
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
            <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['system:modelSuppliers:add']">新增</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()" v-hasPermi="['system:modelSuppliers:edit']">
              修改
            </el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()" v-hasPermi="['system:modelSuppliers:remove']">
              删除
            </el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="warning" plain icon="Download" @click="handleExport" v-hasPermi="['system:modelSuppliers:export']">导出</el-button>
          </el-col>
          <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
        </el-row>
      </template>

      <el-table v-loading="loading" :data="modelSuppliersList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column label="编号" align="center" prop="id" v-if="true" />
        <el-table-column label="名称" align="center" prop="name" />
        <el-table-column label="图标" align="center" prop="icon" />
        <el-table-column label="API地址" align="center" prop="baseUrl" />
        <el-table-column label="API Key" align="center" prop="apiKey" />
        <el-table-column label="API版本" align="center" prop="apiVersion" />
        <el-table-column label="保持时间/分" align="center" prop="activeDuration" />
        <el-table-column label="状态" align="center" prop="status" />
        <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip content="修改" placement="top">
              <el-button v-hasPermi="['system:modelSuppliers:edit']" link type="primary" icon="Edit" @click="handleUpdate(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button v-hasPermi="['system:modelSuppliers:remove']" link type="primary" icon="Delete" @click="handleDelete(scope.row)"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>
    <!-- 添加或修改模型供应商对话框 -->
    <el-dialog v-model="dialog.visible" :title="dialog.title" width="700px" append-to-body>
      <el-form ref="modelSuppliersFormRef" :model="form" :rules="rules" label-width="98px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入供应商名称，如：deepseek,通义千问" />
        </el-form-item>
        <el-form-item label="图标" prop="icon">
          <el-input v-model="form.icon" placeholder="请输入LLM供应商图标URL" />
        </el-form-item>
        <el-form-item label="API Key" prop="apiKey">
          <el-input v-model="form.apiKey" placeholder="请输入API Key" />
        </el-form-item>
        <el-form-item label="API地址" prop="baseUrl">
          <el-input v-model="form.baseUrl" placeholder="请输入API地址" />
        </el-form-item>
        <el-form-item label="API版本" prop="apiVersion">
          <el-input v-model="form.apiVersion" placeholder="请输入API版本" />
        </el-form-item>
        <el-form-item label="保持时间/分" prop="activeDuration">
          <el-input v-model="form.activeDuration" placeholder="请输入保持时间/分" />
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

<script setup name="ModelSuppliers" lang="ts">
import { ComponentInternalInstance, getCurrentInstance, reactive, ref } from 'vue';
import { listModelSuppliers, getModelSuppliers, delModelSuppliers, addModelSuppliers, updateModelSuppliers } from '@/api/ai-llm/modelSuppliers';
import { ModelSuppliersVO, ModelSuppliersQuery, ModelSuppliersForm } from '@/api/ai-llm/modelSuppliers/types';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const modelSuppliersList = ref<ModelSuppliersVO[]>([]);
const buttonLoading = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);

const queryFormRef = ref<ElFormInstance>();
const modelSuppliersFormRef = ref<ElFormInstance>();

const dialog = reactive<DialogOption>({
  visible: false,
  title: ''
});

const initFormData: ModelSuppliersForm = {
  id: undefined,
  name: undefined,
  icon: undefined,
  baseUrl: undefined,
  apiKey: undefined,
  apiVersion: undefined,
  activeDuration: undefined,
  status: undefined
};
const data = reactive<PageData<ModelSuppliersForm, ModelSuppliersQuery>>({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    name: undefined,
    status: undefined,
    params: {}
  },
  rules: {
    name: [{ required: true, message: '名称不能为空', trigger: 'blur' }],
    icon: [{ required: true, message: '图标不能为空', trigger: 'blur' }],
    baseUrl: [{ required: true, message: 'API地址不能为空', trigger: 'blur' }],
    apiKey: [{ required: true, message: 'API Key不能为空', trigger: 'blur' }],
    activeDuration: [{ required: true, message: '保持时间不能为空', trigger: 'blur' }]
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询模型供应商列表 */
const getList = async () => {
  loading.value = true;
  const res = await listModelSuppliers(queryParams.value);
  modelSuppliersList.value = res.rows;
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
  modelSuppliersFormRef.value?.resetFields();
};

/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

/** 重置按钮操作 */
const resetQuery = () => {
  queryFormRef.value?.resetFields();
  handleQuery();
};

/** 多选框选中数据 */
const handleSelectionChange = (selection: ModelSuppliersVO[]) => {
  ids.value = selection.map((item) => item.id);
  single.value = selection.length != 1;
  multiple.value = !selection.length;
};

/** 新增按钮操作 */
const handleAdd = () => {
  reset();
  dialog.visible = true;
  dialog.title = '添加供应商';
};

/** 修改按钮操作 */
const handleUpdate = async (row?: ModelSuppliersVO) => {
  reset();
  const _id = row?.id || ids.value[0];
  const res = await getModelSuppliers(_id);
  Object.assign(form.value, res.data);
  dialog.visible = true;
  dialog.title = '修改供应商';
};

/** 提交按钮 */
const submitForm = () => {
  modelSuppliersFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      buttonLoading.value = true;
      if (form.value.id) {
        await updateModelSuppliers(form.value).finally(() => (buttonLoading.value = false));
      } else {
        await addModelSuppliers(form.value).finally(() => (buttonLoading.value = false));
      }
      proxy?.$modal.msgSuccess('操作成功');
      dialog.visible = false;
      await getList();
    }
  });
};

/** 删除按钮操作 */
const handleDelete = async (row?: ModelSuppliersVO) => {
  const _ids = row?.id || ids.value;
  await proxy?.$modal.confirm('是否确认删除模型供应商编号为"' + _ids + '"的数据项？').finally(() => (loading.value = false));
  await delModelSuppliers(_ids);
  proxy?.$modal.msgSuccess('删除成功');
  await getList();
};

/** 导出按钮操作 */
const handleExport = () => {
  proxy?.download(
    'system/modelSuppliers/export',
    {
      ...queryParams.value
    },
    `modelSuppliers_${new Date().getTime()}.xlsx`
  );
};

onMounted(() => {
  getList();
});
</script>
<style>
.tab-p-2 {
  padding-top: 0.5rem;
}
</style>
