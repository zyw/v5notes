<template>
  <div class="p-2 app-container dict-page">
    <el-row :gutter="16" class="dict-grid">
      <!-- 字典类型 -->
      <el-col :xs="24" :lg="12">
        <el-card shadow="hover" class="dict-card table-panel">
          <template #header>
            <div class="toolbar-shell dict-card__header">
              <div class="table-heading">
                <div
                  class="panel-heading search-panel-toggle dict-title-toggle"
                  :class="{ 'is-collapsed': !showTypeSearch }"
                  @click.stop="showTypeSearch = !showTypeSearch"
                >
                  <div>
                    <h3>{{ $t('system.dict.title') }}</h3>
                    <p class="dict-card__subtitle">{{ $t('system.dict.typeSummary', { total: typeTotal }) }}</p>
                  </div>
                </div>
              </div>
              <div class="toolbar-actions">
                <right-toolbar v-model:show-search="showTypeSearch" :search="false" @query-table="getTypeList" />
              </div>
            </div>
          </template>

          <div class="dict-search" :class="{ 'is-collapsed': !showTypeSearch }">
            <el-form ref="typeQueryFormRef" :model="typeQueryParams" :inline="true" class="query-form">
              <el-form-item :label="$t('system.dict.name')" prop="dictName">
                <el-input
                  v-model="typeQueryParams.dictName"
                  :placeholder="$t('common.pleaseInput', { label: $t('system.dict.name') })"
                  clearable
                  @keyup.enter="handleTypeQuery"
                />
              </el-form-item>
              <el-form-item :label="$t('system.dict.type')" prop="dictType">
                <el-input
                  v-model="typeQueryParams.dictType"
                  :placeholder="$t('common.pleaseInput', { label: $t('system.dict.type') })"
                  clearable
                  @keyup.enter="handleTypeQuery"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" icon="Search" @click="handleTypeQuery">{{ $t('common.search') }}</el-button>
                <el-button icon="Refresh" @click="handleTypeResetQuery">{{ $t('common.reset') }}</el-button>
              </el-form-item>
            </el-form>
          </div>

          <div class="toolbar-actions dict-actions">
            <el-button v-hasPermi="['system:dict:add']" type="primary" plain icon="Plus" @click="handleTypeAdd">
              {{ $t('common.add') }}
            </el-button>
            <el-button
              v-hasPermi="['system:dict:edit']"
              type="success"
              plain
              icon="Edit"
              :disabled="typeSingle"
              @click="handleTypeUpdate()"
            >
              {{ $t('common.edit') }}
            </el-button>
            <el-button
              v-hasPermi="['system:dict:remove']"
              type="danger"
              plain
              icon="Delete"
              :disabled="typeMultiple"
              @click="handleTypeDelete()"
            >
              {{ $t('common.delete') }}
            </el-button>
            <el-button
              v-hasPermi="['system:dict:export']"
              type="warning"
              plain
              icon="Download"
              @click="handleTypeExport"
            >
              {{ $t('common.export') }}
            </el-button>
            <el-button
              v-hasPermi="['system:dict:remove']"
              type="danger"
              plain
              icon="Refresh"
              @click="handleRefreshCache"
            >
              {{ $t('system.dict.refreshCache') }}
            </el-button>
          </div>

          <div class="dict-table-wrap">
            <el-table
              ref="typeTableRef"
              v-loading="typeLoading && (typeList).length > 0"
              border
              class="data-table"
              data-full-height-table="false"
              :height="typeTableHeight"
              :data="typeList"
              highlight-current-row
              @row-click="handleTypeRowClick"
              @selection-change="handleTypeSelectionChange"
            >
              <el-table-column type="selection" width="55" align="center" />
              <el-table-column v-if="false" :label="$t('system.dict.dictId')" align="center" prop="dictId" />
              <el-table-column :label="$t('system.dict.name')" align="center" prop="dictName" width="120" />
              <el-table-column :label="$t('system.dict.type')" align="center" prop="dictType" width="160">
                <template #default="scope">
                  <span class="link-type" @click.stop="handleTypeRowClick(scope.row)">
                    {{ scope.row.dictType }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column :label="$t('common.remark')" align="center" prop="remark" width="160" />
              <el-table-column :label="$t('common.createTime')" align="center" prop="createTime" width="180">
                <template #default="scope">
                  <span>{{ parseTime(scope.row.createTime) }}</span>
                </template>
              </el-table-column>
              <el-table-column
                :label="$t('common.operate')"
                fixed="right"
                align="center"
                width="120"
                class-name="small-padding fixed-width"
              >
                <template #default="scope">
                  <el-tooltip :content="$t('common.edit')" placement="top">
                    <el-button
                      v-hasPermi="['system:dict:edit']"
                      link
                      type="primary"
                      icon="Edit"
                      @click="handleTypeUpdate(scope.row)"
                    ></el-button>
                  </el-tooltip>
                  <el-tooltip :content="$t('common.delete')" placement="top">
                    <el-button
                      v-hasPermi="['system:dict:remove']"
                      link
                      type="primary"
                      icon="Delete"
                      @click="handleTypeDelete(scope.row)"
                    ></el-button>
                  </el-tooltip>
                </template>
              </el-table-column>
              <template #empty>
                <table-skeleton v-if="typeLoading" :rows="8" />
                <div v-else class="empty-hint">{{ $t('common.noData') }}</div>
              </template>
            </el-table>
          </div>

          <pagination
            v-model:page="typeQueryParams.pageNum"
            v-model:limit="typeQueryParams.pageSize"
            :total="typeTotal"
            @pagination="getTypeList"
          />
        </el-card>
      </el-col>

      <!-- 字典数据 -->
      <el-col :xs="24" :lg="12">
        <el-card shadow="hover" class="dict-card table-panel">
          <template #header>
            <div class="toolbar-shell dict-card__header">
              <div class="table-heading">
                <div
                  class="panel-heading search-panel-toggle dict-title-toggle"
                  :class="{ 'is-collapsed': !showDataSearch }"
                  @click.stop="showDataSearch = !showDataSearch"
                >
                  <div>
                    <h3>{{ $t('system.dict.dataTitle') }}</h3>
                    <p v-if="hasCurrentDict" class="dict-card__subtitle">{{ currentDictLabel }}</p>
                  </div>
                </div>
              </div>
              <div class="toolbar-actions">
                <right-toolbar v-model:show-search="showDataSearch" :search="false" @query-table="getDataList" />
              </div>
            </div>
          </template>

          <div class="dict-search" :class="{ 'is-collapsed': !showDataSearch }">
            <el-form ref="dataQueryFormRef" :model="dataQueryParams" :inline="true" class="query-form">
              <el-form-item :label="$t('system.dict.label')" prop="dictLabel">
                <el-input
                  v-model="dataQueryParams.dictLabel"
                  :placeholder="$t('common.pleaseInput', { label: $t('system.dict.label') })"
                  clearable
                  :disabled="!hasCurrentDict"
                  @keyup.enter="handleDataQuery"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" icon="Search" :disabled="!hasCurrentDict" @click="handleDataQuery">
                  {{ $t('common.search') }}
                </el-button>
                <el-button icon="Refresh" :disabled="!hasCurrentDict" @click="handleDataResetQuery">{{ $t('common.reset') }}</el-button>
              </el-form-item>
            </el-form>
          </div>

          <div class="toolbar-actions dict-actions">
            <el-button
              v-hasPermi="['system:dict:add']"
              type="primary"
              plain
              icon="Plus"
              :disabled="!hasCurrentDict"
              @click="handleDataAdd"
            >
              {{ $t('common.add') }}
            </el-button>
            <el-button
              v-hasPermi="['system:dict:edit']"
              type="success"
              plain
              icon="Edit"
              :disabled="dataSingle || !hasCurrentDict"
              @click="handleDataUpdate()"
            >
              {{ $t('common.edit') }}
            </el-button>
            <el-button
              v-hasPermi="['system:dict:remove']"
              type="danger"
              plain
              icon="Delete"
              :disabled="dataMultiple || !hasCurrentDict"
              @click="handleDataDelete()"
            >
              {{ $t('common.delete') }}
            </el-button>
            <el-button
              v-hasPermi="['system:dict:export']"
              type="warning"
              plain
              icon="Download"
              :disabled="!hasCurrentDict"
              @click="handleDataExport"
            >
              {{ $t('common.export') }}
            </el-button>
          </div>

          <div class="dict-table-wrap">
            <el-table
              v-loading="dataLoading && dataList.length > 0"
              border
              class="data-table"
              data-full-height-table="false"
              :height="dataTableHeight"
              :data="dataList"
              @selection-change="handleDataSelectionChange"
            >
              <el-table-column type="selection" width="55" align="center" />
              <el-table-column v-if="false" :label="$t('system.dict.dictCode')" align="center" prop="dictCode" />
              <el-table-column :label="$t('system.dict.label')" align="center" prop="dictLabel" width="100">
                <template #default="scope">
                  <span
                    v-if="
                      (scope.row.listClass === '' || scope.row.listClass === 'default') &&
                      (scope.row.cssClass === '' || scope.row.cssClass == null)
                    "
                  >
                    {{ scope.row.dictLabel }}
                  </span>
                  <el-tag
                    v-else
                    :type="
                      scope.row.listClass === 'primary' || scope.row.listClass === 'default'
                        ? 'primary'
                        : scope.row.listClass
                    "
                    :class="scope.row.cssClass"
                  >
                    {{ scope.row.dictLabel }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column :label="$t('system.dict.dictValue')" align="center" prop="dictValue" width="100" />
              <el-table-column :label="$t('system.dict.dictSort')" align="center" prop="dictSort" width="80" />
              <el-table-column :label="$t('common.remark')" align="center" prop="remark" width="100" />
              <el-table-column :label="$t('common.createTime')" align="center" prop="createTime" width="180">
                <template #default="scope">
                  <span>{{ parseTime(scope.row.createTime) }}</span>
                </template>
              </el-table-column>
              <el-table-column
                :label="$t('common.operate')"
                fixed="right"
                align="center"
                width="120"
                class-name="small-padding fixed-width"
              >
                <template #default="scope">
                  <el-tooltip :content="$t('common.edit')" placement="top">
                    <el-button
                      v-hasPermi="['system:dict:edit']"
                      link
                      type="primary"
                      icon="Edit"
                      @click="handleDataUpdate(scope.row)"
                    ></el-button>
                  </el-tooltip>
                  <el-tooltip :content="$t('common.delete')" placement="top">
                    <el-button
                      v-hasPermi="['system:dict:remove']"
                      link
                      type="primary"
                      icon="Delete"
                      @click="handleDataDelete(scope.row)"
                    ></el-button>
                  </el-tooltip>
                </template>
              </el-table-column>
            <template #empty>
              <table-skeleton v-if="dataLoading" :rows="6" />
              <div v-else class="empty-hint">{{ $t('common.noData') }}</div>
            </template>
            </el-table>
          </div>

          <pagination
            v-model:page="dataQueryParams.pageNum"
            v-model:limit="dataQueryParams.pageSize"
            :total="dataTotal"
            @pagination="getDataList"
          />
        </el-card>
      </el-col>
    </el-row>

    <!-- 字典类型对话框 -->
    <el-dialog v-model="typeDialog.visible" :title="typeDialog.title" width="500px" append-to-body class="app-dialog">
      <template #header>
        <div class="app-dialog-hero">
          <div class="app-dialog-hero__top">
            <img src="@/assets/logo/logo.png" alt="" />
            <span>{{ $t('system.dict.typeBrand') }}</span>
          </div>
          <div class="app-dialog-hero__main">
            <div class="app-dialog-hero__icon">{{ (typeForm.dictName || $t('system.dict.initial')).slice(0, 1) }}</div>
            <div>
              <div class="app-dialog-hero__name">{{ typeForm.dictName || typeDialog.title }}</div>
              <div class="app-dialog-hero__meta"><span>{{ typeForm.dictType || typeDialog.title }}</span></div>
            </div>
          </div>
        </div>
      </template>

      <el-form ref="typeFormRef" :model="typeForm" :rules="typeRules" label-position="top" class="app-dialog-form">
        <el-form-item :label="$t('system.dict.name')" prop="dictName">
          <el-input v-model="typeForm.dictName" :placeholder="$t('common.pleaseInput', { label: $t('system.dict.name') })" />
        </el-form-item>
        <el-form-item prop="dictType">
          <template #label>
            <span>
              <el-tooltip :content="$t('system.dict.typeKeyTip')" placement="top">
                <i class="el-icon-question"></i>
              </el-tooltip>
              {{ $t('system.dict.type') }}
            </span>
          </template>
          <el-input v-model="typeForm.dictType" :placeholder="$t('common.pleaseInput', { label: $t('system.dict.type') })" maxlength="100" />
        </el-form-item>
        <el-form-item :label="$t('common.remark')" prop="remark">
          <el-input v-model="typeForm.remark" type="textarea" :placeholder="$t('common.pleaseInput', { label: $t('common.content') })"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitTypeForm">{{ $t('common.confirm') }}</el-button>
          <el-button @click="cancelType">{{ $t('common.cancel') }}</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 字典数据抽屉 -->
    <FormDrawer
      v-model="dataDialog.visible"
      :title="dataDialog.title"
      :eyebrow="$t('system.dict.eyebrow')"
      :subtitle="$t('system.dict.subtitle')"
      size="560px"
      :submit-text="$t('common.confirm')"
      :hint="$t('system.dict.requiredHint')"
      @submit="submitDataForm"
      @closed="cancelData"
    >
      <template #hero>
        <div class="data-hero">
          <div class="data-hero__top">
            <span class="data-hero__brand"><img :src="logoUrl" alt="" />{{ $t('system.dict.dataBrand') }}</span>
            <span class="data-hero__divider">·</span>
            <span class="data-hero__action">{{ dataDialog.title }}</span>
          </div>
          <div class="data-hero__profile">
            <div class="data-hero__icon">{{ (dataForm.dictLabel || $t('system.dict.initial')).slice(0, 1) }}</div>
            <div>
              <div class="data-hero__name">{{ dataForm.dictLabel || $t('system.dict.unnamed') }}</div>
              <div class="data-hero__meta">
                <span class="data-hero__tag">{{ listClassLabel }}</span>
                <span>{{ dataForm.dictValue || $t('system.dict.noValue') }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <el-form ref="dataFormRef" :model="dataForm" :rules="dataRules" label-position="top" class="data-form">
        <section class="form-section">
          <h4>{{ $t('common.basicInfo') }}</h4>
          <el-row :gutter="18">
            <el-col :span="24">
              <el-form-item :label="$t('system.dict.type')">
                <el-input v-model="dataForm.dictType" :disabled="true" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('system.dict.dataLabel')" prop="dictLabel">
                <el-input v-model="dataForm.dictLabel" :placeholder="$t('common.pleaseInput', { label: $t('system.dict.dataLabel') })" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('system.dict.dataValue')" prop="dictValue">
                <el-input v-model="dataForm.dictValue" :placeholder="$t('common.pleaseInput', { label: $t('system.dict.dataValue') })" />
              </el-form-item>
            </el-col>
          </el-row>
        </section>

        <section class="form-section">
          <h4>{{ $t('system.dict.styleSection') }}</h4>
          <el-row :gutter="18">
            <el-col :span="12">
              <el-form-item :label="$t('system.dict.cssClass')" prop="cssClass">
                <el-input v-model="dataForm.cssClass" :placeholder="$t('common.pleaseInput', { label: $t('system.dict.cssClass') })" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('system.dict.displaySort')" prop="dictSort">
                <el-input-number v-model="dataForm.dictSort" controls-position="right" :min="0" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('system.dict.listClass')" prop="listClass">
                <el-select v-model="dataForm.listClass">
                  <el-option
                    v-for="item in listClassOptions"
                    :key="item.value"
                    :label="item.label + '(' + item.value + ')'"
                    :value="item.value"
                  ></el-option>
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
        </section>

        <section class="form-section">
          <h4>{{ $t('common.remark') }}</h4>
          <el-form-item :label="$t('common.remark')" prop="remark">
            <el-input v-model="dataForm.remark" type="textarea" :rows="3" :placeholder="$t('common.pleaseInput', { label: $t('common.content') })"></el-input>
          </el-form-item>
        </section>
      </el-form>
    </FormDrawer>
  </div>
</template>

<script setup name="Dict" lang="ts">
import TableSkeleton from '@/components/Skeleton/TableSkeleton.vue';
import { listData, getData, delData, addData, updateData } from '@/api/system/dict/data';
import { DictDataForm, DictDataQuery, DictDataVO } from '@/api/system/dict/data/types';
import { listType, getType, delType, addType, updateType, refreshCache } from '@/api/system/dict/type';
import { DictTypeForm, DictTypeQuery, DictTypeVO } from '@/api/system/dict/type/types';
import modal from '@/plugins/modal';
import { useDictStore } from '@/store/modules/dict';
import { download as requestDownload } from '@/utils/request';
import { parseTime } from '@/utils/ruoyi';
import FormDrawer from '@/components/FormDrawer/index.vue';
import logoUrl from '@/assets/logo/logo.png';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const typeList = ref<DictTypeVO[]>([]);

/** 表格自适应高度：占满卡片剩余空间，只在表格内部滚动（页面不出现纵向滚动条） */
const typeTableHeight = ref<number>();
const dataTableHeight = ref<number>();
const TABLE_MIN_HEIGHT = 200;
let resizeRaf = 0;

// 分页行固定占位（含 margin），始终预留，避免数据加载前后高度跳动把分页挤出卡片
const PAGINATION_RESERVED = 44;

/** 计算卡片可用高度上限（以视口为基准，小屏也不会溢出） */
const getCardRoom = (card: HTMLElement) => {
  const rect = card.getBoundingClientRect();
  const bottomGap = 16;
  return Math.max(0, window.innerHeight - rect.top - bottomGap);
};

const measureTable = (wrap: HTMLElement, min: number) => {
  const card = wrap.closest('.el-card') as HTMLElement | null;
  const body = wrap.parentElement as HTMLElement | null;
  if (!card || !body) return min;
  const cardRoom = getCardRoom(card);
  const bodyStyle = window.getComputedStyle(body);
  const padTop = Number.parseFloat(bodyStyle.paddingTop) || 0;
  const padBottom = Number.parseFloat(bodyStyle.paddingBottom) || 0;
  const headerEl = card.querySelector<HTMLElement>('.el-card__header');
  const headerHeight = headerEl?.getBoundingClientRect().height || 0;
  let used = padTop + padBottom + headerHeight + PAGINATION_RESERVED;
  Array.from(body.children).forEach(child => {
    if (child === wrap) return;
    const el = child as HTMLElement;
    if (el.classList.contains('pagination-container')) return;
    const style = window.getComputedStyle(el);
    used += el.getBoundingClientRect().height + (Number.parseFloat(style.marginBottom) || 0);
  });
  return Math.max(min, Math.floor(cardRoom - used));
};

const measureTables = () => {
  const wraps = Array.from(document.querySelectorAll<HTMLElement>('.dict-page .dict-table-wrap'));
  if (wraps.length === 0) return;
  // 先给卡片写入视口驱动的最大高度，再据此计算表格高度
  const card = wraps[0].closest('.el-card') as HTMLElement | null;
  if (card) {
    const room = getCardRoom(card);
    document.querySelectorAll<HTMLElement>('.dict-page .dict-card').forEach(el => {
      el.style.setProperty('--dict-card-max', room + 'px');
    });
  }
  typeTableHeight.value = measureTable(wraps[0], TABLE_MIN_HEIGHT);
  if (wraps.length > 1) dataTableHeight.value = measureTable(wraps[1], TABLE_MIN_HEIGHT);
};

const scheduleMeasure = () => {
  if (resizeRaf) return;
  resizeRaf = window.requestAnimationFrame(() => {
    resizeRaf = 0;
    measureTables();
  });
};
const typeLoading = ref(true);
const showTypeSearch = ref(true);
const typeIds = ref<Array<number | string>>([]);
const typeSingle = ref(true);
const typeMultiple = ref(true);
const typeTotal = ref(0);

const typeFormRef = ref<ElFormInstance>();
const typeQueryFormRef = ref<ElFormInstance>();
const typeTableRef = ref<ElTableInstance>();

const typeDialog = reactive<DialogOption>({
  visible: false,
  title: ''
});

const typeInitFormData: DictTypeForm = {
  dictId: undefined,
  dictName: '',
  dictType: '',
  remark: ''
};

const typeState = reactive<PageData<DictTypeForm, DictTypeQuery>>({
  form: { ...typeInitFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    dictName: '',
    dictType: ''
  },
  rules: {}
});

const { queryParams: typeQueryParams, form: typeForm } = toRefs(typeState);
const typeRules = computed<ElFormRules>(() => ({
  dictName: [{ required: true, message: t('system.dict.required', { label: t('system.dict.name') }), trigger: 'blur' }],
  dictType: [{ required: true, message: t('system.dict.required', { label: t('system.dict.type') }), trigger: 'blur' }]
}));

const currentDict = ref<DictTypeVO | null>(null);
const hasCurrentDict = computed(() => !!currentDict.value);
const currentDictLabel = computed(() => {
  if (!currentDict.value) return t('system.dict.selectFirst');
  return `${currentDict.value.dictName} / ${currentDict.value.dictType}`;
});

const dataList = ref<DictDataVO[]>([]);
const dataLoading = ref(false);
const showDataSearch = ref(true);
const dataIds = ref<Array<string | number>>([]);
const dataSingle = ref(true);
const dataMultiple = ref(true);
const dataTotal = ref(0);

const dataFormRef = ref<ElFormInstance>();
const dataQueryFormRef = ref<ElFormInstance>();

const dataDialog = reactive<DialogOption>({
  visible: false,
  title: ''
});

const listClassOptions = computed(() => [
  { value: 'default', label: t('system.dict.listDefault') },
  { value: 'primary', label: t('system.dict.listPrimary') },
  { value: 'success', label: t('common.success') },
  { value: 'info', label: t('system.dict.listInfo') },
  { value: 'warning', label: t('system.dict.listWarning') },
  { value: 'danger', label: t('system.dict.listDanger') }
]);

const dataInitFormData: DictDataForm = {
  dictCode: undefined,
  dictLabel: '',
  dictValue: '',
  cssClass: '',
  listClass: 'primary',
  dictSort: 0,
  remark: ''
};

const dataState = reactive<PageData<DictDataForm, DictDataQuery>>({
  form: { ...dataInitFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    dictName: '',
    dictType: '',
    dictLabel: ''
  },
  rules: {}
});

const { queryParams: dataQueryParams, form: dataForm } = toRefs(dataState);
const dataRules = computed<ElFormRules>(() => ({
  dictLabel: [{ required: true, message: t('system.dict.required', { label: t('system.dict.dataLabel') }), trigger: 'blur' }],
  dictValue: [{ required: true, message: t('system.dict.required', { label: t('system.dict.dataValue') }), trigger: 'blur' }],
  dictSort: [{ required: true, message: t('system.dict.sortRequired'), trigger: 'blur' }]
}));

const listClassLabel = computed(
  () => listClassOptions.value.find(item => item.value === dataForm.value.listClass)?.label || t('system.dict.listDefault')
);

const getTypeList = () => {
  typeLoading.value = true;
  listType(typeQueryParams.value).then(res => {
    typeList.value = res.data?.rows ?? [];
    typeTotal.value = res.data?.total;
    typeLoading.value = false;
    ensureCurrentType();
  });
};

const ensureCurrentType = () => {
  if (!typeList.value.length) {
    currentDict.value = null;
    dataQueryParams.value.dictType = '';
    dataList.value = [];
    dataTotal.value = 0;
    return;
  }

  const current = currentDict.value && typeList.value.find(item => item.dictId === currentDict.value?.dictId);
  const nextRow = current || typeList.value[0];
  setCurrentType(nextRow);
};

const setCurrentType = (row: DictTypeVO) => {
  currentDict.value = row;
  dataQueryParams.value.dictType = row.dictType;
  dataQueryParams.value.pageNum = 1;
  dataQueryParams.value.dictLabel = '';
  getDataList();
  nextTick(() => typeTableRef.value?.setCurrentRow(row));
};

const handleTypeRowClick = (row: Partial<DictTypeVO>) => {
  setCurrentType(row as DictTypeVO);
};

const cancelType = () => {
  resetTypeForm();
  typeDialog.visible = false;
};

const resetTypeForm = () => {
  typeForm.value = { ...typeInitFormData };
  typeFormRef.value?.resetFields();
};

const handleTypeQuery = () => {
  typeQueryParams.value.pageNum = 1;
  getTypeList();
};

const handleTypeResetQuery = () => {
  typeQueryFormRef.value?.resetFields();
  handleTypeQuery();
};

const handleTypeAdd = () => {
  resetTypeForm();
  typeDialog.visible = true;
  typeDialog.title = t('system.dict.addType');
};

const handleTypeSelectionChange = (selection: DictTypeVO[]) => {
  typeIds.value = selection.map(item => item.dictId);
  typeSingle.value = selection.length != 1;
  typeMultiple.value = !selection.length;
};

const handleTypeUpdate = async (row?: Partial<DictTypeVO>) => {
  resetTypeForm();
  const dictId = row?.dictId || typeIds.value[0];
  const res = await getType(dictId);
  Object.assign(typeForm.value, res.data);
  typeDialog.visible = true;
  typeDialog.title = t('system.dict.editType');
};

const submitTypeForm = () => {
  typeFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      typeForm.value.dictId ? await updateType(typeForm.value) : await addType(typeForm.value);
      modal.msgSuccess(t('common.actionSuccess'));
      typeDialog.visible = false;
      getTypeList();
    }
  });
};

