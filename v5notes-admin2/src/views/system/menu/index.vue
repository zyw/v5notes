<template>
  <div class="p-2 app-container system-menu-page">
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
          <el-form-item label="菜单名称" prop="menuName">
            <el-input
              v-model="queryParams.menuName"
              placeholder="请输入菜单名称"
              clearable
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item label="状态" prop="status">
            <el-select v-model="queryParams.status" placeholder="菜单状态" clearable>
              <el-option v-for="dict in sys_normal_disable" :key="dict.value" :label="dict.label" :value="dict.value" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetQuery">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>

    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="panel-kicker">Menu Dataset</span>
            <h3>菜单列表</h3>
            <p>支持树形加载、图标选择、级联删除和目录/菜单/按钮三级维护。</p>
          </div>
          <div class="toolbar-actions">
            <el-button v-hasPermi="['system:menu:add']" type="primary" plain icon="Plus" @click="handleAdd()">
              新增
            </el-button>
            <el-button
              v-hasPermi="['system:menu:remove']"
              type="danger"
              plain
              icon="Delete"
              @click="handleCascadeDelete"
              :loading="deleteLoading"
            >
              级联删除
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
        <el-table-column prop="menuName" label="菜单名称" :show-overflow-tooltip="true" width="220">
          <template #default="scope">
            <div class="menu-name-cell">
              <svg-icon v-if="isMenuIconVisible(scope.row.icon)" :icon-class="scope.row.icon" />
              <span class="menu-name-text">{{ scope.row.menuName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100" align="center">
          <template #default="scope">
            <el-tag :type="getMenuTypeMeta(scope.row).type" size="small">
              {{ getMenuTypeMeta(scope.row).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="orderNum" label="排序" width="60"></el-table-column>
        <el-table-column prop="perms" label="权限标识" :show-overflow-tooltip="true"></el-table-column>
        <el-table-column prop="component" label="组件路径" :show-overflow-tooltip="true"></el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="scope">
            <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
          </template>
        </el-table-column>
        <el-table-column fixed="right" label="操作" width="180">
          <template #default="scope">
            <el-tooltip content="修改" placement="top">
              <el-button
                v-hasPermi="['system:menu:edit']"
                link
                type="primary"
                icon="Edit"
                @click="handleUpdate(scope.row)"
              />
            </el-tooltip>
            <el-tooltip content="新增" placement="top">
              <el-button
                v-hasPermi="['system:menu:add']"
                link
                type="primary"
                icon="Plus"
                @click="handleAdd(scope.row)"
              />
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
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
          <div v-else class="empty-hint">暂无数据</div>
        </template>
      </el-table>
    </el-card>

    <FormDrawer
      v-model="dialog.visible"
      :title="dialog.title"
      eyebrow="菜单配置"
      subtitle="配置目录 / 菜单 / 按钮的类型、路由、权限与显示状态"
      size="680px"
      submit-text="确定"
      hint="带 * 为必填项，保存后立即生效"
      @submit="submitForm"
      @closed="cancel"
    >
      <template #hero>
        <div class="menu-hero">
          <div class="menu-hero__top">
            <span class="menu-hero__brand"><img :src="logoUrl" alt="" />V5Notes 菜单</span>
            <span class="menu-hero__divider">·</span>
            <span class="menu-hero__action">{{ dialog.title }}</span>
          </div>
          <div class="menu-hero__profile">
            <div class="menu-hero__icon">
              <svg-icon v-if="isMenuIconVisible(form.icon)" :icon-class="form.icon" />
              <span v-else>菜</span>
            </div>
            <div class="menu-hero__info">
              <div class="menu-hero__name">{{ form.menuName || '未命名菜单' }}</div>
              <div class="menu-hero__meta">
                <span class="menu-hero__tag">{{ menuTypeLabel }}</span>
                <span v-if="form.path">{{ form.path }}</span>
                <span v-else>未设置路由</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <el-form ref="menuFormRef" :model="form" :rules="rules" label-position="top" class="menu-form">
        <section class="form-section">
          <h4>基本信息</h4>
          <el-row :gutter="18">
            <el-col :span="24">
              <el-form-item label="上级菜单">
                <el-tree-select
                  v-model="form.parentId"
                  :data="menuOptions"
                  :props="{ value: 'menuId', label: 'menuName', children: 'children' } as any"
                  value-key="menuId"
                  placeholder="选择上级菜单"
                  check-strictly
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="菜单类型" prop="menuType">
                <el-radio-group v-model="form.menuType">
                  <el-radio value="M">目录</el-radio>
                  <el-radio value="C">菜单</el-radio>
                  <el-radio value="F">按钮</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col v-if="form.menuType !== 'F'" :span="12">
              <el-form-item label="菜单图标" prop="icon">
                <icon-select v-model="form.icon" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="菜单名称" prop="menuName">
                <el-input v-model="form.menuName" placeholder="请输入菜单名称" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="显示排序" prop="orderNum">
                <el-input-number v-model="form.orderNum" controls-position="right" :min="0" />
              </el-form-item>
            </el-col>
          </el-row>
        </section>

        <section class="form-section">
          <h4>路由与权限</h4>
          <el-row :gutter="18">
            <el-col v-if="form.menuType !== 'F'" :span="12">
              <el-form-item>
                <template #label>
                <span>
                  <el-tooltip content="选择「是」外链则路由地址需以 http(s):// 开头" placement="top">
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  是否外链
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
                  <el-tooltip content="访问的路由地址，如 user；外网地址需内链访问时以 http(s):// 开头" placement="top">
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  路由地址
                </span>
              </template>
                <el-input v-model="form.path" placeholder="请输入路由地址" />
              </el-form-item>
            </el-col>
            <el-col v-if="form.menuType === 'C'" :span="12">
              <el-form-item prop="component">
                <template #label>
                <span>
                  <el-tooltip content="访问的组件路径，如 system/user/index，默认在 views 目录下" placement="top">
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  组件路径
                </span>
              </template>
                <el-input v-model="form.component" placeholder="请输入组件路径" />
              </el-form-item>
            </el-col>
            <el-col v-if="form.menuType !== 'M'" :span="12">
              <el-form-item>
                <template #label>
                <span>
                  <el-tooltip content="控制器中定义的权限字符，如 @SaCheckPermission('system:user:list')" placement="top">
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  权限字符
                </span>
              </template>
                <el-input v-model="form.perms" placeholder="请输入权限标识" maxlength="100" />
              </el-form-item>
            </el-col>
            <el-col v-if="form.menuType === 'C'" :span="12">
              <el-form-item>
                <template #label>
                <span>
                  <el-tooltip content="访问路由的默认传递参数，例如 id=1、name=ry" placement="top">
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  路由参数
                </span>
              </template>
                <el-input v-model="form.queryParam" placeholder="请输入路由参数" maxlength="255" />
              </el-form-item>
            </el-col>
            <el-col v-if="form.menuType === 'C'" :span="12">
              <el-form-item>
                <template #label>
                <span>
                  <el-tooltip content="选择是则会被 keep-alive 缓存，需要匹配组件的 name 和地址保持一致" placement="top">
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  是否缓存
                </span>
              </template>
                <el-radio-group v-model="form.isCache">
                  <el-radio value="Y">缓存</el-radio>
                  <el-radio value="N">不缓存</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
          </el-row>
        </section>

        <section class="form-section">
          <h4>显示与状态</h4>
          <el-row :gutter="18">
            <el-col v-if="form.menuType !== 'F'" :span="12">
              <el-form-item>
                <template #label>
                <span>
                  <el-tooltip content="选择隐藏则路由将不会出现在侧边栏，但仍然可以访问" placement="top">
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  显示状态
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
                  <el-tooltip content="选择停用则路由将不会出现在侧边栏，也不能被访问" placement="top">
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  菜单状态
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
                  <el-tooltip content="隐藏菜单填写默认激活路由，比如激活父菜单的路由 /system/user" placement="top">
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  激活路由
                </span>
              </template>
                <el-input v-model="form.activeMenu" placeholder="请输入激活路径" />
              </el-form-item>
            </el-col>
          </el-row>
        </section>

        <section class="form-section">
          <h4>备注</h4>
          <el-form-item label="备注" prop="remark">
            <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="请输入备注" maxlength="500" />
          </el-form-item>
        </section>
      </el-form>
    </FormDrawer>

    <el-dialog v-model="deleteDialog.visible" :title="deleteDialog.title" destroy-on-close append-to-bod width="750px" class="app-dialog">
      <template #header>
        <div class="app-dialog-hero">
          <div class="app-dialog-hero__top">
            <img src="@/assets/logo/logo.png" alt="" />
            <span>V5Notes 菜单</span>
          </div>
          <div class="app-dialog-hero__main">
            <div class="app-dialog-hero__icon">删</div>
            <div>
              <div class="app-dialog-hero__name">{{ deleteDialog.title }}</div>
              <div class="app-dialog-hero__meta"><span>勾选要级联删除的菜单节点</span></div>
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
        empty-text="加载中，请稍候"
        :default-expanded-keys="[0]"
        :props="{ value: 'menuId', label: 'menuName', children: 'children' } as any"
      />
      <template #footer>
        <div class="dialog-footer">
          <submit-button type="primary" @click="submitDeleteForm" :loading="deleteLoading">确 定</submit-button>
          <el-button @click="cancelCascade">取 消</el-button>
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
  rules: {
    menuName: [{ required: true, message: '菜单名称不能为空', trigger: 'blur' }],
    orderNum: [{ required: true, message: '菜单顺序不能为空', trigger: 'blur' }],
    path: [{ required: true, message: '路由地址不能为空', trigger: 'blur' }]
  }
});

const menuTableRef = ref<ElTableInstance>();

const { queryParams, form, rules } = toRefs<PageData<MenuForm, MenuQuery>>(data);
const { dialog, openDialog, closeDialog, setTitle } = useDialogState();

const menuTypeLabel = computed(() => {
  if (form.value.menuType === MenuTypeEnum.M) return '目录';
  if (form.value.menuType === MenuTypeEnum.C) return '菜单';
  return '按钮';
});

type MenuTagType = 'warning' | 'primary' | 'success' | 'danger';

const isMenuIconVisible = (icon?: string) => {
  const normalizedIcon = icon?.trim();
  return !!normalizedIcon && normalizedIcon !== '#';
};

const getMenuTypeMeta = (menu: Partial<MenuVO>): { label: string; type: MenuTagType } => {
  if (menu.menuType === MenuTypeEnum.F) {
    return { label: '按钮', type: 'warning' };
  }
  if (menu.isFrame === 'Y') {
    return { label: '外链', type: 'danger' };
  }
  if (menu.menuType === MenuTypeEnum.M) {
    return { label: '目录', type: 'primary' };
  }
  return { label: '菜单', type: 'success' };
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
  const menu: MenuOptionsType = { menuId: 0, menuName: '主类目', children: [] };
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
  setTitle('添加菜单');
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
  setTitle('修改菜单');
  openDialog();
};
/** 提交按钮 */
const submitForm = () => {
  menuFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      form.value.menuId ? await updateMenu(form.value) : await addMenu(form.value);
      modal.msgSuccess('操作成功');
      closeDialog();
      await getList();
    }
  });
};
/** 删除按钮操作 */
const handleDelete = async (row: Partial<MenuVO>) => {
  await modal.confirm('是否确认删除名称为"' + row.menuName + '"的数据项?');
  await delMenu(row.menuId);
  await getList();
  modal.msgSuccess('删除成功');
};

const deleteLoading = ref<boolean>(false);
const menuTreeRef = ref<ElTreeInstance>();

const {
  dialog: deleteDialog,
  openDialog: openDeleteDialog,
  closeDialog: closeDeleteDialog
} = useDialogState('级联删除菜单');

/** 级联删除按钮操作 */
const handleCascadeDelete = () => {
  menuTreeRef.value?.setCheckedKeys([]);
  getTreeselect();
  openDeleteDialog();
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
    modal.msgWarning('请选择要删除的菜单');
    return;
  }

  deleteLoading.value = true;
  await cascadeDelMenu(menuIds).finally(() => (deleteLoading.value = false));
  await getList();
  modal.msgSuccess('删除成功');
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
