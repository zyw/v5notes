<template>
  <div class="p-2 vault-overview">
    <error-state
      v-if="errorInfo"
      :kind="errorInfo.kind"
      :title="errorInfo.title"
      :message="errorInfo.message"
      @retry="loadAll"
    />

    <template v-else>
      <div class="kpi-grid" v-loading="loading && !overview">
        <el-card shadow="hover" class="kpi-card">
          <div class="kpi-label">{{ $t('vault.overview.totalSpaces') }}</div>
          <div class="kpi-value">{{ overview?.totalSpaces ?? 0 }}</div>
          <div class="kpi-sub">{{ $t('vault.overview.activeUsers') }} {{ overview?.activeUsers ?? 0 }}</div>
        </el-card>
        <el-card shadow="hover" class="kpi-card">
          <div class="kpi-label">{{ $t('vault.overview.totalReplicas') }}</div>
          <div class="kpi-value">{{ overview?.totalReplicas ?? 0 }}</div>
          <div class="kpi-sub">{{ $t('vault.overview.uniqueDevices', { count: overview?.uniqueDevices ?? 0 }) }}</div>
        </el-card>
        <el-card shadow="hover" class="kpi-card">
          <div class="kpi-label">{{ $t('vault.overview.totalFiles') }}</div>
          <div class="kpi-value">{{ overview?.totalFiles ?? 0 }}</div>
          <div class="kpi-sub">
            {{
              $t('vault.overview.fileBreakdown', {
                note: overview?.noteFiles ?? 0,
                asset: overview?.assetFiles ?? 0,
                config: overview?.configFiles ?? 0
              })
            }}
          </div>
        </el-card>
        <el-card shadow="hover" class="kpi-card">
          <div class="kpi-label">{{ $t('vault.overview.totalUsed') }}</div>
          <div class="kpi-value">{{ formatBytes(overview?.totalUsedBytes) }}</div>
          <div class="kpi-sub">{{ $t('vault.overview.assetBytes', { size: formatBytes(overview?.assetBytes) }) }}</div>
        </el-card>
        <el-card shadow="hover" class="kpi-card">
          <div class="kpi-label">{{ $t('vault.overview.overQuotaUsers') }}</div>
          <div class="kpi-value" :class="{ 'is-danger': (overview?.overQuotaUsers ?? 0) > 0 }">
            {{ overview?.overQuotaUsers ?? 0 }}
          </div>
          <div class="kpi-sub">{{ $t('vault.overview.defaultQuota', { size: formatBytes(overview?.defaultQuotaBytes) }) }}</div>
        </el-card>
      </div>

      <el-card shadow="hover" class="backend-bar">
        <div class="backend-bar-inner">
          <div class="backend-meta">
            <span class="backend-title">{{ $t('vault.overview.storageBackend') }}</span>
            <template v-if="overview?.assetStorage">
              <el-tag size="small" type="success">{{ overview.assetStorage.backend.toUpperCase() }}</el-tag>
              <el-tag size="small" :type="overview.assetStorage.directDownload ? 'primary' : 'info'">
                {{ overview.assetStorage.directDownload ? $t('vault.overview.modeDirect') : $t('vault.overview.modeProxy') }}
              </el-tag>
              <span class="backend-limit">{{ $t('vault.overview.maxFileSize', { size: formatBytes(overview.assetStorage.maxFileBytes) }) }}</span>
            </template>
            <el-tag v-else size="small" type="warning">{{ $t('vault.overview.backendUnconfigured') }}</el-tag>
          </div>
          <el-button link type="primary" @click="goFileConfig">{{ $t('vault.overview.manageStorage') }}</el-button>
        </div>
      </el-card>

      <div class="overview-main">
        <el-card shadow="hover" class="trend-card">
          <template #header>
            <div class="card-header">
              <h3>{{ $t('vault.overview.trendTitle') }}</h3>
              <el-radio-group v-model="range" size="small" @change="loadOverview">
                <el-radio-button :value="7">{{ $t('vault.overview.range7') }}</el-radio-button>
                <el-radio-button :value="30">{{ $t('vault.overview.range30') }}</el-radio-button>
                <el-radio-button :value="90">{{ $t('vault.overview.range90') }}</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="chartRef" class="trend-chart" />
        </el-card>

        <el-card shadow="hover" class="rank-card">
          <template #header>
            <div class="card-header">
              <h3>{{ $t('vault.overview.topTitle') }}</h3>
              <el-button link type="primary" @click="goSpaces()">{{ $t('vault.overview.viewSpaces') }}</el-button>
            </div>
          </template>
          <el-table v-loading="loading && rankList.length === 0" :data="rankList" class="data-table">
            <el-table-column :label="$t('vault.spaces.owner')" min-width="140" :show-overflow-tooltip="true">
              <template #default="{ row }">{{ row.nickName || row.userName || row.userId }}</template>
            </el-table-column>
            <el-table-column :label="$t('vault.overview.totalSpaces')" prop="spaceCount" width="76" align="center" />
            <el-table-column :label="$t('vault.spaces.replicas')" prop="replicaCount" width="76" align="center" />
            <el-table-column :label="$t('vault.spaces.storage')" min-width="140">
              <template #default="{ row }">
                <span :class="{ 'is-danger': row.overQuota }">{{ formatBytes(row.usedBytes) }}</span>
                <span class="quota-sep"> / {{ formatBytes(row.quotaBytes) }}</span>
              </template>
            </el-table-column>
            <el-table-column width="72" align="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="goSpaces(row.userName || row.nickName)">
                  {{ $t('vault.overview.viewSpaces') }}
                </el-button>
              </template>
            </el-table-column>
            <template #empty>
              <div class="empty-hint">{{ $t('common.noData') }}</div>
            </template>
          </el-table>
        </el-card>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts" name="VaultOverview">