const handleTypeDelete = async (row?: Partial<DictTypeVO>) => {
  const dictIds = row?.dictId || typeIds.value;
  await modal.confirm(t('system.dict.confirmDeleteType', { id: dictIds }));
  await delType(dictIds);
  getTypeList();
  modal.msgSuccess(t('common.deleteSuccess'));
};

const handleTypeExport = () => {
  requestDownload(
    'system/dict/type/export',
    {
      ...typeQueryParams.value
    },
    `dict_${new Date().getTime()}.xlsx`
  );
};

const handleRefreshCache = async () => {
  await refreshCache();
  modal.msgSuccess(t('system.dict.refreshSuccess'));
  useDictStore().cleanDict();
};

const getDataList = async () => {
  if (!currentDict.value) {
    dataList.value = [];
    dataTotal.value = 0;
    dataLoading.value = false;
    return;
  }
  dataLoading.value = true;
  const res = await listData(dataQueryParams.value);
  dataList.value = res.data?.rows ?? [];
  dataTotal.value = res.data?.total;
  dataLoading.value = false;
};

const cancelData = () => {
  dataDialog.visible = false;
  resetDataForm();
};

const resetDataForm = () => {
  dataForm.value = { ...dataInitFormData };
  dataFormRef.value?.resetFields();
};

