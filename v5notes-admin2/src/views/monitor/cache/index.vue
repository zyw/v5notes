<template>
  <div class="p-2 app-container monitor-cache-page">
    <el-row :gutter="12" class="cache-grid">
      <el-col :span="24">
        <el-card shadow="hover" class="table-panel">
          <template #header>
            <div class="toolbar-shell">
              <div class="table-heading">
                <h3>{{ $t('monitor.cache.overview') }}</h3>
                <p>{{ $t('monitor.cache.overviewDesc') }}</p>
              </div>
            </div>
          </template>

          <div class="el-table el-table--enable-row-hover el-table--medium cache-table">
            <table style="width: 100%">
              <tbody>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor.cache.version') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div v-if="cache.info" class="cell">{{ cache.info.redis_version }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor.cache.mode') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div v-if="cache.info" class="cell">
                      {{ cache.info.redis_mode === 'standalone' ? $t('monitor.cache.standalone') : $t('monitor.cache.cluster') }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor.cache.port') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div v-if="cache.info" class="cell">{{ cache.info.tcp_port }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor.cache.clients') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div v-if="cache.info" class="cell">{{ cache.info.connected_clients }}</div>
                  </td>
                </tr>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor.cache.uptime') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div v-if="cache.info" class="cell">{{ cache.info.uptime_in_days }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor.cache.memory') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div v-if="cache.info" class="cell">{{ cache.info.used_memory_human }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor.cache.cpu') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div v-if="cache.info" class="cell">
                      {{ parseFloat(cache.info.used_cpu_user_children).toFixed(2) }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor.cache.maxMemory') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div v-if="cache.info" class="cell">{{ cache.info.maxmemory_human }}</div>
                  </td>
                </tr>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor.cache.aof') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div v-if="cache.info" class="cell">
                      {{ cache.info.aof_enabled === '0' ? $t('common.no') : $t('common.yes') }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor.cache.rdb') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div v-if="cache.info" class="cell">
                      {{ cache.info.rdb_last_bgsave_status }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor.cache.keys') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div v-if="cache.dbSize" class="cell">{{ cache.dbSize }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor.cache.network') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div v-if="cache.info" class="cell">
                      {{ cache.info.instantaneous_input_kbps }}kps/{{ cache.info.instantaneous_output_kbps }}kps
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="12">
        <el-card shadow="hover" class="table-panel">
          <template #header>
            <div class="toolbar-shell">
              <div class="table-heading">
                <h3>{{ $t('monitor.cache.commandStats') }}</h3>
              </div>
            </div>
          </template>
          <div class="el-table el-table--enable-row-hover el-table--medium cache-chart">
            <div ref="commandstats" style="height: 420px" />
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="12">
        <el-card shadow="hover" class="table-panel">
          <template #header>
            <div class="toolbar-shell">
              <div class="table-heading">
                <h3>{{ $t('monitor.cache.memoryInfo') }}</h3>
              </div>
            </div>
          </template>
          <div class="el-table el-table--enable-row-hover el-table--medium cache-chart">
            <div ref="usedmemory" style="height: 420px" />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup name="Cache" lang="ts">
import * as echarts from 'echarts';
import { getCache } from '@/api/monitor/cache';
import { CacheVO } from '@/api/monitor/cache/types';
import modal from '@/plugins/modal';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const cache = ref<Partial<CacheVO>>({});
const commandstats = ref();
const usedmemory = ref();
let commandstatsInstance: echarts.ECharts | undefined;
let usedmemoryInstance: echarts.ECharts | undefined;

const handleResize = () => {
  commandstatsInstance?.resize();
  usedmemoryInstance?.resize();
};

const disposeCharts = () => {
  commandstatsInstance?.dispose();
  usedmemoryInstance?.dispose();
  commandstatsInstance = undefined;
  usedmemoryInstance = undefined;
};

const getList = async () => {
  modal.loading(t('monitor.cache.loading'));
  try {
    const res = await getCache();
    cache.value = res.data;
    disposeCharts();
    commandstatsInstance = echarts.init(commandstats.value, 'macarons');
    commandstatsInstance.setOption({
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b} : {c} ({d}%)'
      },
      series: [
        {
          name: t('monitor.cache.command'),
          type: 'pie',
          roseType: 'radius',
          radius: [15, 95],
          center: ['50%', '38%'],
          data: res.data.commandStats,
          animationEasing: 'cubicInOut',
          animationDuration: 1000
        }
      ]
    });
    usedmemoryInstance = echarts.init(usedmemory.value, 'macarons');
    usedmemoryInstance.setOption({
      tooltip: {
        formatter: '{b} <br/>{a} : ' + cache.value.info.used_memory_human
      },
      series: [
        {
          name: t('monitor.cache.peak'),
          type: 'gauge',
          min: 0,
          max: 1000,
          detail: {
            formatter: cache.value.info.used_memory_human
          },
          data: [
            {
              value: parseFloat(cache.value.info.used_memory_human),
              name: t('monitor.cache.memoryUsage')
            }
          ]
        }
      ]
    });
  } finally {
    modal.closeLoading();
  }
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
  getList();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  disposeCharts();
});
</script>

<style lang="scss" scoped>
.cache-grid {
  row-gap: 12px;
}

.cache-table {
  overflow: hidden;
  border: 1px solid var(--app-surface-border);
  border-radius: 10px;
}

.cache-table table {
  border-collapse: collapse;
}

.cache-chart {
  overflow: hidden;
  border-radius: 10px;
}
</style>
