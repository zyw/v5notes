<template>
  <!-- 导入表 -->
  <el-dialog v-model="visible" title="导入表" width="85%" top="4vh" append-to-body>
    <el-card shadow="hover" style="margin-bottom: 10px">
      <el-form ref="queryFormRef" :model="queryParams" :inline="true">
        <el-form-item label="数据源" prop="dataName">
          <el-select v-model="queryParams.dataName" filterable placeholder="请选择/输入数据源名称">
            <el-option v-for="item in dataNameList" :key="item" :label="item" :value="item"> </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="表名称" prop="tableName">
          <el-input v-model="queryParams.tableName" placeholder="请输入表名称" clearable @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="表描述" prop="tableComment">
          <el-input v-model="queryParams.tableComment" placeholder="请输入表描述" clearable @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
    <el-card shadow="hover" style="margin-bottom: 10px">
      <el-form ref="tableFormRef" :model="tableParams" :inline="true" :rules="tableRules">
        <el-form-item label="后端模版类型" prop="beType" label-width="110px">
          <el-select v-model="tableParams.beType" filterable placeholder="请选择后端模版类型">
            <el-option v-for="item in beTypeDicts" :key="item.dictCode" :label="item.dictLabel" :value="item.dictValue"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="前端模版类型" prop="feType" label-width="110px">
          <el-select v-model="tableParams.feType" filterable placeholder="请选择前端模版类型">
            <el-option v-for="item in feTypeDicts" :key="item.dictCode" :label="item.dictLabel" :value="item.dictValue"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="包名称" prop="packageName">
          <el-input v-model="tableParams.packageName" placeholder="请输入包名称/模块名称" clearable />
        </el-form-item>
        <el-form-item label="模块名称" prop="moduleName">
          <el-input v-model="tableParams.moduleName" placeholder="请输入模块名称" clearable />
        </el-form-item>
      </el-form>
    </el-card>
    <el-row>
      <el-table ref="tableRef" :data="dbTableList" height="260px" @row-click="clickRow" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55"></el-table-column>
        <el-table-column prop="tableName" label="表名称" :show-overflow-tooltip="true"></el-table-column>
        <el-table-column prop="tableComment" label="表描述" :show-overflow-tooltip="true"></el-table-column>
        <el-table-column prop="createTime" label="创建时间"></el-table-column>
        <el-table-column prop="updateTime" label="更新时间"></el-table-column>
      </el-table>
      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-row>
    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary" @click="handleImportTable">确 定</el-button>
        <el-button @click="visible = false">取 消</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { listDbTable, importTable, getDataNames } from '@/api/tool/gen';
import { DbTableQuery, DbTableVO, ImportTableForm } from '@/api/tool/gen/types';
import { getDicts } from '@/api/system/dict/data';
import { DictDataVO } from '@/api/system/dict/data/types';

const total = ref(0);
const visible = ref(false);
const tables = ref<Array<string>>([]);
const dbTableList = ref<Array<DbTableVO>>([]);
const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const tableRef = ref<ElTableInstance>();
const queryFormRef = ref<ElFormInstance>();
const tableFormRef = ref<ElFormInstance>();

const tableParams = reactive<ImportTableForm>({
  beType: 'java',
  feType: 'default',
  packageName: '',
  moduleName: ''
});

const tableRules = reactive<any>({
  beType: [{ required: true, message: '请选择后端模版类型', trigger: 'blur' }],
  feType: [{ required: true, message: '请选择前端模版类型', trigger: 'blur' }],
  packageName: [{ required: true, message: '请输入包名称/模块名称', trigger: 'blur' }]
});

const queryParams = reactive<DbTableQuery>({
  pageNum: 1,
  pageSize: 10,
  dataName: '',
  tableName: '',
  tableComment: ''
});
const dataNameList = ref<Array<string>>([]);

const emit = defineEmits(['ok']);

const clearTableParams = () => {
  tableParams.beType = 'java';
  tableParams.feType = 'default';
  tableParams.packageName = '';
  tableParams.moduleName = '';
};

/** 查询参数列表 */
const show = (dataName: string) => {
  getDataNameList();
  if (dataName) {
    queryParams.dataName = dataName;
  } else {
    queryParams.dataName = 'master';
  }
  getList();
  visible.value = true;
};
/** 单击选择行 */
const clickRow = (row: DbTableVO) => {
  // ele bug
  tableRef.value?.toggleRowSelection(row, false);
};
/** 多选框选中数据 */
const handleSelectionChange = (selection: DbTableVO[]) => {
  tables.value = selection.map((item) => item.tableName);
};
/** 查询表数据 */
const getList = async () => {
  const res = await listDbTable(queryParams);
  dbTableList.value = res.rows;
  total.value = res.total;
};
/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};
/** 重置按钮操作 */
const resetQuery = () => {
  queryFormRef.value?.resetFields();
  handleQuery();
};
/** 导入按钮操作 */
const handleImportTable = async () => {
  const tableNames = tables.value.join(',');
  if (tableNames == '') {
    proxy?.$modal.msgError('请选择要导入的表');
    return;
  }
  tableFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      const data: ImportTableForm = {
        tableNames,
        dataName: queryParams.dataName,
        ...tableParams
      };
      const res = await importTable(data);
      proxy?.$modal.msgSuccess(res.msg);
      if (res.code === 200) {
        clearTableParams();
        visible.value = false;
        emit('ok');
      }
    }
  });
};
/** 查询多数据源名称 */
const getDataNameList = async () => {
  const res = await getDataNames();
  dataNameList.value = res.data;
};

const beTypeDicts = ref<DictDataVO[]>([]);
const feTypeDicts = ref<DictDataVO[]>([]);
/** 获取字典数据 */
const getBeTypeDictData = async () => {
  const res = await getDicts('gen_be_type');
  beTypeDicts.value = res.data;
};
/** 获取前端模版类型字典数据 */
const getFeTypeDictData = async () => {
  const res = await getDicts('gen_fe_type');
  feTypeDicts.value = res.data;
};

defineExpose({
  show
});

onMounted(() => {
  getBeTypeDictData();
  getFeTypeDictData();
});
</script>
