<template>
  <div class="tab-p-2">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-[10px]">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="供应商ID，所属供应商" prop="supplierId">
              <el-input v-model="queryParams.supplierId" placeholder="请输入供应商ID，所属供应商" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="模型ID" prop="modelId">
              <el-input v-model="queryParams.modelId" placeholder="请输入模型ID" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="模型展示名称" prop="name">
              <el-input v-model="queryParams.name" placeholder="请输入模型展示名称" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="模型上下文长度" prop="contextLen">
              <el-input v-model="queryParams.contextLen" placeholder="请输入模型上下文长度" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="最大token" prop="maxToken">
              <el-input v-model="queryParams.maxToken" placeholder="请输入最大token" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="函数调用方式：0：不支持，1：Function Call，2：Tool Call" prop="functionCalling">
              <el-input
                v-model="queryParams.functionCalling"
                placeholder="请输入函数调用方式：0：不支持，1：Function Call，2：Tool Call"
                clearable
                @keyup.enter="handleQuery"
              />
            </el-form-item>
            <el-form-item label="流式函数调用：0：不支持，1：支持" prop="streamFunctionCalling">
              <el-input
                v-model="queryParams.streamFunctionCalling"
                placeholder="请输入流式函数调用：0：不支持，1：支持"
                clearable
                @keyup.enter="handleQuery"
              />
            </el-form-item>
            <el-form-item label="是否视觉支持：0：不支持，1：支持" prop="vision">
              <el-input v-model="queryParams.vision" placeholder="请输入是否视觉支持：0：不支持，1：支持" clearable @keyup.enter="handleQuery" />
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
            <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['system:models:add']">新增</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()" v-hasPermi="['system:models:edit']">
              修改
            </el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()" v-hasPermi="['system:models:remove']">
              删除
            </el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="warning" plain icon="Download" @click="handleExport" v-hasPermi="['system:models:export']">导出</el-button>
          </el-col>
          <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
        </el-row>
      </template>

      <el-table v-loading="loading" :data="modelsList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column label="编号" align="center" prop="id" v-if="true" />
        <el-table-column label="供应商ID，所属供应商" align="center" prop="supplierId" />
        <el-table-column label="模型ID" align="center" prop="modelId" />
        <el-table-column label="模型展示名称" align="center" prop="name" />
        <el-table-column label="模型类型：1:LLM,2:Text Embedding,3:Rerank,4:TTS,5:Speech2text,6:Moderation" align="center" prop="type" />
        <el-table-column label="模型上下文长度" align="center" prop="contextLen" />
        <el-table-column label="最大token" align="center" prop="maxToken" />
        <el-table-column label="函数调用方式：0：不支持，1：Function Call，2：Tool Call" align="center" prop="functionCalling" />
        <el-table-column label="流式函数调用：0：不支持，1：支持" align="center" prop="streamFunctionCalling" />
        <el-table-column label="是否视觉支持：0：不支持，1：支持" align="center" prop="vision" />
        <el-table-column label="状态:0正常,1停用" align="center" prop="status" />
        <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip content="修改" placement="top">
              <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['system:models:edit']"></el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['system:models:remove']"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />
    </el-card>
    <!-- 添加或修改模型对话框 -->
    <el-dialog :title="dialog.title" v-model="dialog.visible" width="500px" append-to-body>
      <el-form ref="modelsFormRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="供应商ID，所属供应商" prop="supplierId">
          <el-input v-model="form.supplierId" placeholder="请输入供应商ID，所属供应商" />
        </el-form-item>
        <el-form-item label="模型ID" prop="modelId">
          <el-input v-model="form.modelId" placeholder="请输入模型ID" />
        </el-form-item>
        <el-form-item label="模型展示名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入模型展示名称" />
        </el-form-item>
        <el-form-item label="模型上下文长度" prop="contextLen">
          <el-input v-model="form.contextLen" placeholder="请输入模型上下文长度" />
        </el-form-item>
        <el-form-item label="最大token" prop="maxToken">
          <el-input v-model="form.maxToken" placeholder="请输入最大token" />
        </el-form-item>
        <el-form-item label="函数调用方式：0：不支持，1：Function Call，2：Tool Call" prop="functionCalling">
          <el-input v-model="form.functionCalling" placeholder="请输入函数调用方式：0：不支持，1：Function Call，2：Tool Call" />
        </el-form-item>
        <el-form-item label="流式函数调用：0：不支持，1：支持" prop="streamFunctionCalling">
          <el-input v-model="form.streamFunctionCalling" placeholder="请输入流式函数调用：0：不支持，1：支持" />
        </el-form-item>
        <el-form-item label="是否视觉支持：0：不支持，1：支持" prop="vision">
          <el-input v-model="form.vision" placeholder="请输入是否视觉支持：0：不支持，1：支持" />
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

