<template>
  <div class="p-2 app-container system-config-page">
    <div class="search-wrap">
      <el-card shadow="hover" class="search-panel" :class="{ 'is-collapsed': !showSearch }">
        <template #header>
          <div class="panel-heading search-panel-toggle" @click.stop="showSearch = !showSearch">
            <div>
              <span class="panel-kicker">Search Filters</span>
              <h3>筛选条件</h3>
            </div>
          </div>
        </template>
        <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="query-form">
          <el-form-item label="参数名称" prop="configName">
            <el-input
              v-model="queryParams.configName"
              placeholder="请输入参数名称"
              clearable
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item label="参数键名" prop="configKey">
            <el-input
              v-model="queryParams.configKey"
              placeholder="请输入参数键名"
              clearable
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetQuery">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>

    <el-card v-loading="loading" shadow="hover" class="table-panel config-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="panel-kicker">Config Dataset</span>
            <h3>参数列表</h3>
            <p>共 {{ total }} 条记录，支持键值维护、导出和缓存刷新。</p>
          </div>
          <div class="toolbar-actions">
            <el-button v-hasPermi="['system:config:add']" type="primary" plain icon="Plus" @click="handleAdd">
              新增
            </el-button>
            <el-button v-hasPermi="['system:config:export']" type="warning" plain icon="Download" @click="handleExport">
              导出
            </el-button>
            <el-button
              v-hasPermi="['system:config:remove']"
              type="danger"
              plain
              icon="Refresh"
              @click="handleRefreshCache"
            >
              刷新缓存
            </el-button>
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList"></right-toolbar>
          </div>
        </div>
      </template>

      <div class="config-body">
        <el-tabs v-model="activeTab" tab-position="left" class="config-tabs" @tab-change="handleTabChange">
          <el-tab-pane label="全部" name="" />
          <el-tab-pane label="系统内置" name="Y" />
          <el-tab-pane label="自定义配置" name="N" />
        </el-tabs>

        <div class="config-content">
          <el-table :data="configList" :border="false" class="data-table">
            <el-table-column label="参数名称" prop="configName" min-width="160" />
            <el-table-column label="参数键名" prop="configKey" min-width="160" />
            <el-table-column label="参数键值" min-width="160">
              <template #default="{ row }">
                <el-input
                  v-model="row.configValue"
                  placeholder="请输入参数键值"
                  @blur="handleInlineSave(row)"
                  @keyup.enter="handleInlineSave(row)"
                />
              </template>
            </el-table-column>
            <el-table-column label="备注" prop="remark" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.remark || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80" align="center">
              <template #default="{ row }">
                <el-tooltip content="修改" placement="top">
                  <el-button
                    v-hasPermi="['system:config:edit']"
                    link
                    type="primary"
                    icon="Edit"
                    @click="handleUpdate(row)"
                  ></el-button>
                </el-tooltip>
                <el-tooltip content="删除" placement="top">
                  <el-button
                    v-hasPermi="['system:config:remove']"
                    link
                    type="danger"
                    icon="Delete"
                    @click="handleDelete(row)"
                  ></el-button>
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>
          <pagination
            v-show="total > 0"
            v-model:page="queryParams.pageNum"
            v-model:limit="queryParams.pageSize"
            :total="total"
            @pagination="getList"
          />
        </div>
      </div>
    </el-card>

    <!-- 添加或修改参数配置抽屉 -->
    <FormDrawer
      v-model="dialog.visible"
      :title="dialog.title"
      eyebrow="参数设置"
      subtitle="配置系统参数项、键值与类型"
      size="560px"
      submit-text="确定"
      hint="带 * 为必填项，保存后立即生效"
      @submit="submitForm"
      @closed="cancel"
    >
      <template #hero>
        <div class="config-hero">
          <div class="config-hero__top">
            <span class="config-hero__brand"><img :src="logoUrl" alt="" />V5Notes 参数设置</span>
            <span class="config-hero__divider">·</span>
            <span class="config-hero__action">{{ dialog.title }}</span>
          </div>
          <div class="config-hero__profile">
            <div class="config-hero__icon">{{ (form.configName || '参').slice(0, 1) }}</div>
            <div>
              <div class="config-hero__name">{{ form.configName || '未命名参数' }}</div>
              <div class="config-hero__meta">
                <span class="config-hero__tag">{{ configTypeLabel }}</span>
                <span>{{ form.configKey || '未设置键名' }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <el-form ref="configFormRef" :model="form" :rules="rules" label-position="top" class="config-form">
        <section class="form-section">
          <h4>基本信息</h4>
          <el-row :gutter="18">
            <el-col :span="12">
              <el-form-item label="参数名称" prop="configName">
                <el-input v-model="form.configName" placeholder="请输入参数名称" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="参数键名" prop="configKey">
                <el-input v-model="form.configKey" placeholder="请输入参数键名" />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item label="参数键值" prop="configValue">
                <el-input v-model="form.configValue" type="textarea" :rows="3" placeholder="请输入参数键值" />
              </el-form-item>
            </el-col>
          </el-row>
        </section>

        <section class="form-section">
          <h4>类型与备注</h4>
          <el-row :gutter="18">
            <el-col :span="12">
              <el-form-item label="系统内置" prop="configType">
                <el-radio-group v-model="form.configType">
                  <el-radio v-for="dict in sys_yes_no" :key="dict.value" :value="dict.value">{{ dict.label }}</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item label="备注" prop="remark">
                <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="请输入内容" />
              </el-form-item>
            </el-col>
          </el-row>
        </section>
      </el-form>
    </FormDrawer>
  </div>
</template>

<script setup name="Config" lang="ts">
import { listConfig, getConfig, delConfig, addConfig, updateConfig, updateConfigByKey, refreshCache } from '@/api/system/config';
import { ConfigForm, ConfigQuery, ConfigVO } from '@/api/system/config/types';
import { useLoading } from '@/hooks/async/useLoading';
import { useFormDialog } from '@/hooks/dialog/useFormDialog';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import modal from '@/plugins/modal';
import { useDict } from '@/utils/dict';
import { download as requestDownload } from '@/utils/request';
import FormDrawer from '@/components/FormDrawer/index.vue';
import logoUrl from '@/assets/logo/logo.png';

const { sys_yes_no } = toRefs<any>(useDict('sys_yes_no'));

const configTypeLabel = computed(() => {
  const dict = (sys_yes_no.value || []).find((item: any) => item.value === form.value.configType);
  return dict?.label || (form.value.configType === 'Y' ? '是' : '否');
});

const configList = ref<ConfigVO[]>([]);
const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();
const total = ref(0);
const activeTab = ref('');

const queryFormRef = ref<ElFormInstance>();
const configFormRef = ref<ElFormInstance>();
const initFormData: ConfigForm = {
  configId: undefined,
  configName: '',
  configKey: '',
  configValue: '',
  configType: 'Y',
  remark: ''
};
const data = reactive<PageData<ConfigForm, ConfigQuery>>({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    configName: '',
    configKey: '',
    configType: ''
  },
  rules: {
    configName: [{ required: true, message: '参数名称不能为空', trigger: 'blur' }],
    configKey: [{ required: true, message: '参数键名不能为空', trigger: 'blur' }],
    configValue: [{ required: true, message: '参数键值不能为空', trigger: 'blur' }]
  }
});