const handleDataQuery = () => {
  if (!currentDict.value) return;
  dataQueryParams.value.pageNum = 1;
  getDataList();
};

const handleDataResetQuery = () => {
  dataQueryFormRef.value?.resetFields();
  dataQueryParams.value.dictLabel = '';
  handleDataQuery();
};

const handleDataAdd = () => {
  if (!currentDict.value) {
    modal.msgWarning(t('system.dict.selectFirst'));
    return;
  }
  resetDataForm();
  dataForm.value.dictType = currentDict.value.dictType;
  dataDialog.visible = true;
  dataDialog.title = t('system.dict.addData');
};

const handleDataSelectionChange = (selection: DictDataVO[]) => {
  dataIds.value = selection.map(item => item.dictCode);
  dataSingle.value = selection.length != 1;
  dataMultiple.value = !selection.length;
};

const handleDataUpdate = async (row?: Partial<DictDataVO>) => {
  if (!currentDict.value) {
    modal.msgWarning(t('system.dict.selectFirst'));
    return;
  }
  resetDataForm();
  const dictCode = row?.dictCode || dataIds.value[0];
  const res = await getData(dictCode);
  Object.assign(dataForm.value, res.data);
  dataDialog.visible = true;
  dataDialog.title = t('system.dict.editData');
};

