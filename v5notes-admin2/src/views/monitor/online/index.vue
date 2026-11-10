<template>
  <div class="p-2 app-container monitor-online-page">
    <div class="search-wrap">
      <el-card shadow="hover" class="search-panel">
        <template #header>
          <div class="panel-heading">
            <div>
              <span class="panel-kicker">{{ $t('monitor.kicker.search') }}</span>
              <h3>{{ $t('common.filter') }}</h3>
            </div>
          </div>
        </template>
        <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="query-form">
          <el-form-item :label="$t('monitor.online.ipaddr')" prop="ipaddr">
            <el-input v-model="queryParams.ipaddr" :placeholder="$t('common.pleaseInput', { label: $t('monitor.online.ipaddr') })" clearable @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item :label="$t('monitor.online.userName')" prop="userName">
            <el-input
              v-model="queryParams.userName"
              :placeholder="$t('common.pleaseInput', { label: $t('monitor.online.userName') })"
              clearable
              @keyup.enter="handleQuery"
            />
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
            <span class="panel-kicker">{{ $t('monitor.kicker.online') }}</span>
            <h3>{{ $t('monitor.online.title') }}</h3>
            <p>{{ $t('monitor.online.summary', { total }) }}</p>
          </div>
        </div>
      </template>
      <el-table
        v-loading="loading && (onlineList.slice((queryParams.pageNum - 1) * queryParams.pageSize, queryParams.pageNum * queryParams.pageSize)).length > 0"
        border
        class="data-table"
        :data="
          onlineList.slice((queryParams.pageNum - 1) * queryParams.pageSize, queryParams.pageNum * queryParams.pageSize)
        "
        style="width: 100%"
      >
        <el-table-column :label="$t('common.serial')" width="50" type="index" align="center">
          <template #default="scope">
            <span>{{ (queryParams.pageNum - 1) * queryParams.pageSize + scope.$index + 1 }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('monitor.online.tokenId')" align="center" prop="tokenId" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('monitor.online.loginName')" align="center" prop="userName" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('monitor.online.client')" align="center" prop="clientKey" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('monitor.online.deviceType')" align="center">
          <template #default="scope">
            <dict-tag :options="sys_device_type" :value="scope.row.deviceType" />
          </template>
        </el-table-column>
        <el-table-column :label="$t('monitor.online.dept')" align="center" prop="deptName" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('monitor.online.host')" align="center" prop="ipaddr" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('monitor.online.location')" align="center" prop="loginLocation" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('monitor.online.os')" align="center" prop="os" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('monitor.online.browser')" align="center" prop="browser" :show-overflow-tooltip="true" />
        <el-table-column :label="$t('monitor.online.loginTime')" align="center" prop="loginTime" width="180">
          <template #default="scope">
            <span>{{ parseTime(scope.row.loginTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.operate')" align="center" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip :content="$t('monitor.online.forceLogout')" placement="top">
              <el-button
                v-hasPermi="['monitor:online:forceLogout']"
                link
                type="primary"
                icon="Delete"
                @click="handleForceLogout(scope.row)"
              ></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
        <template #empty>
          <table-skeleton v-if="loading" :rows="8" avatar />
          <div v-else class="empty-hint">{{ $t('common.noData') }}</div>
        </template>
      </el-table>

      <pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
      />
    </el-card>
  </div>
</template>

<script setup name="Online" lang="ts">
import TableSkeleton from '@/components/Skeleton/TableSkeleton.vue';
import { to } from 'await-to-js';
import { forceLogout, list as initData } from '@/api/monitor/online';
import { OnlineQuery, OnlineVO } from '@/api/monitor/online/types';
import modal from '@/plugins/modal';
import { useDict } from '@/utils/dict';
import { parseTime } from '@/utils/ruoyi';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const { sys_device_type } = toRefs<any>(useDict('sys_device_type'));

const onlineList = ref<OnlineVO[]>([]);
const loading = ref(true);
const total = ref(0);

const queryFormRef = ref<ElFormInstance>();

const queryParams = ref<OnlineQuery>({
  pageNum: 1,
  pageSize: 10,
  ipaddr: '',
  userName: ''
});

/** 查询登录日志列表 */
const getList = async () => {
  loading.value = true;
  const res = await initData(queryParams.value);
  onlineList.value = res.data?.rows ?? [];
  total.value = res.data?.total;
  loading.value = false;
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
/** 强退按钮操作 */
const handleForceLogout = async (row: Partial<OnlineVO>) => {
  const [err] = await to(
    modal.confirm(t('monitor.online.confirmForceLogout', { name: row.userName })) as any
  );
  if (!err) {
    await forceLogout(row.tokenId);
    await getList();
    modal.msgSuccess(t('common.deleteSuccess'));
  }
};

onMounted(() => {
  getList();
});
</script>

<style lang="scss" scoped>
@use '@/assets/styles/components/page-shell' as pageShell;

@include pageShell.table-crud-page;
</style>
