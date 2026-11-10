<template>
  <div class="p-2 app-container system-client-page">
    <div class="search-wrap">
      <el-card shadow="hover" class="search-panel" :class="{ 'is-collapsed': !showSearch }">
        <template #header>
          <div class="panel-heading search-panel-toggle" @click.stop="showSearch = !showSearch">
            <div><h3>{{ $t('common.filter') }}</h3></div>
          </div>
        </template>
        <el-form ref="queryFormRef" :model="queryParams" :inline="true" label-width="85px" class="query-form">
          <el-form-item :label="$t('system.client.clientKey')" prop="clientKey">
            <el-input
              v-model="queryParams.clientKey"
              :placeholder="$t('common.pleaseInput', { label: $t('system.client.clientKey') })"
              clearable
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item :label="$t('system.client.clientSecret')" prop="clientSecret">
            <el-input
              v-model="queryParams.clientSecret"
              :placeholder="$t('common.pleaseInput', { label: $t('system.client.clientSecret') })"
              clearable
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item :label="$t('common.status')" prop="status">
            <el-select v-model="queryParams.status" :placeholder="$t('common.status')" clearable>
              <el-option v-for="dict in sys_normal_disable" :key="dict.value" :label="dict.label" :value="dict.value" />
            </el-select>
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
            <h3>{{ $t('system.client.listTitle') }}</h3>
            <p>{{ $t('system.client.listDesc', { total }) }}</p>
          </div>
          <div class="toolbar-actions">
            <el-button v-hasPermi="['system:client:add']" type="primary" plain icon="Plus" @click="handleAdd">
              {{ $t('common.add') }}
            </el-button>
            <el-button
              v-hasPermi="['system:client:edit']"
              type="success"
              plain
              icon="Edit"
              :disabled="single"
              @click="handleUpdate()"
            >
              {{ $t('common.edit') }}
            </el-button>
            <el-button
              v-hasPermi="['system:client:remove']"
              type="danger"
              plain
              icon="Delete"
              :disabled="multiple"
              @click="handleDelete()"
            >
              {{ $t('common.delete') }}
            </el-button>
            <el-button v-hasPermi="['system:client:export']" type="warning" plain icon="Download" @click="handleExport">
              {{ $t('common.export') }}
            </el-button>
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList"></right-toolbar>
          </div>
        </div>
      </template>

      <el-table
        v-loading="loading && (clientList).length > 0"
        :data="clientList"
        border
        class="data-table"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column v-if="false" label="id" align="center" prop="id" />
        <el-table-column :label="$t('system.client.clientId')" align="center" prop="clientId" />
        <el-table-column :label="$t('system.client.clientKey')" align="center" prop="clientKey" />
        <el-table-column :label="$t('system.client.clientSecret')" align="center" prop="clientSecret" />
        <el-table-column :label="$t('system.client.grantType')" align="center">
          <template #default="scope">
            <dict-tag class="grant-type-tag" :options="sys_grant_type" :value="scope.row.grantTypeList" />
          </template>
        </el-table-column>
        <el-table-column :label="$t('system.client.deviceType')" align="center">
          <template #default="scope">
            <dict-tag :options="sys_device_type" :value="scope.row.deviceType" />
          </template>
        </el-table-column>
        <el-table-column :label="$t('system.client.pathWhitelist')" align="center">
          <template #default="scope">
            <div class="rule-tag-list">
              <el-tag
                v-for="path in getRuleList(scope.row.accessPathList, scope.row.accessPath)"
                :key="path"
                size="small"
                effect="plain"
              >
                {{ path }}
              </el-tag>
              <span v-if="!getRuleList(scope.row.accessPathList, scope.row.accessPath).length" class="rule-empty">
                {{ $t('system.client.allPaths') }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="$t('system.client.ipWhitelistCol')" align="center">
          <template #default="scope">
            <div class="rule-tag-list">
              <el-tag
                v-for="ip in getRuleList(scope.row.ipWhitelistList, scope.row.ipWhitelist)"
                :key="ip"
                size="small"
                type="success"
                effect="plain"
              >
                {{ ip }}
              </el-tag>
              <span v-if="!getRuleList(scope.row.ipWhitelistList, scope.row.ipWhitelist).length" class="rule-empty">
                {{ $t('system.client.allIps') }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="$t('system.client.activeTimeout')" align="center" prop="activeTimeout" />
        <el-table-column :label="$t('system.client.fixedTimeout')" align="center" prop="timeout" />
        <el-table-column key="status" :label="$t('common.status')" align="center">
          <template #default="scope">
            <el-switch
              v-model="scope.row.status"
              active-value="0"
              inactive-value="1"
              @change="handleStatusChange(scope.row)"
            ></el-switch>
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.operate')" align="center" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip :content="$t('common.edit')" placement="top">
              <el-button
                v-hasPermi="['system:client:edit']"
                link
                type="primary"
                icon="Edit"
                @click="handleUpdate(scope.row)"
              ></el-button>
            </el-tooltip>
            <el-tooltip :content="$t('common.delete')" placement="top">
              <el-button
                v-hasPermi="['system:client:remove']"
                link
                type="primary"
                icon="Delete"
                @click="handleDelete(scope.row)"
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
    <!-- 添加或修改客户端管理抽屉 -->
    <FormDrawer
      v-model="dialog.visible"
      :title="dialog.title"
      :eyebrow="$t('system.client.eyebrow')"
      :subtitle="$t('system.client.subtitle')"
      size="680px"
      :submit-text="$t('common.confirm')"
      :submitting="buttonLoading"
      :hint="$t('system.client.requiredHint')"
      @submit="submitForm"
      @closed="cancel"
    >
      <template #hero>
        <div class="drawer-hero">
          <div class="drawer-hero__top">
            <span class="drawer-hero__brand"><img :src="logoUrl" alt="" />{{ $t('system.client.brand') }}</span>
            <span class="drawer-hero__divider">·</span>
            <span class="drawer-hero__action">{{ dialog.title }}</span>
          </div>
          <div class="drawer-hero__profile">
            <div class="drawer-hero__icon">{{ clientInitial }}</div>
            <div class="drawer-hero__info">
              <div class="drawer-hero__name">{{ clientName }}</div>
              <div class="drawer-hero__meta">
                <span class="drawer-hero__tag">{{ deviceTypeLabel }}</span>
                <span>{{ statusLabel }}</span>
                <span v-if="accessPathText">{{ accessPathText }}</span>
                <span v-else>{{ $t('system.client.allPaths') }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <el-form ref="clientFormRef" :model="form" :rules="rules" label-position="top" class="client-form">
        <section class="form-section">
          <h4>{{ $t('common.basicInfo') }}</h4>
          <el-row :gutter="18">
            <el-col :span="12">
              <el-form-item :label="$t('system.client.clientKey')" prop="clientKey">
                <el-input v-model="form.clientKey" :disabled="form.id != null" :placeholder="$t('common.pleaseInput', { label: $t('system.client.clientKey') })" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('system.client.clientSecret')" prop="clientSecret">
                <el-input v-model="form.clientSecret" :disabled="form.id != null" :placeholder="$t('common.pleaseInput', { label: $t('system.client.clientSecret') })" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('system.client.grantType')" prop="grantTypeList">
                <el-select v-model="form.grantTypeList" multiple :placeholder="$t('common.pleaseInput', { label: $t('system.client.grantType') })">
                  <el-option
                    v-for="dict in sys_grant_type"
                    :key="dict.value"
                    :label="dict.label"
                    :value="dict.value"
                  ></el-option>
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('system.client.deviceType')" prop="deviceType">
                <el-select v-model="form.deviceType" :placeholder="$t('common.pleaseInput', { label: $t('system.client.deviceType') })">
                  <el-option
                    v-for="dict in sys_device_type"
                    :key="dict.value"
                    :label="dict.label"
                    :value="dict.value"
                  ></el-option>
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
        </section>

        <section class="form-section">
          <h4>{{ $t('system.client.accessSection') }}</h4>
          <el-row :gutter="18">
            <el-col :span="24">
              <el-form-item prop="accessPath">
                <template #label>
                  <span>
                    <el-tooltip :content="$t('system.client.pathTip')" placement="top">
                      <el-icon><question-filled /></el-icon>
                    </el-tooltip>
                    {{ $t('system.client.allowPath') }}
                  </span>
                </template>
                <el-input v-model="form.accessPath" type="textarea" :rows="4" :placeholder="$t('system.client.pathExample')" />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item prop="ipWhitelist">
                <template #label>
                  <span>
                    <el-tooltip
                      :content="$t('system.client.ipTip')"
                      placement="top"
                    >
                      <el-icon><question-filled /></el-icon>
                    </el-tooltip>
                    {{ $t('system.client.ipWhitelist') }}
                  </span>
                </template>
                <el-input
                  v-model="form.ipWhitelist"
                  type="textarea"
                  :rows="4"
                  :placeholder="$t('system.client.ipExample')"
                />
              </el-form-item>
            </el-col>
          </el-row>
        </section>

        <section class="form-section">
          <h4>{{ $t('system.client.timeoutSection') }}</h4>
          <el-row :gutter="18">
            <el-col :span="12">
              <el-form-item prop="activeTimeout">
                <template #label>
                  <span>
                    <el-tooltip :content="$t('system.client.activeTip')" placement="top">
                      <el-icon><question-filled /></el-icon>
                    </el-tooltip>
                    {{ $t('system.client.activeTimeout') }}
                  </span>
                </template>
                <el-input v-model="form.activeTimeout" :placeholder="$t('common.pleaseInput', { label: $t('system.client.activeTimeout') })" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item prop="timeout">
                <template #label>
                  <span>
                    <el-tooltip :content="$t('system.client.fixedTip')" placement="top">
                      <el-icon><question-filled /></el-icon>
                    </el-tooltip>
                    {{ $t('system.client.fixedTimeout') }}
                  </span>
                </template>
                <el-input v-model="form.timeout" :placeholder="$t('common.pleaseInput', { label: $t('system.client.fixedTimeout') })" />
              </el-form-item>
            </el-col>
          </el-row>
        </section>

        <section class="form-section">
          <h4>{{ $t('common.status') }}</h4>
          <el-row :gutter="18">
            <el-col :span="24">
              <el-form-item :label="$t('common.status')">
                <el-radio-group v-model="form.status">
                  <el-radio v-for="dict in sys_normal_disable" :key="dict.value" :value="dict.value">
                    {{ dict.label }}
                  </el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
          </el-row>
        </section>
      </el-form>
    </FormDrawer>
  </div>
</template>

<script setup name="Client" lang="ts">
import TableSkeleton from '@/components/Skeleton/TableSkeleton.vue';
import { listClient, getClient, delClient, addClient, updateClient, changeStatus } from '@/api/system/client';
import { ClientVO, ClientQuery, ClientForm } from '@/api/system/client/types';
import { useLoading } from '@/hooks/async/useLoading';
import { useFormDialog } from '@/hooks/dialog/useFormDialog';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import { useTableSelection } from '@/hooks/table/useTableSelection';
import modal from '@/plugins/modal';
import { useDict } from '@/utils/dict';
import { download as requestDownload } from '@/utils/request';
import FormDrawer from '@/components/FormDrawer/index.vue';
import logoUrl from '@/assets/logo/logo.png';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const { sys_normal_disable } = toRefs<any>(useDict('sys_normal_disable'));
const { sys_grant_type } = toRefs<any>(useDict('sys_grant_type'));
const { sys_device_type } = toRefs<any>(useDict('sys_device_type'));

const clientList = ref<ClientVO[]>([]);
const { loading, withLoading } = useLoading(true);
const { loading: buttonLoading, withLoading: withButtonLoading } = useLoading();
const { showSearch } = useSearchToggle();
const { ids, single, multiple, handleSelectionChange } = useTableSelection<ClientVO>(item => item.id);
const total = ref(0);

const queryFormRef = ref<ElFormInstance>();
const clientFormRef = ref<ElFormInstance>();

const initFormData: ClientForm = {
  id: undefined,
  clientId: undefined,
  clientKey: undefined,
  clientSecret: undefined,
  grantTypeList: undefined,
  deviceType: undefined,
  accessPath: undefined,
  accessPathList: undefined,
  ipWhitelist: undefined,
  ipWhitelistList: undefined,
  activeTimeout: undefined,
  timeout: undefined,
  status: '0'
};
const data = reactive<PageData<ClientForm, ClientQuery>>({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    clientId: undefined,
    clientKey: undefined,
    clientSecret: undefined,
    grantType: undefined,
    deviceType: undefined,
    accessPath: undefined,
    ipWhitelist: undefined,
    activeTimeout: undefined,
    timeout: undefined,
    status: undefined
  },
  rules: {}
});

const { queryParams, form } = toRefs(data);
const rules = computed<ElFormRules>(() => ({
  id: [{ required: true, message: t('system.client.required', { label: t('system.client.idLabel') }), trigger: 'blur' }],
  clientId: [{ required: true, message: t('system.client.required', { label: t('system.client.clientId') }), trigger: 'blur' }],
  clientKey: [{ required: true, message: t('system.client.required', { label: t('system.client.clientKey') }), trigger: 'blur' }],
  clientSecret: [{ required: true, message: t('system.client.required', { label: t('system.client.clientSecret') }), trigger: 'blur' }],
  grantTypeList: [{ required: true, message: t('system.client.required', { label: t('system.client.grantType') }), trigger: 'change' }],
  deviceType: [{ required: true, message: t('system.client.required', { label: t('system.client.deviceType') }), trigger: 'change' }]
}));
const { dialog, resetForm, openDialog, showDialog, closeDialog } = useFormDialog({
  form,
  formRef: clientFormRef,
  initialFormData: initFormData
});

/** 抽屉头部：客户端主名称字段为 clientKey */
const clientName = computed(() => form.value.clientKey || t('system.client.unnamed'));
const clientInitial = computed(() => (form.value.clientKey?.trim() || t('system.client.initial')).slice(0, 1));
const deviceTypeLabel = computed(() => {
  const dict = sys_device_type.value?.find((d: any) => d.value === form.value.deviceType);
  return dict?.label || t('system.client.noDevice');
});
const statusLabel = computed(() => {
  const dict = sys_normal_disable.value?.find((d: any) => d.value === form.value.status);
  return dict?.label || t('common.normal');
});
const accessPathText = computed(() => form.value.accessPath?.trim() || '');

const { resetQuery } = useSearchReset({
  queryFormRef,
  queryParams,
  pageNumKey: 'pageNum',
  afterReset: () => {
    handleQuery();
  }
});

const getRuleList = (ruleList?: string[], ruleValue?: string) => {
  if (Array.isArray(ruleList) && ruleList.length) {
    return ruleList;
  }
  if (!ruleValue) {
    return [];
  }
  return ruleValue
    .split(/[\n,;]+/)
    .map(item => item.trim())
    .filter(Boolean);
};

/** 查询客户端管理列表 */
const getList = async () => {
  await withLoading(async () => {
    const res = await listClient(queryParams.value);
    clientList.value = res.data?.rows ?? [];
    total.value = res.data?.total;
  });
};

/** 取消按钮 */
const cancel = () => {
  closeDialog();
  resetForm();
};

/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

/** 新增按钮操作 */
const handleAdd = () => {
  openDialog(t('system.client.addTitle'));
};

/** 修改按钮操作 */
const handleUpdate = async (row?: Partial<ClientVO>) => {
  resetForm();
  const clientId = row?.id || ids.value[0];
  const res = await getClient(clientId);
  Object.assign(form.value, res.data);
  showDialog(t('system.client.editTitle'));
};

/** 提交按钮 */
const submitForm = () => {
  clientFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      await withButtonLoading(async () => {
        if (form.value.id) {
          await updateClient(form.value);
        } else {
          await addClient(form.value);
        }
      });
      modal.msgSuccess(t('common.editSuccess'));
      closeDialog();
      await getList();
    }
  });
};

