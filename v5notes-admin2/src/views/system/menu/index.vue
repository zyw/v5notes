<template>
  <div class="p-2 app-container system-menu-page">
    <div class="search-wrap">
      <el-card shadow="hover" class="search-panel" :class="{ 'is-collapsed': !showSearch }">
        <template #header>
          <div class="panel-heading search-panel-toggle" @click.stop="showSearch = !showSearch">
            <div>
              <span class="panel-kicker">{{ $t('system.menu.searchKicker') }}</span>
              <h3>{{ $t('common.filter') }}</h3>
            </div>
          </div>
        </template>
        <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="query-form">
          <el-form-item :label="$t('system.menu.menuName')" prop="menuName">
            <el-input
              v-model="queryParams.menuName"
              :placeholder="$t('common.pleaseInput', { label: $t('system.menu.menuName') })"
              clearable
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item :label="$t('common.status')" prop="status">
            <el-select v-model="queryParams.status" :placeholder="$t('system.menu.menuStatus')" clearable>
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
            <span class="panel-kicker">{{ $t('system.menu.datasetKicker') }}</span>
            <h3>{{ $t('system.menu.listTitle') }}</h3>
            <p>{{ $t('system.menu.listDesc') }}</p>
          </div>
          <div class="toolbar-actions">
            <el-button v-hasPermi="['system:menu:add']" type="primary" plain icon="Plus" @click="handleAdd()">
              {{ $t('common.add') }}
            </el-button>
            <el-button
              v-hasPermi="['system:menu:remove']"
              type="danger"
              plain
              icon="Delete"
              @click="handleCascadeDelete"
              :loading="deleteLoading"
            >
              {{ $t('system.menu.cascadeDelete') }}
            </el-button>
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="getList"></right-toolbar>
          </div>
        </div>
      </template>

      <el-table
        ref="menuTableRef"
        v-loading="loading && (menuList).length > 0"
        class="data-table"
        :data="menuList"
        row-key="menuId"
        border
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        :default-expand-all="false"
        lazy
        :load="getChildrenList"
        :expand-change="expandMenuHandle"
      >
        <el-table-column prop="menuName" :label="$t('system.menu.menuName')" :show-overflow-tooltip="true" width="220">
          <template #default="scope">
            <div class="menu-name-cell">
              <svg-icon v-if="isMenuIconVisible(scope.row.icon)" :icon-class="scope.row.icon" />
              <span class="menu-name-text">{{ scope.row.menuName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="$t('system.menu.type')" width="100" align="center">
          <template #default="scope">
            <el-tag :type="getMenuTypeMeta(scope.row).type" size="small">
              {{ getMenuTypeMeta(scope.row).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="orderNum" :label="$t('system.menu.order')" width="60"></el-table-column>
        <el-table-column prop="perms" :label="$t('system.menu.perms')" :show-overflow-tooltip="true"></el-table-column>
        <el-table-column prop="component" :label="$t('system.menu.component')" :show-overflow-tooltip="true"></el-table-column>
        <el-table-column prop="status" :label="$t('common.status')" width="80">
          <template #default="scope">
            <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
          </template>
        </el-table-column>
        <el-table-column fixed="right" :label="$t('common.operate')" width="180">
          <template #default="scope">
            <el-tooltip :content="$t('common.edit')" placement="top">
              <el-button
                v-hasPermi="['system:menu:edit']"
                link
                type="primary"
                icon="Edit"
                @click="handleUpdate(scope.row)"
              />
            </el-tooltip>
            <el-tooltip :content="$t('common.add')" placement="top">
              <el-button
                v-hasPermi="['system:menu:add']"
                link
                type="primary"
                icon="Plus"
                @click="handleAdd(scope.row)"
              />
            </el-tooltip>
            <el-tooltip :content="$t('common.delete')" placement="top">
              <el-button
                v-hasPermi="['system:menu:remove']"
                link
                type="primary"
                icon="Delete"
                @click="handleDelete(scope.row)"
              />
            </el-tooltip>
          </template>
        </el-table-column>
        <template #empty>
          <table-skeleton v-if="loading" :rows="8" />
          <div v-else class="empty-hint">{{ $t('common.noData') }}</div>
        </template>
      </el-table>
    </el-card>

    <FormDrawer
      v-model="dialog.visible"
      :title="dialog.title"
      :eyebrow="$t('system.menu.eyebrow')"
      :subtitle="$t('system.menu.subtitle')"
      size="680px"
      :submit-text="$t('common.confirm')"
      :hint="$t('system.menu.requiredHint')"
      @submit="submitForm"
      @closed="cancel"
    >
      <template #hero>
        <div class="menu-hero">
          <div class="menu-hero__top">
            <span class="menu-hero__brand"><img :src="logoUrl" alt="" />{{ $t('system.menu.brand') }}</span>
            <span class="menu-hero__divider">·</span>
            <span class="menu-hero__action">{{ dialog.title }}</span>
          </div>
          <div class="menu-hero__profile">
            <div class="menu-hero__icon">
              <svg-icon v-if="isMenuIconVisible(form.icon)" :icon-class="form.icon" />
              <span v-else>{{ $t('system.menu.initial') }}</span>
            </div>
            <div class="menu-hero__info">
              <div class="menu-hero__name">{{ form.menuName || $t('system.menu.unnamed') }}</div>
              <div class="menu-hero__meta">
                <span class="menu-hero__tag">{{ menuTypeLabel }}</span>
                <span v-if="form.path">{{ form.path }}</span>
                <span v-else>{{ $t('system.menu.noPath') }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <el-form ref="menuFormRef" :model="form" :rules="rules" label-position="top" class="menu-form">
        <section class="form-section">
          <h4>{{ $t('common.basicInfo') }}</h4>
          <el-row :gutter="18">
            <el-col :span="24">
              <el-form-item :label="$t('system.menu.parent')">
                <el-tree-select
                  v-model="form.parentId"
                  :data="menuOptions"
                  :props="{ value: 'menuId', label: 'menuName', children: 'children' } as any"
                  value-key="menuId"
                  :placeholder="$t('system.menu.selectParent')"
                  check-strictly
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('system.menu.menuType')" prop="menuType">
                <el-radio-group v-model="form.menuType">
                  <el-radio value="M">{{ $t('system.menu.directory') }}</el-radio>
                  <el-radio value="C">{{ $t('system.menu.menu') }}</el-radio>
                  <el-radio value="F">{{ $t('system.menu.button') }}</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col v-if="form.menuType !== 'F'" :span="12">
              <el-form-item :label="$t('system.menu.icon')" prop="icon">
                <icon-select v-model="form.icon" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('system.menu.menuName')" prop="menuName">
                <el-input v-model="form.menuName" :placeholder="$t('common.pleaseInput', { label: $t('system.menu.menuName') })" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('system.menu.displaySort')" prop="orderNum">
                <el-input-number v-model="form.orderNum" controls-position="right" :min="0" />
              </el-form-item>
            </el-col>
          </el-row>
        </section>

        <section class="form-section">
          <h4>{{ $t('system.menu.routeSection') }}</h4>
          <el-row :gutter="18">
            <el-col v-if="form.menuType !== 'F'" :span="12">
              <el-form-item>
                <template #label>
                <span>
                  <el-tooltip :content="$t('system.menu.frameTip')" placement="top">
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  {{ $t('system.menu.frame') }}
                </span>
              </template>
                <el-radio-group v-model="form.isFrame">
                  <el-radio v-for="dict in sys_yes_no" :key="dict.value" :value="dict.value">{{ dict.label }}</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col v-if="form.menuType !== 'F'" :span="12">
              <el-form-item prop="path">
                <template #label>
                <span>
                  <el-tooltip :content="$t('system.menu.pathTip')" placement="top">
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  {{ $t('system.menu.path') }}
                </span>
              </template>
                <el-input v-model="form.path" :placeholder="$t('common.pleaseInput', { label: $t('system.menu.path') })" />
              </el-form-item>
            </el-col>
            <el-col v-if="form.menuType === 'C'" :span="12">
              <el-form-item prop="component">
                <template #label>
                <span>
                  <el-tooltip :content="$t('system.menu.componentTip')" placement="top">
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  {{ $t('system.menu.component') }}
                </span>
              </template>
                <el-input v-model="form.component" :placeholder="$t('common.pleaseInput', { label: $t('system.menu.component') })" />
              </el-form-item>
            </el-col>
            <el-col v-if="form.menuType !== 'M'" :span="12">
              <el-form-item>
                <template #label>
                <span>
                  <el-tooltip :content="$t('system.menu.permKeyTip')" placement="top">
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  {{ $t('system.menu.permKey') }}
                </span>
              </template>
                <el-input v-model="form.perms" :placeholder="$t('common.pleaseInput', { label: $t('system.menu.perms') })" maxlength="100" />
              </el-form-item>
            </el-col>
            <el-col v-if="form.menuType === 'C'" :span="12">
              <el-form-item>
                <template #label>
                <span>
                  <el-tooltip :content="$t('system.menu.queryTip')" placement="top">
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  {{ $t('system.menu.query') }}
                </span>
              </template>
                <el-input v-model="form.queryParam" :placeholder="$t('common.pleaseInput', { label: $t('system.menu.query') })" maxlength="255" />
              </el-form-item>
            </el-col>
            <el-col v-if="form.menuType === 'C'" :span="12">
              <el-form-item>
                <template #label>
                <span>
                  <el-tooltip :content="$t('system.menu.cacheTip')" placement="top">
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  {{ $t('system.menu.cache') }}
                </span>
              </template>
                <el-radio-group v-model="form.isCache">
                  <el-radio value="Y">{{ $t('system.menu.cacheOn') }}</el-radio>
                  <el-radio value="N">{{ $t('system.menu.cacheOff') }}</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
          </el-row>
        </section>

        <section class="form-section">
          <h4>{{ $t('system.menu.displaySection') }}</h4>
          <el-row :gutter="18">
            <el-col v-if="form.menuType !== 'F'" :span="12">
              <el-form-item>
                <template #label>
                <span>
                  <el-tooltip :content="$t('system.menu.visibleTip')" placement="top">
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  {{ $t('system.menu.visible') }}
                </span>
              </template>
                <el-radio-group v-model="form.visible">
                  <el-radio v-for="dict in sys_show_hide" :key="dict.value" :value="dict.value">{{ dict.label }}</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item>
                <template #label>
                <span>
                  <el-tooltip :content="$t('system.menu.statusTip')" placement="top">
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  {{ $t('system.menu.menuStatus') }}
                </span>
              </template>
                <el-radio-group v-model="form.status">
                  <el-radio v-for="dict in sys_normal_disable" :key="dict.value" :value="dict.value">{{ dict.label }}</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col v-if="form.visible !== '0'" :span="12">
              <el-form-item prop="activeMenu">
                <template #label>
                <span>
                  <el-tooltip :content="$t('system.menu.activeMenuTip')" placement="top">
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  {{ $t('system.menu.activeMenu') }}
                </span>
              </template>
                <el-input v-model="form.activeMenu" :placeholder="$t('common.pleaseInput', { label: $t('system.menu.activePath') })" />
              </el-form-item>
            </el-col>
          </el-row>
        </section>

        <section class="form-section">
          <h4>{{ $t('common.remark') }}</h4>
          <el-form-item :label="$t('common.remark')" prop="remark">
            <el-input v-model="form.remark" type="textarea" :rows="2" :placeholder="$t('common.pleaseInput', { label: $t('common.remark') })" maxlength="500" />
          </el-form-item>
        </section>
      </el-form>
    </FormDrawer>

    <el-dialog v-model="deleteDialog.visible" :title="deleteDialog.title" destroy-on-close append-to-bod width="750px" class="app-dialog">
      <template #header>
        <div class="app-dialog-hero">
          <div class="app-dialog-hero__top">
            <img src="@/assets/logo/logo.png" alt="" />
            <span>{{ $t('system.menu.brand') }}</span>
          </div>
          <div class="app-dialog-hero__main">
            <div class="app-dialog-hero__icon">{{ $t('system.menu.deleteInitial') }}</div>
            <div>
              <div class="app-dialog-hero__name">{{ deleteDialog.title }}</div>
              <div class="app-dialog-hero__meta"><span>{{ $t('system.menu.cascadeHint') }}</span></div>
            </div>
          </div>
        </div>
      </template>

      <el-tree
        ref="menuTreeRef"
        class="tree-border"
        :data="menuOptions"
        show-checkbox
        node-key="menuId"
        :check-strictly="false"
        :empty-text="$t('system.menu.loading')"
        :default-expanded-keys="[0]"
        :props="{ value: 'menuId', label: 'menuName', children: 'children' } as any"
      />
      <template #footer>
        <div class="dialog-footer">
          <submit-button type="primary" @click="submitDeleteForm" :loading="deleteLoading">{{ $t('common.confirm') }}</submit-button>
          <el-button @click="cancelCascade">{{ $t('common.cancel') }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="Menu" lang="ts">
import SubmitButton from '@/components/Loading/SubmitButton.vue';
import TableSkeleton from '@/components/Skeleton/TableSkeleton.vue';
import { addMenu, cascadeDelMenu, delMenu, getMenu, listMenu, updateMenu } from '@/api/system/menu';
import { MenuForm, MenuQuery, MenuVO } from '@/api/system/menu/types';
import { MenuTypeEnum } from '@/enums/MenuTypeEnum';
import { useLoading } from '@/hooks/async/useLoading';
import { useDialogState } from '@/hooks/dialog/useDialogState';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import modal from '@/plugins/modal';
import { useDict } from '@/utils/dict';
import { handleTree } from '@/utils/ruoyi';
import FormDrawer from '@/components/FormDrawer/index.vue';
import logoUrl from '@/assets/logo/logo.png';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

interface MenuOptionsType {
  menuId: number;
  menuName: string;
  children: MenuOptionsType[] | undefined;
}

const { sys_show_hide, sys_normal_disable, sys_yes_no } = toRefs<any>(
  useDict('sys_show_hide', 'sys_normal_disable', 'sys_yes_no')
);

const menuList = ref<MenuVO[]>([]);
const menuChildrenListMap = ref({});
const menuExpandMap = ref({});
const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();
const menuOptions = ref<MenuOptionsType[]>([]);

const queryFormRef = ref<ElFormInstance>();
const menuFormRef = ref<ElFormInstance>();
const initFormData = {
  path: '',
  menuId: undefined,
  parentId: 0,
  menuName: '',
  icon: '',
  menuType: MenuTypeEnum.M,
  orderNum: 1,
  isFrame: 'N',
  isCache: 'Y',
  visible: '0',
  status: '0',
  activeMenu: '',
  remark: ''
};
const data = reactive<PageData<MenuForm, MenuQuery>>({
  form: { ...initFormData },
  queryParams: {
    menuName: undefined,
    status: undefined
  },
  rules: {}
});

const menuTableRef = ref<ElTableInstance>();

const { queryParams, form } = toRefs<PageData<MenuForm, MenuQuery>>(data);
const rules = computed<ElFormRules>(() => ({
  menuName: [{ required: true, message: t('system.menu.required', { label: t('system.menu.menuName') }), trigger: 'blur' }],
  orderNum: [{ required: true, message: t('system.menu.orderRequired'), trigger: 'blur' }],
  path: [{ required: true, message: t('system.menu.required', { label: t('system.menu.path') }), trigger: 'blur' }]
}));
const { dialog, openDialog, closeDialog, setTitle } = useDialogState();

const menuTypeLabel = computed(() => {
  if (form.value.menuType === MenuTypeEnum.M) return t('system.menu.directory');
  if (form.value.menuType === MenuTypeEnum.C) return t('system.menu.menu');
  return t('system.menu.button');
});

type MenuTagType = 'warning' | 'primary' | 'success' | 'danger';

const isMenuIconVisible = (icon?: string) => {
  const normalizedIcon = icon?.trim();
  return !!normalizedIcon && normalizedIcon !== '#';
};

const getMenuTypeMeta = (menu: Partial<MenuVO>): { label: string; type: MenuTagType } => {
  if (menu.menuType === MenuTypeEnum.F) {
    return { label: t('system.menu.button'), type: 'warning' };
  }
  if (menu.isFrame === 'Y') {
    return { label: t('system.menu.link'), type: 'danger' };
  }
  if (menu.menuType === MenuTypeEnum.M) {
    return { label: t('system.menu.directory'), type: 'primary' };
  }
  return { label: t('system.menu.menu'), type: 'success' };
};

/** 获取子菜单列表 */
const getChildrenList = async (row: any, treeNode: unknown, resolve: (data: any[]) => void) => {
  menuExpandMap.value[row.menuId] = { row, treeNode, resolve };
  const children = menuChildrenListMap.value[row.menuId] || [];
  // 菜单的子菜单清空后关闭展开
  if (children.length == 0) {
    // fix: 处理当菜单只有一个子菜单并被删除，需要将父菜单的展开状态关闭
    menuTableRef.value?.updateKeyChildren(row.menuId, children);
  }
  resolve(children);
};

/** 收起菜单时从menuExpandMap中删除对应菜单id数据 */
const expandMenuHandle = async (row: any, expanded: boolean) => {
  if (!expanded) {
    menuExpandMap.value[row.menuId] = undefined;
  }
};

/** 刷新展开的菜单数据 */
const refreshLoadTree = (parentId: string | number) => {
  if (menuExpandMap.value[parentId]) {
    const { row, treeNode, resolve } = menuExpandMap.value[parentId];
    if (row) {
      getChildrenList(row, treeNode, resolve);
      if (row.parentId) {
        const grandpaMenu = menuExpandMap.value[row.parentId];
        getChildrenList(grandpaMenu.row, grandpaMenu.treeNode, grandpaMenu.resolve);
      }
    }
  }
};

/** 重新加载所有已展开的菜单的数据 */
const refreshAllExpandMenuData = () => {
  for (const menuId in menuExpandMap.value) {
    refreshLoadTree(menuId);
  }
};

/** 查询菜单列表 */
const getList = async () => {
  await withLoading(async () => {
    const res = await listMenu(queryParams.value);

    const tempMap = {};
    // 存储 父菜单:子菜单列表
    for (const menu of res.data) {
      const parentId = menu.parentId;
      if (!tempMap[parentId]) {
        tempMap[parentId] = [];
      }
      tempMap[parentId].push(menu);
    }
    // 创建一个当前所有 menuId 的 Set，用于查找父菜单是否存在于当前数据中
    const menuIdSet = new Set();
    // 设置有没有子菜单
    for (const menu of res.data) {
      menu['hasChildren'] = tempMap[menu.menuId]?.length > 0;
      menuIdSet.add(menu.menuId);
    }
    menuChildrenListMap.value = tempMap;
    // 找出所有父ID不在当前菜单ID集合中的菜单项，作为新的顶层菜单
    menuList.value = res.data.filter(menu => !menuIdSet.has(menu.parentId));
    // 根据新数据重新加载子菜单数据
    refreshAllExpandMenuData();
  });
};
/** 查询菜单下拉树结构 */
const getTreeselect = async () => {
  menuOptions.value = [];
  const response = await listMenu();
  const menu: MenuOptionsType = { menuId: 0, menuName: t('system.menu.root'), children: [] };
  menu.children = handleTree<MenuOptionsType>(response.data, 'menuId');
  menuOptions.value.push(menu);
};
/** 取消按钮 */
const cancel = () => {
  reset();
  closeDialog();
};
/** 表单重置 */
const reset = () => {
  form.value = { ...initFormData };
  menuFormRef.value?.resetFields();
};

/** 搜索按钮操作 */
const handleQuery = () => {
  getList();
};
const { resetQuery } = useSearchReset({
  queryFormRef,
  queryParams,
  afterReset: () => {
    handleQuery();
  }
});
/** 新增按钮操作 */
const handleAdd = (row?: Partial<MenuVO>) => {
  reset();
  getTreeselect();
  row && row.menuId ? (form.value.parentId = row.menuId) : (form.value.parentId = 0);
  setTitle(t('system.menu.addTitle'));
  openDialog();
};
/** 修改按钮操作 */
const handleUpdate = async (row: Partial<MenuVO>) => {
  reset();
  await getTreeselect();
  if (row.menuId) {
    const { data } = await getMenu(row.menuId);
    form.value = data;
  }
  setTitle(t('system.menu.editTitle'));
  openDialog();
};
/** 提交按钮 */
const submitForm = () => {
  menuFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      form.value.menuId ? await updateMenu(form.value) : await addMenu(form.value);
      modal.msgSuccess(t('common.actionSuccess'));
      closeDialog();
      await getList();
    }
  });
};
/** 删除按钮操作 */
const handleDelete = async (row: Partial<MenuVO>) => {
  await modal.confirm(t('system.menu.confirmDelete', { name: row.menuName }));
  await delMenu(row.menuId);
  await getList();
  modal.msgSuccess(t('common.deleteSuccess'));
};

const deleteLoading = ref<boolean>(false);
const menuTreeRef = ref<ElTreeInstance>();

const {
  dialog: deleteDialog,
  openDialog: openDeleteDialog,
  closeDialog: closeDeleteDialog
} = useDialogState();

/** 级联删除按钮操作 */
const handleCascadeDelete = () => {
  menuTreeRef.value?.setCheckedKeys([]);
  getTreeselect();
  openDeleteDialog(t('system.menu.cascadeTitle'));
};

/** 取消按钮 */
const cancelCascade = () => {
  menuTreeRef.value?.setCheckedKeys([]);
  closeDeleteDialog();
};

/** 删除提交按钮 */
const submitDeleteForm = async () => {
  const menuIds = menuTreeRef.value?.getCheckedKeys();
  if (menuIds.length < 0) {
    modal.msgWarning(t('system.menu.selectDelete'));
    return;
  }

  deleteLoading.value = true;
  await cascadeDelMenu(menuIds).finally(() => (deleteLoading.value = false));
  await getList();
  modal.msgSuccess(t('common.deleteSuccess'));
  closeDeleteDialog();
};

onMounted(() => {
  getList();
});
</script>

<style lang="scss" scoped>
@use '@/assets/styles/components/page-shell' as pageShell;

@include pageShell.table-crud-page;

.data-table {
  .menu-name-cell {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .menu-name-text {
    min-width: 0;
  }
}
</style>

<style scoped lang="scss">
.tree-border {
  height: 300px;
  overflow: auto;
}
</style>

<style lang="scss" scoped>
.menu-form :deep(.el-form-item) {
  margin-bottom: 16px;
}
.menu-form :deep(.el-form-item__label) {
  padding-bottom: 6px;
  line-height: 1.3;
  font-size: 12.5px;
  font-weight: 600;
  color: #3f4a44;
}
.menu-form :deep(.el-input__wrapper),
.menu-form :deep(.el-select__wrapper),
.menu-form :deep(.el-textarea__inner) {
  border-radius: 10px;
}
.menu-form :deep(.el-form-item__content) {
  min-width: 0;
}
.menu-form :deep(.icon-select) {
  width: 100%;
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
.menu-hero {
  position: relative;
  overflow: hidden;
  padding: 24px 28px 24px;
  color: #fff;
  background: linear-gradient(148deg, #0f3d33 0%, #1c5a48 70%, #256a55 100%);
}
.menu-hero::after {
  content: '';
  position: absolute;
  top: -130px;
  right: -90px;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
}
.menu-hero__top {
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
.menu-hero__brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.menu-hero__brand img {
  width: 22px;
  height: 22px;
  border-radius: 6px;
}
.menu-hero__divider {
  color: rgba(223, 241, 232, 0.5);
}
.menu-hero__action {
  color: #c9e4d7;
}
.menu-hero__profile {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 15px;
  margin-top: 22px;
}
.menu-hero__icon {
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
.menu-hero__icon :deep(.svg-icon) {
  width: 26px;
  height: 26px;
  color: #fff;
  fill: currentColor;
}
.menu-hero__name {
  margin-bottom: 7px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.menu-hero__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #c9e4d7;
}
.menu-hero__tag {
  padding: 4px 9px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  color: #eafff5;
  font-size: 11.5px;
  font-weight: 700;
}
</style>