import * as echarts from 'echarts';
import { useI18n } from 'vue-i18n';
import ErrorState from '@/components/ErrorState/ErrorState.vue';
import { getVaultOverview, getVaultStorageTop } from '@/api/vault/overview';
import type { VaultAdminOverview, VaultAdminStorageRank } from '@/api/vault/overview/types';
import { classifyRequestError } from '@/utils/errorKind';
import type { ErrorInfo } from '@/utils/errorKind';

const { t } = useI18n();
const router = useRouter();

const loading = ref(true);
const errorInfo = ref<ErrorInfo | null>(null);
const range = ref(30);
const overview = ref<VaultAdminOverview | null>(null);
const rankList = ref<VaultAdminStorageRank[]>([]);
const chartRef = ref<HTMLElement | null>(null);
let chartInstance: echarts.ECharts | null = null;

const formatBytes = (value?: number) => {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let idx = 0;
  while (v >= 1024 && idx < units.length - 1) {
    v /= 1024;
    idx += 1;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[idx]}`;
};

const renderChart = () => {
  if (!chartRef.value || !overview.value) return;
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value);
  }
  const points = overview.value.trend || [];
  chartInstance.setOption({
    tooltip: { trigger: 'axis' },
    legend: {
      bottom: 0,
      data: [t('vault.overview.opUpsert'), t('vault.overview.opDelete'), t('vault.overview.opRename')]
    },
    grid: { top: 16, left: 44, right: 16, bottom: 36 },
    xAxis: {
      type: 'category',
      data: points.map((p) => p.day.slice(5)),
      boundaryGap: false
    },
    yAxis: {
      type: 'value',
      minInterval: 1
    },
    series: [
      {
        name: t('vault.overview.opUpsert'),
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: points.map((p) => p.upsertCount)
      },
      {
        name: t('vault.overview.opDelete'),
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: points.map((p) => p.deleteCount)
      },
      {
        name: t('vault.overview.opRename'),
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: points.map((p) => p.renameCount)
      }
    ]
  });
};

const loadOverview = async () => {
  loading.value = true;
  try {
    const res = await getVaultOverview(range.value);
    overview.value = res.data;
    errorInfo.value = null;
    await nextTick();
    renderChart();
  } catch (err) {
    errorInfo.value = classifyRequestError(err);
  } finally {
    loading.value = false;
  }
};

const loadAll = async () => {
  loading.value = true;
  try {
    const [ovRes, rankRes] = await Promise.all([getVaultOverview(range.value), getVaultStorageTop(10)]);
    overview.value = ovRes.data;
    rankList.value = rankRes.data || [];
    errorInfo.value = null;
    await nextTick();
    renderChart();
  } catch (err) {
    errorInfo.value = classifyRequestError(err);
  } finally {
    loading.value = false;
  }
};

const goSpaces = (keyword?: string) => {
  router.push({ path: '/vault/spaces', query: keyword ? { keyword } : undefined });
};

const goFileConfig = () => {
  router.push({ path: '/basics/file-config/index' });
};

const onResize = () => chartInstance?.resize();

onMounted(() => {
  loadAll();
  window.addEventListener('resize', onResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  chartInstance?.dispose();
  chartInstance = null;
});
</script>

<style scoped lang="scss">
.vault-overview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
}

.kpi-card {
  .kpi-label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }
  .kpi-value {
    margin: 6px 0 4px;
    font-size: 26px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--el-text-color-primary);
  }
  .kpi-sub {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

.backend-bar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.backend-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.backend-title {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.backend-limit,
.quota-sep {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.overview-main {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: 12px;
}

@media (max-width: 1100px) {
  .overview-main {
    grid-template-columns: 1fr;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }
}

.trend-chart {
  width: 100%;
  height: 300px;
}

.is-danger {
  color: var(--el-color-danger);
}
</style>