<script setup name="Models" lang="ts">
import { ComponentInternalInstance, getCurrentInstance, onMounted, reactive, ref } from 'vue';
import { listModels, getModels, delModels, addModels, updateModels } from '@/api/ai-llm/models';
import { ModelsVO, ModelsQuery, ModelsForm } from '@/api/ai-llm/models/types';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const modelsList = ref<ModelsVO[]>([]);
const buttonLoading = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);

const queryFormRef = ref<ElFormInstance>();
const modelsFormRef = ref<ElFormInstance>();

const dialog = reactive<DialogOption>({
  visible: false,
  title: ''
});

const initFormData: ModelsForm = {
  id: undefined,
  supplierId: undefined,
  modelId: undefined,
  name: undefined,
  type: undefined,
  contextLen: undefined,
  maxToken: undefined,
  functionCalling: undefined,
  streamFunctionCalling: undefined,
  vision: undefined,
  status: undefined
};
const data = reactive<PageData<ModelsForm, ModelsQuery>>({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    supplierId: undefined,
    modelId: undefined,
    name: undefined,
    type: undefined,
    contextLen: undefined,
    maxToken: undefined,
    functionCalling: undefined,
    streamFunctionCalling: undefined,
    vision: undefined,
    status: undefined,
    params: {}
  },
  rules: {
    id: [{ required: true, message: '编号不能为空', trigger: 'blur' }],
    supplierId: [{ required: true, message: '供应商ID，所属供应商不能为空', trigger: 'blur' }],
    modelId: [{ required: true, message: '模型ID不能为空', trigger: 'blur' }],
    name: [{ required: true, message: '模型展示名称不能为空', trigger: 'blur' }],
    type: [{ required: true, message: '模型类型：1:LLM,2:Text Embedding,3:Rerank,4:TTS,5:Speech2text,6:Moderation不能为空', trigger: 'change' }],
    contextLen: [{ required: true, message: '模型上下文长度不能为空', trigger: 'blur' }],
    maxToken: [{ required: true, message: '最大token不能为空', trigger: 'blur' }],
    functionCalling: [{ required: true, message: '函数调用方式：0：不支持，1：Function Call，2：Tool Call不能为空', trigger: 'blur' }],
    streamFunctionCalling: [{ required: true, message: '流式函数调用：0：不支持，1：支持不能为空', trigger: 'blur' }],
    vision: [{ required: true, message: '是否视觉支持：0：不支持，1：支持不能为空', trigger: 'blur' }],
    status: [{ required: true, message: '状态:0正常,1停用不能为空', trigger: 'change' }]
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询模型列表 */
const getList = async () => {
  loading.value = true;
  const res = await listModels(queryParams.value);
  modelsList.value = res.rows;
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
  modelsFormRef.value?.resetFields();
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
const handleSelectionChange = (selection: ModelsVO[]) => {
  ids.value = selection.map((item) => item.id);
  single.value = selection.length != 1;
  multiple.value = !selection.length;
};

/** 新增按钮操作 */
const handleAdd = () => {
  reset();
  dialog.visible = true;
  dialog.title = '添加模型';
};

/** 修改按钮操作 */
const handleUpdate = async (row?: ModelsVO) => {
  reset();
  const _id = row?.id || ids.value[0];
  const res = await getModels(_id);
  Object.assign(form.value, res.data);
  dialog.visible = true;
  dialog.title = '修改模型';
};

/** 提交按钮 */
const submitForm = () => {
  modelsFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      buttonLoading.value = true;
      if (form.value.id) {
        await updateModels(form.value).finally(() => (buttonLoading.value = false));
      } else {
        await addModels(form.value).finally(() => (buttonLoading.value = false));
      }
      proxy?.$modal.msgSuccess('操作成功');
      dialog.visible = false;
      await getList();
    }
  });
};

/** 删除按钮操作 */
const handleDelete = async (row?: ModelsVO) => {
  const _ids = row?.id || ids.value;
  await proxy?.$modal.confirm('是否确认删除模型编号为"' + _ids + '"的数据项？').finally(() => (loading.value = false));
  await delModels(_ids);
  proxy?.$modal.msgSuccess('删除成功');
  await getList();
};

/** 导出按钮操作 */
const handleExport = () => {
  proxy?.download(
    'system/models/export',
    {
      ...queryParams.value
    },
    `models_${new Date().getTime()}.xlsx`
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
