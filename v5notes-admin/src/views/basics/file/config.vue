<template>
  <div class="p-2">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-[10px]">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true" label-width="68px">
            <el-form-item label="配置名" prop="name">
              <el-input v-model="queryParams.name" placeholder="请输入配置名" clearable style="width: 240px" @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="存储器" prop="storage">
              <el-select v-model="queryParams.storage" placeholder="请输入存储器" style="width: 240px" @change="handleQuery">
                <el-option v-for="item in dicts" :key="item.dictCode" :label="item.dictLabel" :value="item.dictValue" />
              </el-select>
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
            <el-button v-hasPermi="['basics:fileConfig:add']" type="primary" plain icon="Plus" @click="handleAdd">新增</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['basics:fileConfig:edit']" type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()">
              修改
            </el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['basics:fileConfig:remove']" type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()">
              删除
            </el-button>
          </el-col>
          <!-- <el-col :span="1.5">
            <el-button v-hasPermi="['basics:fileConfig:export']" type="warning" plain icon="Download" @click="handleExport">导出</el-button>
          </el-col> -->
          <right-toolbar v-model:showSearch="showSearch" @query-table="getList"></right-toolbar>
        </el-row>
      </template>

      <el-table v-loading="loading" :data="fileConfigList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column label="序号" type="index" width="50" :index="hIndex" />
        <!-- <el-table-column v-if="true" label="编号" align="center" prop="id" /> -->
        <el-table-column label="配置名" align="center" prop="name" />
        <el-table-column label="存储器" align="center" prop="storage">
          <template #default="scope">
            <el-tag type="primary">{{ storageFormatter(scope.row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="备注" align="center" prop="remark" />
        <el-table-column label="主配置" align="center" prop="master">
          <template #default="scope">
            <el-tag round :type="scope.row.master ? 'success' : 'info'" disable-transitions>{{ scope.row.master ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" align="center" prop="createTime" />
        <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip content="设为主配置" placement="top">
              <el-button v-hasPermi="['basics:fileConfig:edit']" link type="primary" @click="handleMaster(scope.row)">
                <svg-icon icon-class="master" />
              </el-button>
            </el-tooltip>
            <el-tooltip content="修改" placement="top">
              <el-button v-hasPermi="['basics:fileConfig:edit']" link type="primary" icon="Edit" @click="handleUpdate(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button v-hasPermi="['basics:fileConfig:remove']" link type="primary" icon="Delete" @click="handleDelete(scope.row)"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>
    <!-- 添加或修改文件配置对话框 -->
    <el-dialog v-model="dialog.visible" :title="dialog.title" width="800px" append-to-body>
      <el-form ref="fileConfigFormRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="配置名" prop="name">
          <el-input v-model="form.name" placeholder="请输入配置名" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" placeholder="请输入备注" />
        </el-form-item>
        <el-form-item label="存储器" prop="storage">
          <el-select v-model="form.storage" placeholder="请输入存储器" style="width: 100%">
            <el-option v-for="item in dicts" :key="item.dictValue" :label="item.dictLabel" :value="Number(item.dictValue)" />
          </el-select>
        </el-form-item>
        <template v-if="form.storage == 100">
          <el-form-item label="基础路径" prop="config.basePath">
            <el-input v-model="form.config.basePath" placeholder="请输入基础路径" />
          </el-form-item>
          <el-form-item label="自定义域名" prop="config.domain">
            <el-input v-model="form.config.domain" placeholder="请输入自定义域名" />
          </el-form-item>
        </template>
        <template v-if="form.storage == 101">
          <el-form-item label="自定义域名" prop="config.domain">
            <el-input v-model="form.config.domain" placeholder="请输入自定义域名" />
          </el-form-item>
        </template>
        <template v-if="form.storage == 102 || form.storage == 103">
          <el-form-item label="基础路径" prop="config.basePath">
            <el-input v-model="form.config.basePath" placeholder="请输入基础路径" />
          </el-form-item>
          <el-form-item label="主机地址" prop="config.host">
            <el-input v-model="form.config.host" placeholder="请输入主机地址" />
          </el-form-item>
          <el-form-item label="主机端口" prop="config.port">
            <el-input-number v-model="form.config.port" :min="1" :max="65535" placeholder="请输入主机端口" />
          </el-form-item>
          <el-form-item label="用户名" prop="config.username">
            <el-input v-model="form.config.username" placeholder="请输入用户名" />
          </el-form-item>
          <el-form-item label="密码" prop="config.password">
            <el-input v-model="form.config.password" placeholder="请输入密码" />
          </el-form-item>
          <template v-if="form.storage == 102">
            <el-form-item label="连接模式" prop="config.mode">
              <el-radio-group v-model="form.config.mode">
                <el-radio label="Active">主动模式</el-radio>
                <el-radio label="Passive">被动模式</el-radio>
              </el-radio-group>
            </el-form-item>
          </template>
          <el-form-item label="自定义域名" prop="config.domain">
            <el-input v-model="form.config.domain" placeholder="请输入自定义域名" />
          </el-form-item>
        </template>
        <template v-if="form.storage == 104">
          <el-form-item label="节点地址" prop="config.endpoint">
            <el-input v-model="form.config.endpoint" placeholder="请输入节点地址" />
          </el-form-item>
          <el-form-item label="存储 bucket" prop="config.bucket">
            <el-input v-model="form.config.bucket" placeholder="请输入存储 bucket" />
          </el-form-item>
          <el-form-item label="accessKey" prop="config.accessKey">
            <el-input v-model="form.config.accessKey" placeholder="请输入accessKey" />
          </el-form-item>
          <el-form-item label="accessSecret" prop="config.accessSecret">
            <el-input v-model="form.config.accessSecret" placeholder="请输入accessSecret" />
          </el-form-item>
          <el-form-item label="桶权限类型" prop="config.accessPolicy">
            <el-radio-group v-model="form.config.accessPolicy">
              <el-radio value="0" size="large">private</el-radio>
              <el-radio value="1" size="large">public</el-radio>
              <el-radio value="2" size="large">custom</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="自定义域名">
            <el-input v-model="form.config.domain" placeholder="请输入自定义域名" />
          </el-form-item>
        </template>
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

<script setup name="FileConfig" lang="ts">
import { listFileConfig, getFileConfig, delFileConfig, addFileConfig, updateFileConfig, updateMasterConfig } from '@/api/basics/fileConfig';
import { FileConfigVO, FileConfigQuery, FileConfigForm, FileClientConfig } from '@/api/basics/fileConfig/types';
import { getDicts } from '@/api/system/dict/data';
import { DictDataVO } from '@/api/system/dict/data/types';
import { FormRules } from 'element-plus';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const fileConfigList = ref<FileConfigVO[]>([]);
const buttonLoading = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);

const queryFormRef = ref<ElFormInstance>();
const fileConfigFormRef = ref<ElFormInstance>();

const dialog = reactive<DialogOption>({
  visible: false,
  title: ''
});

const initFormData: FileConfigForm = {
  id: undefined,
  name: undefined,
  storage: undefined,
  remark: undefined,
  config: {} as FileClientConfig
};
const data = reactive<PageData<FileConfigForm, FileConfigQuery>>({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    name: undefined,
    storage: undefined,
    createTime: undefined
  },
  rules: {
    id: [{ required: true, message: '编号不能为空', trigger: 'blur' }],
    name: [{ required: true, message: '配置名不能为空', trigger: 'blur' }],
    storage: [{ required: true, message: '存储器不能为空', trigger: 'blur' }],
    remark: [{ required: true, message: '备注不能为空', trigger: 'blur' }],
    config: {
      basePath: [{ required: true, message: '基础路径不能为空', trigger: 'blur' }],
      host: [{ required: true, message: '主机地址不能为空', trigger: 'blur' }],
      port: [{ required: true, message: '主机端口不能为空', trigger: 'blur' }],
      username: [{ required: true, message: '用户名不能为空', trigger: 'blur' }],
      password: [{ required: true, message: '密码不能为空', trigger: 'blur' }],
      mode: [{ required: true, message: '连接模式不能为空', trigger: 'change' }],
      endpoint: [{ required: true, message: '节点地址不能为空', trigger: 'blur' }],
      bucket: [{ required: true, message: '存储 bucket 不能为空', trigger: 'blur' }],
      accessKey: [{ required: true, message: 'accessKey 不能为空', trigger: 'blur' }],
      accessSecret: [{ required: true, message: 'accessSecret 不能为空', trigger: 'blur' }],
      domain: [{ required: true, message: '自定义域名不能为空', trigger: 'blur' }]
    } as FormRules
  }
});

const { queryParams, form, rules } = toRefs(data);

const hIndex = (index: number) => {
  return index + 1 + (queryParams.value.pageNum - 1) * queryParams.value.pageSize;
};

const storageFormatter = (row: any) => {
  const dict = dicts.value.find((item) => item.dictValue == row.storage);
  return dict?.dictLabel || '';
};

/** 查询文件配置列表 */
const getList = async () => {
  loading.value = true;
  const res = await listFileConfig(queryParams.value);
  fileConfigList.value = res.rows;
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
  fileConfigFormRef.value?.resetFields();
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
const handleSelectionChange = (selection: FileConfigVO[]) => {
  ids.value = selection.map((item) => item.id);
  single.value = selection.length != 1;
  multiple.value = !selection.length;
};

/** 新增按钮操作 */
const handleAdd = () => {
  reset();
  dialog.visible = true;
  dialog.title = '添加文件配置';
};

/** 修改按钮操作 */
const handleUpdate = async (row?: FileConfigVO) => {
  reset();
  const _id = row?.id || ids.value[0];
  const res = await getFileConfig(_id);
  Object.assign(form.value, res.data);
  dialog.visible = true;
  dialog.title = '修改文件配置';
};

/** 提交按钮 */
const submitForm = () => {
  fileConfigFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      buttonLoading.value = true;
      if (form.value.id) {
        await updateFileConfig(form.value).finally(() => (buttonLoading.value = false));
      } else {
        await addFileConfig(form.value).finally(() => (buttonLoading.value = false));
      }
      proxy?.$modal.msgSuccess('操作成功');
      dialog.visible = false;
      await getList();
    }
  });
};

/** 删除按钮操作 */
const handleDelete = async (row?: FileConfigVO) => {
  const _ids = row?.id || ids.value;
  const _names = row?.name || fileConfigList.value.filter((item) => ids.value.includes(item.id)).map((item) => item.name);
  const result = await proxy?.$modal
    .confirm('是否确认删除文件配置编号为"' + _names + '"的数据项？')
    .catch((err) => err)
    .finally(() => (loading.value = false));

  if (result === 'confirm') {
    await delFileConfig(_ids);
    proxy?.$modal.msgSuccess('删除成功');
    await getList();
  }
};

/** 导出按钮操作 */
// const handleExport = () => {
//   proxy?.download(
//     fileBaseUrl + '/export',
//     {
//       ...queryParams.value
//     },
//     `fileConfig_${new Date().getTime()}.xlsx`
//   );
// };

const dicts = ref<DictDataVO[]>([]);
/** 获取字典数据 */
const getDictData = async () => {
  const res = await getDicts('basics_file_storage');
  dicts.value = res.data;
};

/** 设置主配置 */
const handleMaster = async (row: FileConfigVO) => {
  const _id = row.id;
  const res = await updateMasterConfig(_id);
  proxy?.$modal.msgSuccess(res.code === 200 ? '设置主配置成功' : '取消主配置成功');
  await getList();
};

onMounted(() => {
  getList();
  getDictData();
});
</script>