/** 删除按钮操作 */
const handleDelete = async (row?: Partial<ClientVO>) => {
  const clientIds = row?.id || ids.value;
  await modal.confirm(t('system.client.confirmDelete', { id: clientIds }));
  await delClient(clientIds);
  modal.msgSuccess(t('common.deleteSuccess'));
  await getList();
};

/** 导出按钮操作 */
const handleExport = () => {
  requestDownload(
    'system/client/export',
    {
      ...queryParams.value
    },
    `client_${new Date().getTime()}.xlsx`
  );
};

/** 状态修改  */
const handleStatusChange = async (row: Partial<ClientVO>) => {
  const text = row.status === '0' ? t('common.enable') : t('common.disable');
  try {
    await modal.confirm(t('system.client.confirmStatus', { action: text }));
    await changeStatus(row.clientId, row.status);
    modal.msgSuccess(t('system.client.statusSuccess', { action: text }));
  } catch (err) {
    row.status = row.status === '0' ? '1' : '0';
  }
};

onMounted(() => {
  getList();
});
</script>

<style lang="scss" scoped>
.system-client-page {
  :deep(.grant-type-tag) {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    row-gap: 4px;
  }

  :deep(.grant-type-tag .el-tag) {
    margin-left: 0 !important;
    margin-right: 0 !important;
  }

  .rule-tag-list {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px;
  }

  .rule-empty {
    color: var(--el-text-color-secondary);
  }
}
</style>

