<template>
  <div class="p-2">
    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="panel-kicker">{{ $t('vault.quota.kicker') }}</span>
            <h3>{{ $t('vault.quota.title') }}</h3>
          </div>
        </div>
      </template>

      <el-tabs v-model="activeTab" @tab-change="onTabChange">
        <!-- 1. 全局默认策略 -->
        <el-tab-pane :label="$t('vault.quota.tabPolicy')" name="policy">
          <el-form
            ref="policyFormRef"
            v-loading="policyLoading"
            :model="policyForm"
            label-width="180px"
            class="policy-form"
          >
            <el-form-item :label="$t('vault.quota.defaultQuotaMb')">
              <el-input-number v-model="policyForm.defaultQuotaMb" :min="10" :step="128" controls-position="right" />
            </el-form-item>
            <el-form-item :label="$t('vault.quota.defaultReplicaLimit')">
              <el-input-number v-model="policyForm.defaultReplicaLimit" :min="1" :max="50" controls-position="right" />
            </el-form-item>
            <el-form-item :label="$t('vault.quota.defaultMaxFileMb')">
              <div class="inline-field">
                <el-input-number
                  v-model="policyForm.defaultMaxFileMb"
                  :min="1"
                  :max="multipartLimitMb"
                  controls-position="right"
                />
                <span class="limit-tag">{{ $t('vault.quota.multipartLimitTip', { size: multipartLimitMb }) }}</span>
              </div>
            </el-form-item>
            <el-form-item :label="$t('vault.quota.tombstoneDays')">
              <el-input-number v-model="policyForm.tombstoneRetentionDays" :min="30" :max="3650" controls-position="right" />
            </el-form-item>
            <el-form-item :label="$t('vault.quota.orphanGraceDays')">
              <el-input-number v-model="policyForm.orphanAssetGraceDays" :min="1" :max="365" controls-position="right" />
            </el-form-item>
            <el-form-item>
              <el-button
                v-hasPermi="['vault:quota:edit']"
                type="primary"
                :loading="policySaving"
                @click="savePolicy"
              >
                {{ $t('vault.quota.savePolicy') }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 2. 用户配额覆盖 -->
        <el-tab-pane :label="$t('vault.quota.tabUsers')" name="users">
          <div class="users-toolbar">
            <el-form :inline="true" class="query-form">
              <el-form-item :label="$t('vault.quota.userKeyword')">
                <el-input
                  v-model="userQuery.keyword"
                  :placeholder="$t('vault.quota.userKeywordPh')"
                  clearable
                  style="width: 220px"
                  @keyup.enter="searchUsers"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" icon="Search" @click="searchUsers">{{ $t('common.search') }}</el-button>
              </el-form-item>
            </el-form>
            <el-button v-hasPermi="['vault:quota:edit']" type="primary" plain icon="Plus" @click="openCreateDialog">
              {{ $t('vault.quota.addOverride') }}
            </el-button>
          </div>

          <error-state v-if="userErrorInfo" :kind="userErrorInfo.kind" :title="userErrorInfo.title" :message="userErrorInfo.message" @retry="loadUsers" />
          <el-table v-else v-loading="userLoading && users.length > 0" :data="users" class="data-table">
            <el-table-column :label="$t('vault.quota.user')" min-width="150" :show-overflow-tooltip="true">
              <template #default="{ row }">
                <span>{{ row.nickName || row.userName || row.userId }}</span>
                <span v-if="row.nickName && row.userName" class="sub-account"> ({{ row.userName }})</span>
              </template>
            </el-table-column>
            <el-table-column :label="$t('vault.quota.planName')" prop="planName" width="120" :show-overflow-tooltip="true">
              <template #default="{ row }">{{ row.planName || '-' }}</template>
            </el-table-column>
            <el-table-column :label="$t('vault.quota.usage')" min-width="190">
              <template #default="{ row }">
                <div class="storage-cell">
                  <div class="storage-nums">
                    <span :class="{ 'is-danger': row.usedBytes >= row.effectiveQuotaBytes }">{{ formatBytes(row.usedBytes) }}</span>
                    <span class="sub-account"> / {{ formatBytes(row.effectiveQuotaBytes) }}</span>
                  </div>
                  <el-progress
                    :percentage="quotaPercent(row)"
                    :status="row.usedBytes >= row.effectiveQuotaBytes ? 'exception' : undefined"
                    :show-text="false"
                    :stroke-width="5"
                  />
                </div>
              </template>
            </el-table-column>
            <el-table-column :label="$t('vault.quota.replicaLimit')" width="120" align="center">
              <template #default="{ row }">
                <span>{{ row.effectiveReplicaLimit }}</span>
                <el-tag v-if="row.replicaLimit == null" size="small" type="info" class="ml-1">{{ $t('vault.quota.inheritTag') }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column :label="$t('vault.quota.maxFileMb')" width="130" align="center">
              <template #default="{ row }">
                <span>{{ formatBytes(row.effectiveMaxFileBytes) }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="$t('vault.quota.status')" width="100" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.expired" size="small" type="info">{{ $t('vault.quota.statusExpired') }}</el-tag>
                <el-tag v-else-if="row.expireTime" size="small" type="success">{{ $t('vault.quota.statusActive') }}</el-tag>
                <el-tag v-else size="small" type="primary">{{ $t('vault.quota.statusForever') }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column :label="$t('vault.quota.expireTime')" width="165" align="center">
              <template #default="{ row }">{{ row.expireTime ? parseTime(row.expireTime) : '-' }}</template>
            </el-table-column>
            <el-table-column :label="$t('vault.quota.remark')" prop="remark" min-width="140" :show-overflow-tooltip="true">
              <template #default="{ row }">{{ row.remark || '-' }}</template>
            </el-table-column>
            <el-table-column :label="$t('common.operate')" width="96" align="center" class-name="small-padding fixed-width">
              <template #default="{ row }">
                <el-tooltip :content="$t('vault.quota.editOverride')" placement="top">
                  <el-button
                    v-hasPermi="['vault:quota:edit']"
                    link
                    type="primary"
                    icon="Edit"
                    :aria-label="$t('vault.quota.editOverride')"
                    @click="openEditDialog(row)"
                  />
                </el-tooltip>
                <el-tooltip :content="$t('vault.quota.restoreDefault')" placement="top">
                  <el-button
                    v-hasPermi="['vault:quota:edit']"
                    link
                    type="danger"
                    icon="Delete"
                    :aria-label="$t('vault.quota.restoreDefault')"
                    @click="handleRemoveUser(row)"
                  />
                </el-tooltip>
              </template>
            </el-table-column>
            <template #empty>
              <table-skeleton v-if="userLoading" :rows="6" />
              <div v-else class="empty-hint">{{ $t('common.noData') }}</div>
            </template>
          </el-table>

          <pagination
            v-show="userTotal > 0 && !userErrorInfo"
            :total="userTotal"
            v-model:page="userQuery.pageNum"
            v-model:limit="userQuery.pageSize"
            @pagination="loadUsers"
          />
        </el-tab-pane>

        <!-- 3. 存储维护 -->
        <el-tab-pane v-if="hasMaintenancePerm" :label="$t('vault.quota.tabMaintenance')" name="maintenance">
          <div v-loading="maintLoading" class="maint-grid">
            <el-card shadow="never" class="maint-card">
              <div class="maint-head">
                <div>
                  <div class="maint-title">{{ $t('vault.maintenance.orphanTitle') }}</div>
                  <div class="maint-meta">
                    {{ $t('vault.maintenance.orphanMeta', { days: maintStats?.orphanAssetGraceDays ?? policyForm.orphanAssetGraceDays }) }}
                  </div>
                </div>
                <el-tag v-if="maintStats?.assetStorage" size="small" type="success">
                  {{ maintStats.assetStorage.backend.toUpperCase() }}
                </el-tag>
                <el-tag v-else size="small" type="warning">{{ $t('vault.overview.backendUnconfigured') }}</el-tag>
              </div>
              <div class="maint-count">
                {{
                  $t('vault.maintenance.orphanCount', {
                    count: maintStats?.orphanAssetCount ?? 0,
                    size: formatBytes(maintStats?.orphanAssetBytes)
                  })
                }}
              </div>
              <div class="maint-actions">
                <el-button
                  v-hasPermi="['vault:maintenance:run']"
                  type="danger"
                  plain
                  :loading="orphanRunning"
                  :disabled="!maintStats || maintStats.orphanAssetCount === 0 || !maintStats.assetStorage"
                  @click="runOrphanCleanup"
                >
                  {{ $t('vault.maintenance.runCleanup') }}
                </el-button>
                <el-button link type="primary" @click="goFileConfig">{{ $t('vault.overview.manageStorage') }}</el-button>
              </div>
            </el-card>

            <el-card shadow="never" class="maint-card">
              <div class="maint-head">
                <div>
                  <div class="maint-title">{{ $t('vault.maintenance.tombstoneTitle') }}</div>
                  <div class="maint-meta">
                    {{ $t('vault.maintenance.tombstoneMeta', { days: maintStats?.tombstoneRetentionDays ?? policyForm.tombstoneRetentionDays }) }}
                  </div>
                </div>
              </div>
              <div class="maint-count">
                {{ $t('vault.maintenance.tombstoneCount', { count: maintStats?.expiredTombstoneCount ?? 0 }) }}
              </div>
              <div class="maint-actions">
                <el-button
                  v-hasPermi="['vault:maintenance:run']"
                  type="danger"
                  plain
                  :loading="tombstoneRunning"
                  :disabled="!maintStats || maintStats.expiredTombstoneCount === 0"
                  @click="runTombstoneCleanup"
                >
                  {{ $t('vault.maintenance.runCleanup') }}
                </el-button>
              </div>
            </el-card>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <user-quota-dialog
      v-model="dialogOpen"
      :editing="editingRow"
      :multipart-max-file-bytes="multipartMaxFileBytes"
      @saved="loadUsers"
    />
  </div>
</template>

<script setup lang="ts" name="VaultQuota">
import { useI18n } from 'vue-i18n';
import ErrorState from '@/components/ErrorState/ErrorState.vue';
import TableSkeleton from '@/components/Skeleton/TableSkeleton.vue';
import {
  cleanupVaultOrphanAssets,
  cleanupVaultTombstones,
  getVaultMaintenanceStats,
  getVaultQuotaPolicy,
  listVaultUserQuotas,
  removeVaultUserQuota,
  updateVaultQuotaPolicy
} from '@/api/vault/quota';
import type { VaultAdminUserQuota, VaultMaintenanceStats } from '@/api/vault/quota/types';
import { useUserStore } from '@/store/modules/user';
import { classifyRequestError } from '@/utils/errorKind';
import type { ErrorInfo } from '@/utils/errorKind';
import { parseTime } from '@/utils/ruoyi';
import UserQuotaDialog from './user-quota-dialog.vue';

const { t } = useI18n();
const router = useRouter();
const userStore = useUserStore();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const activeTab = ref('policy');
const policyLoading = ref(false);
const policySaving = ref(false);
const multipartMaxFileBytes = ref(25 * 1024 * 1024);
const policyFormRef = ref<ElFormInstance>();
const policyForm = ref({
  defaultQuotaMb: 1024,
  defaultReplicaLimit: 3,
  defaultMaxFileMb: 25,
  tombstoneRetentionDays: 90,
  orphanAssetGraceDays: 7
});

const userLoading = ref(false);
const userErrorInfo = ref<ErrorInfo | null>(null);
const users = ref<VaultAdminUserQuota[]>([]);
const userTotal = ref(0);
const userQuery = ref({ pageNum: 1, pageSize: 20, keyword: '' });

const dialogOpen = ref(false);
const editingRow = ref<VaultAdminUserQuota | null>(null);

const maintLoading = ref(false);
const maintStats = ref<VaultMaintenanceStats | null>(null);
const orphanRunning = ref(false);
const tombstoneRunning = ref(false);

const hasMaintenancePerm = computed(() => {
  const perms = userStore.permissions || [];
  return perms.includes('*:*:*') || perms.includes('vault:maintenance:run');
});

const multipartLimitMb = computed(() => Math.max(1, Math.floor(multipartMaxFileBytes.value / (1024 * 1024))));

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

const quotaPercent = (row: any) => {
  if (!row.effectiveQuotaBytes || row.effectiveQuotaBytes <= 0) return 0;
  return Math.min(100, Math.round((row.usedBytes / row.effectiveQuotaBytes) * 100));
};

const loadPolicy = async () => {
  policyLoading.value = true;
  try {
    const res = await getVaultQuotaPolicy();
    const d = res.data;
    multipartMaxFileBytes.value = d.multipartMaxFileBytes || 25 * 1024 * 1024;
    policyForm.value = {
      defaultQuotaMb: Math.round(d.defaultQuotaBytes / (1024 * 1024)),
      defaultReplicaLimit: d.defaultReplicaLimit,
      defaultMaxFileMb: Math.round(d.defaultMaxFileBytes / (1024 * 1024)),
      tombstoneRetentionDays: d.tombstoneRetentionDays,
      orphanAssetGraceDays: d.orphanAssetGraceDays
    };
  } finally {
    policyLoading.value = false;
  }
};

const savePolicy = async () => {
  policySaving.value = true;
  try {
    await updateVaultQuotaPolicy({
      defaultQuotaBytes: Math.round(policyForm.value.defaultQuotaMb * 1024 * 1024),
      defaultReplicaLimit: policyForm.value.defaultReplicaLimit,
      defaultMaxFileBytes: Math.round(policyForm.value.defaultMaxFileMb * 1024 * 1024),
      tombstoneRetentionDays: policyForm.value.tombstoneRetentionDays,
      orphanAssetGraceDays: policyForm.value.orphanAssetGraceDays
    });
    proxy?.$modal.msgSuccess(t('vault.quota.policySaved'));
  } finally {
    policySaving.value = false;
  }
};

const loadUsers = async () => {
  userLoading.value = true;
  try {
    const res = await listVaultUserQuotas({
      pageNum: userQuery.value.pageNum,
      pageSize: userQuery.value.pageSize,
      keyword: userQuery.value.keyword || undefined
    });
    users.value = res.data.rows || [];
    userTotal.value = res.data.total || 0;
    userErrorInfo.value = null;
  } catch (err) {
    userErrorInfo.value = classifyRequestError(err);
  } finally {
    userLoading.value = false;
  }
};

const searchUsers = () => {
  userQuery.value.pageNum = 1;
  loadUsers();
};

const openCreateDialog = () => {
  editingRow.value = null;
  dialogOpen.value = true;
};

const openEditDialog = (row: any) => {
  editingRow.value = row as VaultAdminUserQuota;
  dialogOpen.value = true;
};

const handleRemoveUser = async (row: any) => {
  const name = row.nickName || row.userName || row.userId;
  try {
    await ElMessageBox.confirm(t('vault.quota.restoreConfirm', { name }), t('common.warning'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      confirmButtonClass: 'el-button--danger',
      type: 'warning'
    });
    await removeVaultUserQuota(row.userId);
    proxy?.$modal.msgSuccess(t('vault.quota.restoreSuccess'));
    await loadUsers();
  } catch {
    // cancelled
  }
};

const loadMaintenance = async () => {
  if (!hasMaintenancePerm.value) return;
  maintLoading.value = true;
  try {
    const res = await getVaultMaintenanceStats();
    maintStats.value = res.data;
  } finally {
    maintLoading.value = false;
  }
};

const runOrphanCleanup = async () => {
  if (!maintStats.value) return;
  try {
    await ElMessageBox.confirm(
      t('vault.maintenance.orphanConfirm', {
        count: maintStats.value.orphanAssetCount,
        size: formatBytes(maintStats.value.orphanAssetBytes)
      }),
      t('common.warning'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        confirmButtonClass: 'el-button--danger',
        type: 'warning'
      }
    );
    orphanRunning.value = true;
    const res = await cleanupVaultOrphanAssets();
    const r = res.data;
    if (r.failedCount > 0) {
      proxy?.$modal.msgWarning(t('vault.maintenance.cleanupDoneWithFailed', { deleted: r.deletedCount, failed: r.failedCount }));
    } else {
      proxy?.$modal.msgSuccess(t('vault.maintenance.cleanupDone', { deleted: r.deletedCount, size: formatBytes(r.freedBytes) }));
    }
    await loadMaintenance();
  } catch {
    // cancelled
  } finally {
    orphanRunning.value = false;
  }
};

const runTombstoneCleanup = async () => {
  if (!maintStats.value) return;
  try {
    await ElMessageBox.confirm(
      t('vault.maintenance.tombstoneConfirm', { count: maintStats.value.expiredTombstoneCount }),
      t('common.warning'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        confirmButtonClass: 'el-button--danger',
        type: 'warning'
      }
    );
    tombstoneRunning.value = true;
    const res = await cleanupVaultTombstones();
    proxy?.$modal.msgSuccess(t('vault.maintenance.cleanupDone', { deleted: res.data.deletedCount, size: '0 B' }));
    await loadMaintenance();
  } catch {
    // cancelled
  } finally {
    tombstoneRunning.value = false;
  }
};

const onTabChange = (name: string | number) => {
  if (name === 'policy') loadPolicy();
  else if (name === 'users') loadUsers();
  else if (name === 'maintenance') loadMaintenance();
};

const goFileConfig = () => {
  router.push({ path: '/basics/file-config/index' });
};

onMounted(() => {
  loadPolicy();
});
</script>

<style scoped lang="scss">
.policy-form {
  max-width: 560px;
  padding-top: 8px;
}

.inline-field {
  display: flex;
  align-items: center;
  gap: 10px;
}

.limit-tag,
.sub-account {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.users-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.storage-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.storage-nums {
  font-size: 12px;
}

.is-danger {
  color: var(--el-color-danger);
}

.maint-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 12px;
  padding-top: 4px;
}

.maint-card {
  .maint-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .maint-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
  .maint-meta {
    margin-top: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
  .maint-count {
    margin: 16px 0 14px;
    font-size: 20px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
  .maint-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}
</style>
