<template>
  <div class="p-2 app-container monitor-operlog-page">
    <div class="search-wrap">
      <el-card shadow="hover" class="search-panel" :class="{ 'is-collapsed': !showSearch }">
        <template #header>
          <div class="panel-heading search-panel-toggle" @click.stop="showSearch = !showSearch">
            <div>
              <span class="panel-kicker">{{ $t('monitor.kicker.search') }}</span>
              <h3>{{ $t('common.filter') }}</h3>
            </div>
          </div>
        </template>
        <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="query-form">
          <el-form-item :label="$t('monitor.oper.operIp')" prop="operIp">
            <el-input v-model="queryParams.operIp" :placeholder="$t('common.pleaseInput', { label: $t('monitor.oper.operIp') })" clearable @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item :label="$t('monitor.oper.module')" prop="title">
            <el-input v-model="queryParams.title" :placeholder="$t('common.pleaseInput', { label: $t('monitor.oper.module') })" clearable @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item :label="$t('monitor.oper.operName')" prop="operName">
            <el-input
              v-model="queryParams.operName"
              :placeholder="$t('common.pleaseInput', { label: $t('monitor.oper.operName') })"
              clearable
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item :label="$t('monitor.oper.client')" prop="clientKey">
            <el-input v-model="queryParams.clientKey" :placeholder="$t('common.pleaseInput', { label: $t('monitor.oper.client') })" clearable @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item :label="$t('monitor.oper.deviceType')" prop="deviceType">
            <el-select v-model="queryParams.deviceType" :placeholder="$t('common.pleaseSelect', { label: $t('monitor.oper.deviceType') })" clearable>
              <el-option v-for="dict in sys_device_type" :key="dict.value" :label="dict.label" :value="dict.value" />
            </el-select>
          </el-form-item>
          <el-form-item :label="$t('monitor.oper.browser')" prop="browser">
            <el-input v-model="queryParams.browser" :placeholder="$t('common.pleaseInput', { label: $t('monitor.oper.browser') })" clearable @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item :label="$t('monitor.oper.os')" prop="os">
            <el-input v-model="queryParams.os" :placeholder="$t('common.pleaseInput', { label: $t('monitor.oper.os') })" clearable @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item :label="$t('common.type')" prop="businessType">
            <el-select v-model="queryParams.businessType" :placeholder="$t('monitor.oper.operType')" clearable>
              <el-option v-for="dict in sys_oper_type" :key="dict.value" :label="dict.label" :value="dict.value" />
            </el-select>
          </el-form-item>
          <el-form-item :label="$t('common.status')" prop="status">
            <el-select v-model="queryParams.status" :placeholder="$t('monitor.oper.operStatus')" clearable>
              <el-option v-for="dict in sys_common_status" :key="dict.value" :label="dict.label" :value="dict.value" />
            </el-select>
          </el-form-item>
          <el-form-item :label="$t('monitor.oper.operTime')" style="width: 308px">
            <el-date-picker
              v-model="dateRange"
              value-format="YYYY-MM-DD HH:mm:ss"
              type="daterange"
              range-separator="-"
              :start-placeholder="$t('common.startDate')"
              :end-placeholder="$t('common.endDate')"
              :default-time="[new Date(2000, 1, 1, 0, 0, 0), new Date(2000, 1, 1, 23, 59, 59)]"
            ></el-date-picker>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleQuery">{{ $t('common.search') }}</el-button>
            <el-button icon="Refresh" @click="resetQuery">{{ $t('common.reset') }}</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>

    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="panel-kicker">{{ $t('monitor.kicker.oper') }}</span>
            <h3>{{ $t('monitor.oper.title') }}</h3>
            <p>{{ $t('monitor.oper.summary', { total }) }}</p>
          </div>
          <div class="toolbar-actions">
            <el-button
              v-hasPermi="['monitor:operlog:remove']"
              type="danger"
              plain
              icon="Delete"
              :disabled="multiple"
              @click="handleDelete()"
            >
              {{ $t('common.delete') }}
            </el-button>
            <el-button
              v-hasPermi="['monitor:operlog:remove']"
              type="danger"
              plain
              icon="WarnTriangleFilled"
              @click="handleClean"
            >
              {{ $t('common.clear') }}
            </el-button>
            <el-button
              v-hasPermi="['monitor:operlog:export']"
              type="warning"
              plain
              icon="Download"
              @click="handleExport"
            >
              {{ $t('common.export') }}
            </el-button>
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList"></right-toolbar>
          </div>
        </div>
      </template>

      <el-table
        ref="operLogTableRef"
        v-loading="loading && (operlogList).length > 0"
        :data="operlogList"
        class="data-table"
        border
        :default-sort="defaultSort"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column :label="$t('monitor.oper.logId')" align="center" prop="operId" />
        <el-table-column :label="$t('monitor.oper.module')" align="center" prop="title" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('monitor.oper.operType')" align="center" prop="businessType">
          <template #default="scope">
            <dict-tag :options="sys_oper_type" :value="scope.row.businessType" />
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('monitor.oper.operName')"
          align="center"
          width="110"
          prop="operName"
          :show-overflow-tooltip="true"
          sortable="custom"
          :sort-orders="['descending', 'ascending']"
        />
        <el-table-column :label="$t('monitor.oper.dept')" align="center" prop="deptName" width="130" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('monitor.oper.client')" align="center" prop="clientKey" width="110" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('monitor.oper.deviceType')" align="center" prop="deviceType" width="110" :show-overflow-tooltip="true">
          <template #default="scope">
            <dict-tag :options="sys_device_type" :value="scope.row.deviceType" />
          </template>
        </el-table-column>
        <el-table-column :label="$t('monitor.oper.browser')" align="center" prop="browser" width="110" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('monitor.oper.os')" align="center" prop="os" width="110" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('monitor.oper.operIp')" align="center" prop="operIp" width="130" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('monitor.oper.operStatus')" align="center" prop="status">
          <template #default="scope">
            <dict-tag :options="sys_common_status" :value="scope.row.status" />
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('monitor.oper.operDate')"
          align="center"
          prop="operTime"
          width="180"
          sortable="custom"
          :sort-orders="['descending', 'ascending']"
        >
          <template #default="scope">
            <span>{{ parseTime(scope.row.operTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('monitor.oper.costTime')"
          align="center"
          prop="costTime"
          width="110"
          :show-overflow-tooltip="true"
          sortable="custom"
          :sort-orders="['descending', 'ascending']"
        >
          <template #default="scope">
            <span>{{ $t('monitor.oper.costMs', { time: scope.row.costTime }) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.operate')" fixed="right" align="center" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip :content="$t('monitor.oper.view')" placement="top">
              <el-button
                v-hasPermi="['monitor:operlog:query']"
                link
                type="primary"
                icon="View"
                @click="handleView(scope.row)"
              ></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
        <template #empty>
          <table-skeleton v-if="loading" :rows="8" />
          <div v-else class="empty-hint">{{ $t('common.noData') }}</div>
        </template>
      </el-table>

      <pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        @pagination="getList"
      />
    </el-card>
    <!-- 操作日志详细 -->
    <OperInfoDialog ref="operInfoDialogRef" />
  </div>
</template>

<script setup name="Operlog" lang="ts">
import TableSkeleton from '@/components/Skeleton/TableSkeleton.vue';
import { list, delOperlog, cleanOperlog } from '@/api/monitor/operlog';
import { OperLogForm, OperLogQuery, OperLogVO } from '@/api/monitor/operlog/types';
import { useLoading } from '@/hooks/async/useLoading';
import { useDateRangeQuery } from '@/hooks/form/useDateRangeQuery';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import { useTableSelection } from '@/hooks/table/useTableSelection';
import { useTableSortQuery } from '@/hooks/table/useTableSortQuery';
import modal from '@/plugins/modal';
import { useDict } from '@/utils/dict';
import { download as requestDownload } from '@/utils/request';
import { parseTime, selectDictLabel } from '@/utils/ruoyi';
import OperInfoDialog from './operInfoDialog.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const { sys_oper_type, sys_common_status, sys_device_type } = toRefs<any>(
  useDict('sys_oper_type', 'sys_common_status', 'sys_device_type')
);

const operlogList = ref<OperLogVO[]>([]);
const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();
const total = ref(0);
const { dateRange, applyDateRange, resetDateRange } = useDateRangeQuery();

const operLogTableRef = ref<ElTableInstance>();
const queryFormRef = ref<ElFormInstance>();

const data = reactive<PageData<OperLogForm, OperLogQuery>>({
  form: {
    operId: undefined,
    tenantId: undefined,
    title: '',
    businessType: 0,
    businessTypes: undefined,
    method: '',
    requestMethod: '',
    operatorType: 0,
    operName: '',
    userId: undefined,
    deptId: undefined,
    deptName: '',
    clientKey: '',
    deviceType: '',
    browser: '',
    os: '',
    operUrl: '',
    operIp: '',
    operLocation: '',
    operParam: '',
    jsonResult: '',
    status: 0,
    errorMsg: '',
    operTime: '',
    costTime: 0
  },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    operIp: '',
    title: '',
    operName: '',
    userId: '',
    deptId: '',
    clientKey: '',
    deviceType: '',
    browser: '',
    os: '',
    businessType: '',
    status: '',
    orderByColumn: 'operTime',
    isAsc: 'descending'
  },
  rules: {}
});

const { queryParams, form } = toRefs(data);
const {
  ids,
  multiple,
  handleSelectionChange: handleTableSelectionChange
} = useTableSelection<OperLogVO>(item => item.operId);

/** 查询登录日志 */
const getList = async () => {
  await withLoading(async () => {
    const res = await list(applyDateRange(queryParams.value));
    operlogList.value = res.data?.rows ?? [];
    total.value = res.data?.total;
  });
};
const { defaultSort, handleSortChange, resetSort } = useTableSortQuery<OperLogQuery>({
  queryParams,
  tableRef: operLogTableRef,
  defaultSort: { prop: 'operTime', order: 'descending' },
  onSortChange: getList
});
/** 操作日志类型字典翻译 */
const typeFormat = (row: OperLogForm) => {
  return selectDictLabel(sys_oper_type.value, row.businessType);
};
/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};
const { resetQuery } = useSearchReset({
  queryFormRef,
  queryParams,
  pageNumKey: 'pageNum',
  resetExtras: () => {
    resetDateRange();
  },
  afterReset: () => {
    resetSort();
  }
});
const handleSelectionChange = (selection: OperLogVO[]) => {
  handleTableSelectionChange(selection);
};

const operInfoDialogRef = ref<InstanceType<typeof OperInfoDialog>>();
/** 详细按钮操作 */
const handleView = (row: Partial<OperLogVO>) => {
  operInfoDialogRef.value.openDialog(row as OperLogForm);
};

/** 删除按钮操作 */
const handleDelete = async (row?: Partial<OperLogVO>) => {
  const operIds = row?.operId || ids.value;
  await modal.confirm(t('monitor.oper.confirmDelete', { name: String(operIds) }));
  await delOperlog(operIds);
  await getList();
  modal.msgSuccess(t('common.deleteSuccess'));
};

/** 清空按钮操作 */
const handleClean = async () => {
  await modal.confirm(t('monitor.oper.confirmClean'));
  await cleanOperlog();
  await getList();
  modal.msgSuccess(t('monitor.oper.cleanSuccess'));
};

/** 导出按钮操作 */
const handleExport = () => {
  requestDownload(
    'monitor/operlog/export',
    {
      ...queryParams.value
    },
    `operlog_${new Date().getTime()}.xlsx`
  );
};
onMounted(() => {
  getList();
});
</script>

<style lang="scss" scoped>
@use '@/assets/styles/components/page-shell' as pageShell;

@include pageShell.table-crud-page;
</style>