<style lang="scss" scoped>
.client-form :deep(.el-form-item) {
  margin-bottom: 16px;
}
.client-form :deep(.el-form-item__label) {
  padding-bottom: 6px;
  line-height: 1.3;
  font-size: 12.5px;
  font-weight: 600;
  color: #3f4a44;
}
.client-form :deep(.el-input__wrapper),
.client-form :deep(.el-select__wrapper),
.client-form :deep(.el-textarea__inner) {
  border-radius: 10px;
}
.client-form :deep(.el-form-item__content) {
  min-width: 0;
}
.form-section {
  padding: 0 0 15px;
  margin-bottom: 18px;
  border-bottom: 1px solid #edf0ef;
}
.form-section:last-child {
  padding-bottom: 0;
  margin-bottom: 0;
  border-bottom: 0;
}
.form-section h4 {
  margin: 0 0 13px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #6b7d74;
}
</style>

<style lang="scss" scoped>
.drawer-hero {
  position: relative;
  overflow: hidden;
  padding: 24px 28px 24px;
  color: #fff;
  background: linear-gradient(148deg, #0f3d33 0%, #1c5a48 70%, #256a55 100%);
}
.drawer-hero::after {
  content: '';
  position: absolute;
  top: -130px;
  right: -90px;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
}
.drawer-hero__top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 44px;
  font-size: 12px;
  font-weight: 700;
  color: #dff1e8;
  letter-spacing: 0.02em;
}
.drawer-hero__brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.drawer-hero__brand img {
  width: 22px;
  height: 22px;
  border-radius: 6px;
}
.drawer-hero__divider {
  color: rgba(223, 241, 232, 0.5);
}
.drawer-hero__action {
  color: #c9e4d7;
}
.drawer-hero__profile {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 15px;
  margin-top: 22px;
}
.drawer-hero__icon {
  width: 58px;
  height: 58px;
  flex: none;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.16);
  font-size: 22px;
  font-weight: 700;
  color: #fff;
}
.drawer-hero__name {
  margin-bottom: 7px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.drawer-hero__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #c9e4d7;
}
.drawer-hero__tag {
  padding: 4px 9px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  color: #eafff5;
  font-size: 11.5px;
  font-weight: 700;
}
</style>
