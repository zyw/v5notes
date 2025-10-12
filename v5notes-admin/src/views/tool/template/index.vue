<template>
  <div class="p-2">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-[10px]">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="模版名称" prop="name">
              <el-input v-model="queryParams.name" placeholder="请输入模版名称" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="模板类型" prop="tpType">
              <el-select v-model="queryParams.tpType" filterable placeholder="请选择模版类型">
                <el-option v-for="item in tpTypeDicts" :key="item.dictCode" :label="item.dictLabel" :value="item.dictValue"></el-option>
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
            <el-button v-hasPermi="['generator:template:add']" type="primary" plain icon="Plus" @click="handleAdd">新增</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['generator:template:edit']" type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()">
              修改
            </el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['generator:template:remove']" type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()">
              删除
            </el-button>
          </el-col>
          <right-toolbar v-model:showSearch="showSearch" @query-table="getList"></right-toolbar>
        </el-row>
      </template>

      <el-table v-loading="loading" border :data="templateList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column v-if="true" label="ID" align="center" prop="id" width="174" />
        <el-table-column label="模版名称" align="center" prop="name" width="200" />
        <el-table-column label="模版类型" align="center" width="210">
          <template #default="scope">
            <dict-tag :options="tp_types" :value="scope.row.tpType" />
          </template>
        </el-table-column>
        <el-table-column label="文件路径" align="center" prop="filePath" width="auto" />
        <el-table-column label="状态" align="center" prop="status" width="80">
          <template #default="scope">
            <el-tag :type="scope.row.status === '0' ? 'danger' : 'success'">{{ scope.row.status === '0' ? '禁用' : '启用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" align="center" prop="createTime" width="160" />
        <el-table-column label="操作" align="center" fixed="right" class-name="small-padding fixed-width" width="120">
          <template #default="scope">
            <el-tooltip content="编辑模版" placement="top">
              <el-button
                v-hasPermi="['generator:template:edit-template']"
                link
                type="primary"
                icon="Memo"
                @click="handleEditTemplate(scope.row)"
              ></el-button>
            </el-tooltip>
            <el-tooltip content="修改" placement="top">
              <el-button v-hasPermi="['generator:template:edit']" link type="primary" icon="Edit" @click="handleUpdate(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button v-hasPermi="['generator:template:remove']" link type="primary" icon="Delete" @click="handleDelete(scope.row)"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:limit="queryParams.pageSize" v-model:page="queryParams.pageNum" :total="total" @pagination="getList" />
    </el-card>
    <!-- 添加或修改代码模版对话框 -->
    <el-dialog v-model="dialog.visible" :title="dialog.title" width="700px" append-to-body>
      <el-form ref="templateFormRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="模版名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入模版名称" />
        </el-form-item>
        <el-form-item label="模板类型" prop="tpType">
          <el-select v-model="form.tpType" filterable placeholder="请选择模版类型">
            <el-option v-for="item in tpTypeDicts" :key="item.dictCode" :label="item.dictLabel" :value="item.dictValue"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item prop="filePath">
          <template #label>
            <span>
              文件路径
              <el-popover width="450px" title="提示" placement="top">
                <template #reference>
                  <el-icon style="font-size: 15px"><Warning /></el-icon>
                </template>
                <div class="line-height-3">
                  <p>文件路径是支持模板语法和变量的，支持的变量包括：</p>
                  <p>${packageName}：包路径，例如：com.v5notes.generator</p>
                  <p>${pkPath}：包路径下划线命名格式，例如：com/v5notes/generator</p>
                  <p>${moduleName}：类名，例如：system-tool</p>
                  <p>${className}：类名，例如：userMapper</p>
                  <p>${ClassName}：类名驼峰命名格式，例如：UserMapper</p>
                  <p>${tableName}：表名，例如：user</p>
                  <p>${BusinessName}：业务名, 例如：SysUser</p>
                  <p>${businessName}：业务名驼峰命名格式，例如：sysUser</p>
                  <p>${business_name}：业务名下划线命名格式，例如：sys_user</p>
                  <p>${business__name}：业务名中横线命名格式，例如：sys-user</p>
                  <p>例如：/src/main/java/${packageName}/${ClassName}.java</p>
                </div>
              </el-popover>
            </span>
          </template>
          <!-- <el-input v-model="form.filePath" placeholder="请输入生成文件路径" /> -->
          <el-autocomplete v-model="form.filePath" :fetch-suggestions="querySearchAsync" class="w-50" placeholder="请输入生成文件路径">
            <template #loading>
              <el-icon class="is-loading">
                <svg class="circular" viewBox="0 0 20 20">
                  <g class="path2 loading-path" stroke-width="0" style="animation: none; stroke: none">
                    <circle r="3.375" class="dot1" rx="0" ry="0" />
                    <circle r="3.375" class="dot2" rx="0" ry="0" />
                    <circle r="3.375" class="dot4" rx="0" ry="0" />
                    <circle r="3.375" class="dot3" rx="0" ry="0" />
                  </g>
                </svg>
              </el-icon>
            </template>
          </el-autocomplete>
        </el-form-item>
        <el-form-item label="模板类别" prop="tpCategory">
          <el-select v-model="form.tpCategory" filterable placeholder="请选择模板类别">
            <el-option v-for="item in tpCategoryDicts" :key="item.dictCode" :label="item.dictLabel" :value="item.dictValue"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio value="1">正常</el-radio>
            <el-radio value="0">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button :loading="buttonLoading" type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="contentDialog" :title="code.title" width="80%" append-to-body>
      <monaco-editor v-model="code.content" :height="400" />
      <template #footer>
        <div class="dialog-footer">
          <el-button :loading="buttonLoading" type="primary" @click="submitTemplateForm">确 定</el-button>
          <el-button @click="contentCancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="Template" lang="ts">
import { listTemplate, getTemplate, delTemplate, addTemplate, updateTemplate, editTemplate, getAllFilePaths } from '@/api/tool/template';
import { TemplateVO, TemplateQuery, TemplateForm } from '@/api/tool/template/types';
import { getDicts } from '@/api/system/dict/data';
import { DictDataVO } from '@/api/system/dict/data/types';
import { encryptBase64Str } from '@/utils/crypto';
import { isLikelyXMLOrHTML } from '@/utils/common';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const { gen_be_type, gen_fe_type } = toRefs<any>(proxy?.useDict('gen_be_type', 'gen_fe_type'));
// 使用 computed 创建响应式依赖
const tp_types = computed(() => {
  return [...gen_be_type.value, ...gen_fe_type.value];
});

const templateList = ref<TemplateVO[]>([]);
const buttonLoading = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);

const queryFormRef = ref<ElFormInstance>();
const templateFormRef = ref<ElFormInstance>();

const tpTypeDicts = ref<DictDataVO[]>([]);
const tpCategoryDicts = ref<DictDataVO[]>([]);

const contentDialog = ref(false);

const code = reactive<{ id: number; title: string; content: string }>({ id: 0, title: '', content: '' });

const dialog = reactive<DialogOption>({
  visible: false,
  title: ''
});

const initFormData: TemplateForm = {
  id: undefined,
  tpType: undefined,
  tpCategory: undefined,
  name: undefined,
  filePath: undefined,
  status: '1'
};

const data = reactive<PageData<TemplateForm, TemplateQuery>>({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    tpType: undefined,
    name: undefined,
    status: '1',
    params: {}
  },
  rules: {
    id: [{ required: true, message: 'ID不能为空', trigger: 'blur' }],
    tpType: [{ required: true, message: '后端模版类型不能为空', trigger: 'change' }],
    name: [{ required: true, message: '模版名称不能为空', trigger: 'blur' }],
    filePath: [{ required: true, message: '生成文件路径不能为空', trigger: 'blur' }],
    status: [{ required: true, message: '状态:0正常,1停用不能为空', trigger: 'change' }]
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询gen_template;代码模版列表 */
const getList = async () => {
  loading.value = true;
  const res = await listTemplate(queryParams.value);
  templateList.value = res.rows;
  total.value = res.total;
  loading.value = false;
};

const querySearchAsync = async (queryString: string, cb: (arg: any) => void) => {
  const results = await findAllFilePaths(queryString);
  cb(results.map((item) => ({ value: item })));
};

const findAllFilePaths = async (filePath: string) => {
  const res = await getAllFilePaths(filePath);
  return res.data || [];
};

/** 取消按钮 */
const cancel = () => {
  reset();
  dialog.visible = false;
};

//** 取消模版编辑 */
const contentCancel = () => {
  code.content = '';
  contentDialog.value = false;
};

/** 表单重置 */
const reset = () => {
  form.value = { ...initFormData };
  templateFormRef.value?.resetFields();
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
const handleSelectionChange = (selection: TemplateVO[]) => {
  ids.value = selection.map((item) => item.id);
  single.value = selection.length != 1;
  multiple.value = !selection.length;
};

/** 新增按钮操作 */
const handleAdd = () => {
  reset();
  dialog.visible = true;
  dialog.title = '添加代码模版';
};

/** 修改按钮操作 */
const handleUpdate = async (row?: TemplateVO) => {
  reset();
  const _id = row?.id || ids.value[0];
  const res = await getTemplate(_id);
  Object.assign(form.value, res.data);
  dialog.visible = true;
  dialog.title = '修改代码模版';
};

/** 提交按钮 */
const submitForm = () => {
  templateFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      buttonLoading.value = true;
      if (form.value.id) {
        await updateTemplate(form.value).finally(() => (buttonLoading.value = false));
      } else {
        await addTemplate(form.value).finally(() => (buttonLoading.value = false));
      }
      proxy?.$modal.msgSuccess('操作成功');
      dialog.visible = false;
      await getList();
    }
  });
};

/** 删除按钮操作 */
const handleDelete = async (row?: TemplateVO) => {
  const _ids = row?.id || ids.value;
  await proxy?.$modal.confirm('是否确认删除代码模版编号为"' + _ids + '"的数据项？').finally(() => (loading.value = false));
  await delTemplate(_ids);
  proxy?.$modal.msgSuccess('删除成功');
  await getList();
};

const handleEditTemplate = async (row: TemplateVO) => {
  const res = await getTemplate(row.id);
  code.id = res.data.id as number;
  const content = res.data.content || '';
  code.content = content;
  code.title = '模版编辑' + (res.data.name || '');
  contentDialog.value = true;
};

/** 提交模版编辑 */
const submitTemplateForm = async () => {
  if (!code.content) {
    proxy?.$modal.msgWarning('模版内容不能为空');
    return;
  }

  buttonLoading.value = true;
  const params = {
    id: code.id,
    content: isLikelyXMLOrHTML(code.content) ? encryptBase64Str(code.content) : code.content
  };
  await editTemplate(params).finally(() => (buttonLoading.value = false));
  proxy?.$modal.msgSuccess('操作成功');
  contentDialog.value = false;
};

/** 获取字典数据 */
const getTpTypeDictData = async () => {
  const beRes = await getDicts('gen_be_type');
  const feRes = await getDicts('gen_fe_type');
  tpTypeDicts.value = beRes.data.concat(feRes.data);
};
/** 获取模版类别字典数据 */
const getTpCategoryDictData = async () => {
  const res = await getDicts('gen_tp_category');
  tpCategoryDicts.value = res.data;
};

onMounted(() => {
  getList();
  getTpTypeDictData();
  getTpCategoryDictData();
});
</script>