const submitDataForm = () => {
  dataFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      dataForm.value.dictCode ? await updateData(dataForm.value) : await addData(dataForm.value);
      useDictStore().removeDict(dataQueryParams.value.dictType);
      modal.msgSuccess(t('common.actionSuccess'));
      dataDialog.visible = false;
      await getDataList();
    }
  });
};

const handleDataDelete = async (row?: Partial<DictDataVO>) => {
  if (!currentDict.value) {
    modal.msgWarning(t('system.dict.selectFirst'));
    return;
  }
  const dictCodes = row?.dictCode || dataIds.value;
  await modal.confirm(t('system.dict.confirmDeleteData', { id: dictCodes }));
  await delData(dictCodes);
  await getDataList();
  modal.msgSuccess(t('common.deleteSuccess'));
  useDictStore().removeDict(dataQueryParams.value.dictType);
};

const handleDataExport = () => {
  if (!currentDict.value) {
    modal.msgWarning(t('system.dict.selectFirst'));
    return;
  }
  requestDownload(
    'system/dict/data/export',
    {
      ...dataQueryParams.value
    },
    `dict_data_${new Date().getTime()}.xlsx`
  );
};

onMounted(() => {
  getTypeList();
  scheduleMeasure();
  [60, 180, 360].forEach(delay => window.setTimeout(scheduleMeasure, delay));
  window.addEventListener('resize', scheduleMeasure);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', scheduleMeasure);
});