const { queryParams, form, rules } = toRefs(data);
const { dialog, resetForm, openDialog, showDialog, closeDialog } = useFormDialog({
  form,
  formRef: configFormRef,
  initialFormData: initFormData
});
const { resetQuery } = useSearchReset({
  queryFormRef,
  queryParams,
  pageNumKey: 'pageNum',
  afterReset: () => {
    handleQuery();
  }
});

/** 查询参数列表 */
const getList = async () => {
  await withLoading(async () => {
    const res = await listConfig({ ...queryParams.value });
    configList.value = res.data?.rows;
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
/** tab 切换 */
const handleTabChange = (tab: string | number) => {
  queryParams.value.configType = tab as string;
  queryParams.value.pageNum = 1;
  getList();
};
/** 新增按钮操作 */
const handleAdd = () => {
  openDialog('添加参数');
};
/** 修改按钮操作 */
const handleUpdate = async (row?: Partial<ConfigVO>) => {
  resetForm();
  const configId = row?.configId;
  const res = await getConfig(configId!);
  Object.assign(form.value, res.data);
  showDialog('修改参数');
};
/** 内联保存参数值 */
const handleInlineSave = async (row: Partial<ConfigVO>) => {
  if (!row.configKey) {
    return;
  }
  await modal.confirm('确认要保存对参数"' + row.configKey + '"的修改吗？');
  await updateConfigByKey(row.configKey, row.configValue ?? '');
  modal.msgSuccess('修改成功');
};
/** 提交按钮 */
const submitForm = () => {
  configFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      form.value.configId ? await updateConfig(form.value) : await addConfig(form.value);
      modal.msgSuccess('操作成功');
      closeDialog();
      await getList();
    }
  });
};
/** 删除按钮操作 */
const handleDelete = async (row?: Partial<ConfigVO>) => {
  const configIds = row?.configId;
  await modal.confirm('是否确认删除参数编号为"' + configIds + '"的数据项？');
  await delConfig(configIds!);
  await getList();
  modal.msgSuccess('删除成功');
};
/** 导出按钮操作 */
const handleExport = () => {
  requestDownload(
    'system/config/export',
    {
      ...queryParams.value
    },
    `config_${new Date().getTime()}.xlsx`
  );
};
/** 刷新缓存按钮操作 */
const handleRefreshCache = async () => {
  await refreshCache();
  modal.msgSuccess('刷新缓存成功');
};

