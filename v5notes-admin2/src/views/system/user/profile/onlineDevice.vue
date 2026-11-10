<template>
  <div class="profile-table-wrap">
    <el-table
      :data="devices"
      border
      class="data-table profile-device-table"
      data-full-height-table="false"
      :empty-text="$t('system.profile.noDevice')"
    >
      <el-table-column :label="$t('system.profile.deviceType')" align="center">
        <template #default="scope">
          <dict-tag :options="sys_device_type" :value="scope.row.deviceType" />
        </template>
      </el-table-column>
      <el-table-column :label="$t('system.profile.host')" align="center" prop="ipaddr" :show-overflow-tooltip="true" />
      <el-table-column :label="$t('system.profile.loginLocation')" align="center" prop="loginLocation" :show-overflow-tooltip="true" />
      <el-table-column :label="$t('system.profile.os')" align="center" prop="os" :show-overflow-tooltip="true" />
      <el-table-column :label="$t('system.profile.browser')" align="center" prop="browser" :show-overflow-tooltip="true" />
      <el-table-column :label="$t('system.profile.loginTime')" align="center" prop="loginTime" width="180">
        <template #default="scope">
          <span>{{ parseTime(scope.row.loginTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="$t('common.operate')" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-tooltip :content="$t('common.delete')" placement="top">
            <el-button link type="primary" icon="Delete" @click="handldDelOnline(scope.row)"></el-button>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup name="Online" lang="ts">
import { delOnline } from '@/api/monitor/online';
import modal from '@/plugins/modal';
import tab from '@/plugins/tab';
import { useDict } from '@/utils/dict';
import { propTypes } from '@/utils/propTypes';
import { parseTime } from '@/utils/ruoyi';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const { sys_device_type } = toRefs<any>(useDict('sys_device_type'));

const props = defineProps({
  devices: propTypes.any.isRequired
});
const devices = computed(() => props.devices);

/** 删除按钮操作 */
const handldDelOnline = (row: any) => {
  ElMessageBox.confirm(t('system.profile.deleteDevice'))
    .then(() => {
      return delOnline(row.tokenId);
    })
    .then((res: any) => {
      if (res.code === 200) {
        modal.msgSuccess(t('common.deleteSuccess'));
        tab.refreshPage();
      } else {
        modal.msgError(res.msg);
      }
    })
    .catch(() => {});
};
</script>

<style lang="scss" scoped>
.profile-table-wrap {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

/* 表格撑满标签页可用高度 */
.profile-device-table {
  height: 100%;
}

.profile-device-table :deep(th.el-table__cell .cell) {
  white-space: nowrap;
}
</style>