watch(
  [() => typeList.value?.length, () => dataList.value?.length, () => showTypeSearch.value, () => showDataSearch.value],
  () => nextTick(scheduleMeasure)
);
</script>

<style lang="scss" scoped>
.dict-grid {
  row-gap: 16px;
}

.dict-card {
  height: 100%;
}

.dict-card__header {
  gap: 12px;
}

.dict-title-toggle {
  padding: 0 !important;
}

.dict-title-toggle.is-collapsed::after {
  transform: rotate(45deg);
}

.dict-card__subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.dict-search {
  overflow: hidden;
  max-height: 240px;
  opacity: 1;
  margin-bottom: 12px;
  transition:
    max-height 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.24s ease,
    margin-bottom 0.24s ease;
}

.dict-search.is-collapsed {
  max-height: 0;
  opacity: 0;
  margin-bottom: 0;
  pointer-events: none;
}

.dict-search :deep(.el-form-item) {
  margin-bottom: 0;
}

.dict-actions {
  margin: 0 0 12px;
  padding-bottom: 0;
}

.dict-actions :deep(.el-button) {
  height: 32px;
  padding: 0 14px;
  border-radius: 10px !important;
}

.dict-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.dict-table-wrap {
  overflow-x: auto;
}
</style>

<style lang="scss" scoped>
.data-hero {
  position: relative;
  overflow: hidden;
  padding: 24px 28px;
  color: #fff;
  background: linear-gradient(148deg, #0f3d33 0%, #1c5a48 70%, #256a55 100%);
}
.data-hero::after {
  content: '';
  position: absolute;
  top: -130px;
  right: -90px;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
}
.data-hero__top {
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
.data-hero__brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.data-hero__brand img {
  width: 22px;
  height: 22px;
  border-radius: 6px;
}
.data-hero__divider {
  color: rgba(223, 241, 232, 0.5);
}
.data-hero__action {
  color: #c9e4d7;
}
.data-hero__profile {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 15px;
  margin-top: 22px;
}
.data-hero__icon {
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
.data-hero__name {
  margin-bottom: 7px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.data-hero__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #c9e4d7;
}
.data-hero__tag {
  padding: 4px 9px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  color: #eafff5;
  font-size: 11.5px;
  font-weight: 700;
}

.data-form :deep(.el-form-item) {
  margin-bottom: 16px;
}
.data-form :deep(.el-form-item__label) {
  padding-bottom: 6px;
  line-height: 1.3;
  font-size: 12.5px;
  font-weight: 600;
  color: #3f4a44;
}
.data-form :deep(.el-input__wrapper),
.data-form :deep(.el-select__wrapper),
.data-form :deep(.el-textarea__inner) {
  border-radius: 10px;
}
.data-form :deep(.el-form-item__content) {
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
/* 字典管理：卡片高度不超出视口，表格高度由脚本按剩余空间计算 */
/* 卡片高度由脚本按视口计算并写入 --dict-card-max，保证小屏也不溢出 */
.dict-page .dict-card {
  max-height: var(--dict-card-max, none);
}
</style>

<style lang="scss" scoped>
/* 分页固定高度，确保始终可见 */
.dict-page .pagination-container {
  flex: none;
  height: 36px;
  min-height: 36px;
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  overflow: visible;
}
</style>

<style lang="scss" scoped>
/* 字典管理：整页不滚动，分页始终可见（含小屏） */
.dict-page {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.dict-page .dict-grid {
  flex: 1;
  min-height: 0;
}
.dict-page .dict-grid > .el-col {
  min-height: 0;
}
.dict-page .dict-card {
  overflow: hidden;
}
.dict-page .dict-card :deep(.el-card__body) {
  overflow: hidden;
}
/* 小屏：两栏堆叠时每张卡片各占一半可用高度，仍保留分页 */
@media (max-width: 1199px) {
  .dict-page .dict-grid > .el-col {
    max-height: 50%;
    overflow: hidden;
  }
}
</style>