onMounted(() => {
  getList();
});
</script>

<style lang="scss" scoped>
@use '@/assets/styles/components/page-shell' as pageShell;

@include pageShell.toolbar-responsive;

.config-body {
  display: flex;
}

.config-tabs {
  flex-shrink: 0;
}

.config-tabs :deep(.el-tabs__header.is-left) {
  margin-right: 0;
}

.config-tabs :deep(.el-tabs__nav-wrap.is-left::after) {
  width: 1px;
  background: var(--el-border-color-lighter);
}

.config-tabs :deep(.el-tabs__content) {
  display: none;
}

.config-tabs :deep(.el-tabs__item) {
  height: 36px;
  padding: 0 16px;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.config-tabs :deep(.el-tabs__item.is-active) {
  color: var(--el-color-primary);
  font-weight: 500;
}

.config-content {
  flex: 1;
  min-width: 0;
  padding-left: 16px;
}
</style>

<style lang="scss" scoped>
.config-hero {
  position: relative;
  overflow: hidden;
  padding: 24px 28px;
  color: #fff;
  background: linear-gradient(148deg, #0f3d33 0%, #1c5a48 70%, #256a55 100%);
}
.config-hero::after {
  content: '';
  position: absolute;
  top: -130px;
  right: -90px;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
}
.config-hero__top {
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
.config-hero__brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.config-hero__brand img {
  width: 22px;
  height: 22px;
  border-radius: 6px;
}
.config-hero__divider {
  color: rgba(223, 241, 232, 0.5);
}
.config-hero__action {
  color: #c9e4d7;
}
.config-hero__profile {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 15px;
  margin-top: 22px;
}
.config-hero__icon {
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
}
.config-hero__name {
  margin-bottom: 7px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.config-hero__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #c9e4d7;
}
.config-hero__tag {
  padding: 4px 9px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  color: #eafff5;
  font-size: 11.5px;
  font-weight: 700;
}

.config-form :deep(.el-form-item) {
  margin-bottom: 16px;
}
.config-form :deep(.el-form-item__label) {
  padding-bottom: 6px;
  line-height: 1.3;
  font-size: 12.5px;
  font-weight: 600;
  color: #3f4a44;
}
.config-form :deep(.el-input__wrapper),
.config-form :deep(.el-select__wrapper),
.config-form :deep(.el-textarea__inner) {
  border-radius: 10px;
}
.config-form :deep(.el-form-item__content) {
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
