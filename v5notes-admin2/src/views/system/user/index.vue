<template>
  <div class="p-2 system-user-page user-page">
    <header class="page-head">
      <div class="page-head__text">
        <div class="eyebrow">成员与权限</div>
        <h1 class="page-title">成员管理</h1>
        <p class="page-sub">统一管理工作空间成员、角色与访问范围，共 <b>{{ total }}</b> 位成员。</p>
      </div>
      <div class="page-head__actions">
        <el-button v-if="checkPermi(['system:user:import'])" plain icon="Upload" @click="handleImport">批量导入</el-button>
        <el-button v-has-permi="['system:user:add']" type="primary" icon="Plus" @click="handleAdd()">新增成员</el-button>
      </div>
    </header>

    <section class="stat-grid">
      <div class="stat-card">
        <div class="stat-card__top"><i class="sdot mint"></i><span>全部成员</span></div>
        <div class="stat-card__value">{{ total }}<em>位</em></div>
        <div class="stat-card__hint">当前筛选结果总数</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__top"><i class="sdot mint"></i><span>已启用</span></div>
        <div class="stat-card__value">{{ statEnabled }}<em>位</em></div>
        <div class="stat-card__hint">本页启用</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__top"><i class="sdot grey"></i><span>已停用</span></div>
        <div class="stat-card__value">{{ statDisabled }}<em>位</em></div>
        <div class="stat-card__hint">本页停用</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__top"><i class="sdot amber"></i><span>已选中</span></div>
        <div class="stat-card__value">{{ statSelected }}<em>项</em></div>
        <div class="stat-card__hint">勾选待操作</div>
      </div>
    </section>

    <div class="filter-bar" v-show="showSearch">
      <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="filter-form">
        <el-form-item label="关键字" prop="keyword">
          <el-input
            v-model="queryParams.keyword"
            placeholder="用户名称 / 昵称，模糊搜索"
            clearable
            style="width: 240px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item label="手机号码" prop="phoneNumber">
          <el-input v-model="queryParams.phoneNumber" placeholder="请输入手机号码" clearable @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="queryParams.status" placeholder="用户状态" clearable style="width: 130px !important">
            <el-option v-for="dict in sys_normal_disable" :key="dict.value" :label="dict.label" :value="dict.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="创建时间">
          <el-date-picker
            v-model="dateRange"
            value-format="YYYY-MM-DD HH:mm:ss"
            type="daterange"
            range-separator="-"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            :default-time="[new Date(2000, 1, 1, 0, 0, 0), new Date(2000, 1, 1, 23, 59, 59)]"
          />
        </el-form-item>
        <el-form-item class="filter-form__ops">
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <el-row :gutter="20" class="content-grid">
      <!-- 部门树 -->
      <tree-panel
        ref="treePanelRef"
        v-model:collapsed="treeCollapsed"
        title="部门结构"
        placeholder="请输入部门名称"
        :data="deptOptions"
        :expanded-span="5"
        @node-click="handleNodeClick"
      />
      <el-col
        :lg="treeCollapsed ? 23 : 19"
        :xs="24"
        class="tree-content-col content-main"
        :class="{ 'is-tree-collapsed': treeCollapsed }"
      >
        <el-card class="table-panel">
          <template #header>
            <div class="table-toolbar">
              <div class="table-toolbar__left">
                <h3>成员列表</h3>
                <span class="count-pill">{{ total }}</span>
                <span v-if="ids.length" class="sel-note">已选 {{ ids.length }} 项 · <a @click="clearSelection">清空</a></span>
              </div>
              <div class="table-toolbar__actions">
                <el-button v-has-permi="['system:user:edit']" :disabled="single" icon="Edit" @click="handleUpdate()">修改</el-button>
                <el-button v-has-permi="['system:user:remove']" :disabled="multiple" icon="Delete" @click="handleDelete()">删除</el-button>
                <el-button v-hasPermi="['system:user:edit']" :disabled="single" icon="Unlock" @click="handleUnlock()">解锁</el-button>
                <el-dropdown class="mt-[1px]">
                  <el-button plain type="info">
                    更多
                    <el-icon class="el-icon--right"><arrow-down /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item icon="Download" @click="importTemplate">下载模板</el-dropdown-item>
                      <el-dropdown-item v-if="checkPermi(['system:user:import'])" icon="Top" @click="handleImport">导入数据</el-dropdown-item>
                      <el-dropdown-item v-if="checkPermi(['system:user:export'])" icon="Download" @click="handleExport">导出数据</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
                <right-toolbar
                  v-model:show-search="showSearch"
                  :columns="columns"
                  :search="false"
                  storage-key="sys_user_column_visible"
                  @query-table="getList"
                ></right-toolbar>
              </div>
            </div>
          </template>

          <el-table
            ref="userTableRef"
            v-loading="loading && userList.length > 0"
            class="data-table"
            :data="userList"
            @selection-change="handleSelectionChange"
          >
            <el-table-column type="selection" width="50" align="center" />
            <el-table-column v-if="columns[0].visible" key="userId" label="用户编号" align="center" prop="userId" />
            <el-table-column
              v-if="columns[1].visible"
              key="userName"
              label="成员"
              min-width="220"
              :show-overflow-tooltip="true"
            >
              <template #default="scope">
                <div class="member-cell" @click="handleViewDetail(scope.row)">
                  <span class="member-avatar">{{ (scope.row.nickName || scope.row.userName || '用').slice(0, 1) }}</span>
                  <div class="member-info">
                    <span class="member-name">{{ scope.row.nickName || scope.row.userName }}</span>
                    <span class="member-account">{{ scope.row.userName }}</span>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              v-if="columns[2].visible"
              key="nickName"
              label="用户昵称"
              align="center"
              prop="nickName"
              :show-overflow-tooltip="true"
            />
            <el-table-column
              v-if="columns[3].visible"
              key="deptName"
              label="部门"
              align="center"
              prop="deptName"
              :show-overflow-tooltip="true"
            />
            <el-table-column
              v-if="columns[4].visible"
              key="phoneNumber"
              label="手机号码"
              align="center"
              prop="phoneNumber"
              width="120"
            />
            <el-table-column v-if="columns[5].visible" key="status" label="状态" width="120">
              <template #default="scope">
                <div class="status-cell" :class="scope.row.status === '0' ? 'is-on' : 'is-off'">
                  <el-switch
                    v-model="scope.row.status"
                    active-value="0"
                    inactive-value="1"
                    size="small"
                    @change="handleStatusChange(scope.row)"
                  />
                  <span>{{ scope.row.status === '0' ? '正常' : '停用' }}</span>
                </div>
              </template>
            </el-table-column>

            <el-table-column v-if="columns[6].visible" label="创建时间" align="center" prop="createTime" width="160" show-overflow-tooltip>
              <template #default="scope">
                <span>{{ scope.row.createTime }}</span>
              </template>
            </el-table-column>

            <el-table-column label="操作" fixed="right" width="180" class-name="small-padding fixed-width">
              <template #default="scope">
                <el-tooltip v-if="scope.row.userId !== '1761100000000000001'" content="修改" placement="top">
                  <el-button
                    v-hasPermi="['system:user:edit']"
                    link
                    type="primary"
                    icon="Edit"
                    @click="handleUpdate(scope.row)"
                  ></el-button>
                </el-tooltip>
                <el-tooltip v-if="scope.row.userId !== '1761100000000000001'" content="删除" placement="top">
                  <el-button
                    v-hasPermi="['system:user:remove']"
                    link
                    type="primary"
                    icon="Delete"
                    @click="handleDelete(scope.row)"
                  ></el-button>
                </el-tooltip>

                <el-tooltip v-if="scope.row.userId !== '1761100000000000001'" content="重置密码" placement="top">
                  <el-button
                    v-hasPermi="['system:user:resetPwd']"
                    link
                    type="primary"
                    icon="Key"
                    @click="handleResetPwd(scope.row)"
                  ></el-button>
                </el-tooltip>

                <el-tooltip v-if="scope.row.userId !== '1761100000000000001'" content="分配角色" placement="top">
                  <el-button
                    v-hasPermi="['system:user:edit']"
                    link
                    type="primary"
                    icon="CircleCheck"
                    @click="handleAuthRole(scope.row)"
                  ></el-button>
                </el-tooltip>
              </template>
            </el-table-column>
            <template #empty>
              <table-skeleton v-if="loading" :rows="8" avatar />
              <div v-else class="empty-hint">暂无数据</div>
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
      </el-col>
    </el-row>

    <!-- 添加或修改用户配置抽屉 -->
    <FormDrawer
      v-model="dialog.visible"
      :title="dialog.title"
      size="680px"
      submit-text="保存修改"
      hint="带 * 为必填项，保存后立即生效"
      @submit="submitForm"
      @closed="closeDialog"
    >
      <template #hero>
        <div class="user-hero">
          <div class="user-hero__top">
            <span class="user-hero__brand"><img :src="logoUrl" alt="" />V5Notes 成员</span>
            <span class="user-hero__divider">·</span>
            <span class="user-hero__action">{{ dialog.title }}</span>
          </div>
          <div class="user-hero__profile">
            <div class="user-hero__avatar">{{ avatarText }}</div>
            <div class="user-hero__info">
              <div class="user-hero__name">{{ heroName }}</div>
              <div class="user-hero__meta">
                <span class="user-hero__tag">{{ userTypeLabel }}</span>
                <span v-if="deptLabel">{{ deptLabel }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <el-form ref="userFormRef" :model="form" :rules="rules" label-position="top" class="user-form">
        <section class="form-section">
          <h4>基本信息</h4>
          <el-row :gutter="18">
            <el-col :span="12" v-if="form.userId == undefined">
              <el-form-item label="用户名称" prop="userName">
                <el-input v-model="form.userName" placeholder="请输入用户名称" maxlength="30" />
              </el-form-item>
            </el-col>
            <el-col :span="12" v-if="form.userId == undefined">
              <el-form-item label="用户密码" prop="password">
                <el-input
                  v-model="form.password"
                  placeholder="请输入用户密码"
                  type="password"
                  maxlength="20"
                  show-password
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="用户昵称" prop="nickName">
                <el-input v-model="form.nickName" placeholder="请输入用户昵称" maxlength="30" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="用户性别">
                <el-select v-model="form.gender" placeholder="请选择">
                  <el-option
                    v-for="dict in sys_user_gender"
                    :key="dict.value"
                    :label="dict.label"
                    :value="dict.value"
                  ></el-option>
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="手机号码" prop="phoneNumber">
                <el-input v-model="form.phoneNumber" placeholder="请输入手机号码" maxlength="11" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="邮箱" prop="email">
                <el-input v-model="form.email" placeholder="请输入邮箱" maxlength="50" />
              </el-form-item>
            </el-col>
          </el-row>
        </section>

        <section class="form-section">
          <h4>组织与岗位</h4>
          <el-row :gutter="18">
            <el-col :span="12" v-if="form.userId == null || form.userId != useUserStore().userId">
              <el-form-item label="归属部门" prop="deptId">
                <el-tree-select
                  v-model="form.deptId"
                  :data="enabledDeptOptions"
                  :props="{ value: 'id', label: 'label', children: 'children' } as any"
                  value-key="id"
                  placeholder="请选择归属部门"
                  check-strictly
                  @change="handleDeptChange"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12" v-if="form.userId == null || form.userId != useUserStore().userId">
              <el-form-item label="岗位">
                <el-select v-model="form.postIds" multiple placeholder="请选择">
                  <el-option
                    v-for="item in postOptions"
                    :key="item.postId"
                    :label="item.postName"
                    :value="item.postId"
                    :disabled="item.status == '1'"
                  ></el-option>
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="18">
            <el-col :span="24">
              <el-form-item label="账号状态">
                <el-radio-group v-model="form.status">
                  <el-radio v-for="dict in sys_normal_disable" :key="dict.value" :value="dict.value">
                    {{ dict.label }}
                  </el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
          </el-row>
        </section>

        <section class="form-section">
          <h4>角色与用户类型</h4>
          <el-row :gutter="18">
            <el-col :span="12" v-if="form.userId == null || form.userId != useUserStore().userId">
              <el-form-item label="角色" prop="roleIds">
                <el-select v-model="form.roleIds" filterable multiple placeholder="请选择">
                  <el-option
                    v-for="item in roleOptions"
                    :key="item.roleId"
                    :label="item.roleName"
                    :value="item.roleId"
                    :disabled="item.status == '1'"
                  ></el-option>
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="用户类型" prop="userType">
                <el-select v-model="form.userType" placeholder="请选择用户类型">
                  <el-option
                    v-for="dict in user_type"
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
          <h4>备注</h4>
          <el-row :gutter="18">
            <el-col :span="24">
              <el-form-item>
                <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="请输入内容"></el-input>
              </el-form-item>
            </el-col>
          </el-row>
        </section>
      </el-form>
    </FormDrawer>

    <!-- 用户导入对话框 -->
    <el-dialog v-model="upload.open" :title="upload.title" width="400px" append-to-body class="app-dialog">
      <template #header>
        <div class="app-dialog-hero">
          <div class="app-dialog-hero__top">
            <img src="@/assets/logo/logo.png" alt="" />
            <span>V5Notes 用户</span>
          </div>
          <div class="app-dialog-hero__main">
            <div class="app-dialog-hero__icon">导</div>
            <div>
              <div class="app-dialog-hero__name">{{ upload.title }}</div>
              <div class="app-dialog-hero__meta"><span>导入 Excel 批量创建成员</span></div>
            </div>
          </div>
        </div>
      </template>

      <el-upload
        ref="uploadRef"
        :limit="1"
        accept=".xlsx, .xls"
        :headers="upload.headers"
        :action="upload.url + '?updateSupport=' + upload.updateSupport"
        :disabled="upload.isUploading"
        :on-progress="handleFileUploadProgress"
        :on-success="handleFileSuccess"
        :auto-upload="false"
        drag
      >
        <el-icon class="el-icon--upload">
          <UploadFilled />
        </el-icon>
        <div class="el-upload__text">
          将文件拖到此处，或
          <em>点击上传</em>
        </div>
        <template #tip>
          <div class="text-center el-upload__tip">
            <div class="el-upload__tip">
              <el-checkbox v-model="upload.updateSupport" />
              是否更新已经存在的用户数据
            </div>
            <span>仅允许导入xls、xlsx格式文件。</span>
            <el-link
              type="primary"
              underline="never"
              style="font-size: 12px; vertical-align: baseline"
              @click="importTemplate"
            >
              下载模板
            </el-link>
          </div>
        </template>
      </el-upload>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitFileForm">确 定</el-button>
          <el-button @click="upload.open = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 重置密码对话框 -->
    <el-dialog
      v-model="resetPwdDialog.visible"
      width="460px"
      append-to-body
      class="app-dialog reset-pwd-dialog"
    >
      <template #header>
        <div class="app-dialog-hero">
          <div class="app-dialog-hero__top">
            <img src="@/assets/logo/logo.png" alt="" />
            <span>V5Notes 用户</span>
          </div>
          <div class="app-dialog-hero__main">
            <div class="app-dialog-hero__icon">{{ (resetPwdDialog.nickName || resetPwdDialog.userName || '密').slice(0, 1) }}</div>
            <div>
              <div class="app-dialog-hero__name">重置密码</div>
              <div class="app-dialog-hero__meta">
                <span>{{ resetPwdDialog.nickName || resetPwdDialog.userName || '-' }}</span>
                <span class="app-dialog-hero__dot">·</span>
                <span>{{ resetPwdDialog.userName }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <el-form
        ref="resetPwdFormRef"
        :model="resetPwdForm"
        :rules="resetPwdRules"
        label-position="top"
        class="app-dialog-form"
        @submit.prevent
      >
        <el-form-item label="新密码" prop="password">
          <el-input
            v-model="resetPwdForm.password"
            type="password"
            show-password
            maxlength="20"
            placeholder="请输入 5–20 位新密码"
            autocomplete="new-password"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="resetPwdDialog.visible = false">取消</el-button>
          <el-button type="primary" icon="Key" @click="submitResetPwd">确定重置</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 分配角色对话框 -->
    <el-dialog
      v-model="authRoleDialog.visible"
      width="820px"
      append-to-body
      class="app-dialog auth-role-dialog"
    >
      <template #header>
        <div class="app-dialog-hero">
          <div class="app-dialog-hero__top">
            <img src="@/assets/logo/logo.png" alt="" />
            <span>V5Notes 用户分配</span>
          </div>
          <div class="app-dialog-hero__main">
            <div class="app-dialog-hero__icon">{{ (authRoleDialog.nickName || authRoleDialog.userName || '角').slice(0, 1) }}</div>
            <div>
              <div class="app-dialog-hero__name">分配角色 · {{ authRoleDialog.nickName || authRoleDialog.userName || '-' }}</div>
              <div class="app-dialog-hero__meta">
                <span>{{ authRoleDialog.userName }}</span>
                <span class="app-dialog-hero__dot">·</span>
                <span>已选 {{ authRoleSelected.length }} 个角色</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <el-table
        ref="authRoleTableRef"
        v-loading="authRoleLoading"
        class="data-table auth-role-table"
        :data="authRoleList"
        row-key="roleId"
        max-height="380"
        fit
        empty-text="暂无可分配的角色"
        @selection-change="handleAuthRoleSelectionChange"
      >
        <el-table-column type="selection" width="48" align="center" :selectable="checkRoleSelectable" />
        <el-table-column label="角色名称" min-width="150" prop="roleName" show-overflow-tooltip />
        <el-table-column label="权限字符" min-width="130" prop="roleKey" show-overflow-tooltip />
        <el-table-column label="描述" min-width="150" prop="remark" show-overflow-tooltip>
          <template #default="scope">
            <span :class="{ 'cell-placeholder': !scope.row.remark }">{{ scope.row.remark || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" align="center" width="90">
          <template #default="scope">
            <el-tag :type="scope.row.status === '0' ? 'success' : 'info'" size="small">
              {{ scope.row.status === '0' ? '正常' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" align="center" width="170">
          <template #default="scope">
            <span class="cell-nowrap">{{ scope.row.createTime ? parseTime(scope.row.createTime) : '—' }}</span>
          </template>
        </el-table-column>
      </el-table>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="authRoleDialog.visible = false">取消</el-button>
          <el-button type="primary" icon="CircleCheck" @click="submitAuthRole">确定分配</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 用户详情抽屉 -->
    <user-view-drawer ref="userViewRef" />
  </div>
</template>

<script setup name="User" lang="ts">
import TableSkeleton from '@/components/Skeleton/TableSkeleton.vue';
import { to } from 'await-to-js';
import { getConfigKey } from '@/api/system/config';
import { DeptTreeVO, DeptVO } from '@/api/system/dept/types';
import { optionselect } from '@/api/system/post';
import { PostVO } from '@/api/system/post/types';
import { RoleVO } from '@/api/system/role/types';
import api, { getAuthRole, updateAuthRole } from '@/api/system/user';
import { UserForm, UserQuery, UserVO } from '@/api/system/user/types';
import TreePanel from '@/components/TreePanel/index.vue';
import { useLoading } from '@/hooks/async/useLoading';
import { useDialogState } from '@/hooks/dialog/useDialogState';
import { useDateRangeQuery } from '@/hooks/form/useDateRangeQuery';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import { useTableSelection } from '@/hooks/table/useTableSelection';
import { useTreeCollapsed } from '@/hooks/tree/useTreeCollapsed';
import modal from '@/plugins/modal';
import { useUserStore } from '@/store/modules/user';
import { useDict } from '@/utils/dict';
import { checkPermi } from '@/utils/permission';
import { globalHeaders } from '@/utils/request';
import { download as requestDownload } from '@/utils/request';
import UserViewDrawer from './view.vue';
import FormDrawer from '@/components/FormDrawer/index.vue';
import logoUrl from '@/assets/logo/logo.png';
import { parseTime, selectDictLabel } from '@/utils/ruoyi';

const { sys_normal_disable, sys_user_gender, user_type } = toRefs<any>(
  useDict('sys_normal_disable', 'sys_user_gender', 'user_type')
);
const userList = ref<UserVO[]>([]);
const { loading, withLoading } = useLoading(true);
const { showSearch } = useSearchToggle();
const total = ref(0);
const { dateRange, applyDateRange, resetDateRange } = useDateRangeQuery();
const { treeCollapsed } = useTreeCollapsed();
const deptOptions = ref<DeptTreeVO[]>([]);
const enabledDeptOptions = ref<DeptTreeVO[]>([]);
const initPassword = ref<string>('');
const postOptions = ref<PostVO[]>([]);
const roleOptions = ref<RoleVO[]>([]);
/*** 用户导入参数 */
const upload = reactive<ImportOption>({
  // 是否显示弹出层（用户导入）
  open: false,
  // 弹出层标题（用户导入）
  title: '',
  // 是否禁用上传
  isUploading: false,
  // 是否更新已经存在的用户数据
  updateSupport: 0,
  // 设置上传的请求头部
  headers: globalHeaders(),
  // 上传的地址
  url: import.meta.env.VITE_APP_BASE_API + '/system/user/importData'
});
// 列显隐信息
const columns = ref<FieldOption[]>([
  { key: 0, label: `用户编号`, visible: false, children: [] },
  { key: 1, label: `成员`, visible: true, children: [] },
  { key: 2, label: `用户昵称`, visible: false, children: [] },
  { key: 3, label: `部门`, visible: true, children: [] },
  { key: 4, label: `手机号码`, visible: true, children: [] },
  { key: 5, label: `状态`, visible: true, children: [] },
  { key: 6, label: `创建时间`, visible: true, children: [] }
]);

const treePanelRef = ref<InstanceType<typeof TreePanel>>();
const queryFormRef = ref<ElFormInstance>();
const userFormRef = ref<ElFormInstance>();
const uploadRef = ref<ElUploadInstance>();
const userViewRef = ref<InstanceType<typeof UserViewDrawer>>();
const userTableRef = ref<any>();

const initFormData: UserForm = {
  userId: undefined,
  deptId: undefined,
  userName: '',
  nickName: undefined,
  password: '',
  phoneNumber: undefined,
  email: undefined,
  gender: undefined,
  userType: 'sys_user',
  status: '0',
  remark: '',
  postIds: [],
  roleIds: []
};

const initData: PageData<UserForm, UserQuery> = {
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    keyword: '',
    phoneNumber: '',
    status: '',
    deptId: '',
    roleId: ''
  },
  rules: {
    userName: [
      { required: true, message: '用户名称不能为空', trigger: 'blur' },
      {
        min: 2,
        max: 20,
        message: '用户名称长度必须介于 2 和 20 之间',
        trigger: 'blur'
      }
    ],
    nickName: [{ required: true, message: '用户昵称不能为空', trigger: 'blur' }],
    password: [
      { required: true, message: '用户密码不能为空', trigger: 'blur' },
      {
        min: 5,
        max: 20,
        message: '用户密码长度必须介于 5 和 20 之间',
        trigger: 'blur'
      },
      {
        pattern: /^[^<>"'|\\]+$/,
        message: '不能包含非法字符：< > " \' \\ |',
        trigger: 'blur'
      }
    ],
    email: [
      {
        type: 'email',
        message: '请输入正确的邮箱地址',
        trigger: ['blur', 'change']
      }
    ],
    phoneNumber: [
      {
        pattern: /^1[3456789][0-9]\d{8}$/,
        message: '请输入正确的手机号码',
        trigger: 'blur'
      }
    ],
    userType: [{ required: true, message: '用户类型不能为空', trigger: 'change' }],
    roleIds: [{ required: true, message: '用户角色不能为空', trigger: 'blur' }]
  }
};
const data = reactive<PageData<UserForm, UserQuery>>(initData);

const { queryParams, form, rules } = toRefs<PageData<UserForm, UserQuery>>(data);
const { ids, single, multiple, handleSelectionChange } = useTableSelection<UserVO>(item => item.userId);
const clearSelection = () => userTableRef.value?.clearSelection();
const { dialog, openDialog: openUserDialog, closeDialog: closeUserDialog, setTitle: setDialogTitle } = useDialogState();

const findDeptLabel = (nodes: any[]): string => {
  for (const node of nodes || []) {
    if (String(node.id) === String(form.value.deptId)) return node.label;
    const child = node.children?.length ? findDeptLabel(node.children) : '';
    if (child) return child;
  }
  return '';
};
const heroName = computed(() => form.value.nickName || (form.value.userId ? '未命名成员' : '新增成员'));
const avatarText = computed(() => (form.value.nickName || (form.value.userId ? '用' : '新')).trim().slice(0, 1));
const userTypeLabel = computed(() => selectDictLabel(user_type.value || [], form.value.userType) || '未选择用户类型');
const deptLabel = computed(() => (form.value.deptId ? findDeptLabel(enabledDeptOptions.value) : ''));
/** 方向2 指标卡数据（本页统计，真实数据，不虚构全局值） */
const statEnabled = computed(() => (userList.value || []).filter(item => item.status === '0').length);
const statDisabled = computed(() => (userList.value || []).filter(item => item.status === '1').length);
const statSelected = computed(() => ids.value.length);

/** 查询用户列表 */
const getList = async () => {
  await withLoading(async () => {
    const res = await api.listUser(applyDateRange(queryParams.value));
    userList.value = res.data?.rows ?? [];
    total.value = res.data?.total;
  });
};

/** 查询部门下拉树结构 */
const getDeptTree = async () => {
  const res = await api.deptTreeSelect();
  deptOptions.value = res.data;
  enabledDeptOptions.value = filterDisabledDept(res.data);
};

/** 过滤禁用的部门，并返回独立的新树，避免污染左侧完整部门树 */
const filterDisabledDept = (deptList: DeptTreeVO[]): DeptTreeVO[] => {
  return deptList.reduce<DeptTreeVO[]>((result, dept) => {
    if (dept.disabled) {
      return result;
    }
    result.push({
      ...dept,
      children: dept.children?.length ? filterDisabledDept(dept.children) : []
    });
    return result;
  }, []);
};

/** 节点单击事件 */
const handleNodeClick = (data: DeptVO) => {
  queryParams.value.deptId = data.id;
  handleQuery();
};

/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};
const { resetQuery } = useSearchReset({
  queryFormRef,
  queryParams,
  pageNumKey: 'pageNum',
  resetExtras: () => {
    resetDateRange();
    queryParams.value.deptId = undefined;
    treePanelRef.value?.setCurrentKey(undefined);
  },
  afterReset: () => {
    handleQuery();
  }
});

/** 删除按钮操作 */
const handleDelete = async (row?: Partial<UserVO>) => {
  const userIds = row?.userId || ids.value;
  const [err] = await to(modal.confirm('是否确认删除用户编号为"' + userIds + '"的数据项？') as any);
  if (!err) {
    await api.delUser(userIds);
    await getList();
    modal.msgSuccess('删除成功');
  }
};

/** 解锁按钮操作 */
const handleUnlock = async () => {
  const userId = ids.value[0];
  const [err] = await to(modal.confirm('是否确认解锁用户编号为"' + userId + '"的数据项?') as any);
  if (!err) {
    await api.unlockUser(userId);
    modal.msgSuccess('用户编号"' + userId + '"解锁成功');
  }
};

/** 用户状态修改  */
const handleStatusChange = async (row: Partial<UserVO>) => {
  const text = row.status === '0' ? '启用' : '停用';
  try {
    await modal.confirm('确认要"' + text + '""' + row.userName + '"用户吗?');
    await api.changeUserStatus(row.userId, row.status);
    modal.msgSuccess(text + '成功');
  } catch (err) {
    row.status = row.status === '0' ? '1' : '0';
  }
};
/** ===== 分配角色弹窗 ===== */
const authRoleDialog = reactive({
  visible: false,
  userId: undefined as string | number | undefined,
  userName: '',
  nickName: ''
});
const authRoleLoading = ref(false);
const authRoleList = ref<any[]>([]);
const authRoleSelected = ref<Array<string | number>>([]);
const authRoleTableRef = ref<ElTableInstance>();

const handleAuthRoleSelectionChange = (selection: any[]) => {
  authRoleSelected.value = selection.map(item => item.roleId);
};

const checkRoleSelectable = (row: any) => row.status === '0';

/** 打开分配角色弹窗并回显已分配角色 */
const handleAuthRole = async (row: Partial<UserVO>) => {
  authRoleDialog.userId = row.userId;
  authRoleDialog.userName = row.userName ?? '';
  authRoleDialog.nickName = row.nickName ?? '';
  authRoleLoading.value = true;
  authRoleList.value = [];
  authRoleSelected.value = [];
  try {
    const res: any = await getAuthRole(row.userId as string);
    // 兼容多种返回结构：{roles:[...]} / {data:{roles}} / 直接数组
    const payload: any = res?.data ?? {};
    const rawRoles = Array.isArray(payload) ? payload : (payload.roles ?? res?.roles ?? []);
    authRoleList.value = Array.isArray(rawRoles) ? rawRoles : [];
    if (!authRoleList.value.length) {
      console.warn('[分配角色] 接口未返回角色，原始响应：', res);
    }
  } catch (e) {
    console.error('[分配角色] 加载失败', e);
    authRoleList.value = [];
  } finally {
    authRoleLoading.value = false;
  }
  // 数据就绪后再显示，弹窗展开动画结束后再布局一次，确保列宽正确
  authRoleDialog.visible = true;
  await nextTick();
  authRoleTableRef.value?.doLayout?.();
  setTimeout(() => authRoleTableRef.value?.doLayout?.(), 320);
  authRoleList.value.forEach(role => {
    if ((role?.flag || role?.initialized) && checkRoleSelectable(role)) {
      authRoleTableRef.value?.toggleRowSelection(role, true);
    }
  });
};

/** 提交分配角色 */
const submitAuthRole = async () => {
  await updateAuthRole({
    userId: String(authRoleDialog.userId),
    roleIds: authRoleSelected.value.join(',')
  });
  modal.msgSuccess('授权成功');
  authRoleDialog.visible = false;
};



/** ===== 重置密码弹窗 ===== */
const resetPwdDialog = reactive({
  visible: false,
  userId: undefined as string | number | undefined,
  userName: '',
  nickName: ''
});
const resetPwdFormRef = ref<ElFormInstance>();
const resetPwdForm = reactive({ password: '' });
const resetPwdRules = {
  password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 5, max: 20, message: '密码长度必须介于 5 和 20 之间', trigger: 'blur' }
  ]
};

/** 重置密码按钮操作 */
const handleResetPwd = (row: Partial<UserVO>) => {
  resetPwdForm.password = '';
  resetPwdDialog.userId = row.userId;
  resetPwdDialog.userName = row.userName ?? '';
  resetPwdDialog.nickName = row.nickName ?? '';
  resetPwdDialog.visible = true;
  nextTick(() => resetPwdFormRef.value?.clearValidate());
};

/** 提交重置密码 */
const submitResetPwd = () => {
  resetPwdFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) return;
    await api.resetUserPwd(resetPwdDialog.userId, resetPwdForm.password);
    modal.msgSuccess('密码已重置为：' + resetPwdForm.password);
    resetPwdDialog.visible = false;
    resetPwdForm.password = '';
  });
};

/** 详情按钮操作 */
const handleViewDetail = (row: Partial<UserVO>) => {
  userViewRef.value?.openDrawer(row.userId);
};

/** 导入按钮操作 */
const handleImport = () => {
  upload.title = '用户导入';
  upload.open = true;
};
/** 导出按钮操作 */
const handleExport = () => {
  requestDownload(
    'system/user/export',
    {
      ...queryParams.value
    },
    `user_${new Date().getTime()}.xlsx`
  );
};
/** 下载模板操作 */
const importTemplate = () => {
  requestDownload('system/user/importTemplate', {}, `user_template_${new Date().getTime()}.xlsx`);
};

/**文件上传中处理 */
const handleFileUploadProgress = () => {
  upload.isUploading = true;
};

const formatImportResultMessage = (message: unknown) => {
  return String(message ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '');
};

/** 文件上传成功处理 */
const handleFileSuccess = (response: any, file: UploadFile) => {
  upload.open = false;
  upload.isUploading = false;
  uploadRef.value?.handleRemove(file);
  ElMessageBox.alert(formatImportResultMessage(response.msg), '导入结果', {
    customClass: 'import-result-box'
  });
  getList();
};

/** 提交上传文件 */
function submitFileForm() {
  uploadRef.value?.submit();
}

/** 重置操作表单 */
const reset = () => {
  form.value = { ...initFormData };
  userFormRef.value?.resetFields();
};
/** 取消按钮 */
const cancel = () => {
  closeUserDialog();
  reset();
};

/** 新增按钮操作 */
const handleAdd = async () => {
  reset();
  const { data } = await api.getUser();
  setDialogTitle('新增用户');
  openUserDialog();
  postOptions.value = data.posts;
  roleOptions.value = data.roles;
  form.value.password = initPassword.value.toString();
};

/** 修改按钮操作 */
const handleUpdate = async (row?: Partial<UserForm>) => {
  reset();
  const userId = row?.userId || ids.value[0];
  const { data } = await api.getUser(userId);
  setDialogTitle('修改用户');
  openUserDialog();
  Object.assign(form.value, data.user);
  postOptions.value = data.posts;
  roleOptions.value = Array.from(
    new Map([...data.roles, ...data.user.roles].map(role => [role.roleId, role])).values()
  );
  form.value.postIds = data.postIds;
  form.value.roleIds = data.roleIds;
  form.value.password = '';
};

/** 提交按钮 */
const submitForm = () => {
  userFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      if (form.value.userId) {
        // 自己编辑自己的情况下 不允许编辑角色部门岗位
        if (form.value.userId == useUserStore().userId) {
          form.value.roleIds = null;
          form.value.deptId = null;
          form.value.postIds = null;
        }
        await api.updateUser(form.value);
      } else {
        await api.addUser(form.value);
      }
      modal.msgSuccess('操作成功');
      closeUserDialog();
      await getList();
    }
  });
};

/**
 * 关闭用户弹窗
 */
const closeDialog = () => {
  closeUserDialog();
  resetForm();
};

/**
 * 重置表单
 */
const resetForm = () => {
  userFormRef.value?.resetFields();
  userFormRef.value?.clearValidate();

  form.value.id = undefined;
  form.value.status = '1';
};
onMounted(() => {
  getDeptTree(); // 初始化部门数据
  getList(); // 初始化列表数据
  getConfigKey('sys.user.initPassword').then(response => {
    initPassword.value = response.data;
  });
});

async function handleDeptChange(value: number | string) {
  const response = await optionselect(value);
  postOptions.value = response.data;
  form.value.postIds = [];
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/components/page-shell' as pageShell;

@include pageShell.tree-table-crud-page;

:global(.import-result-box .el-message-box__message) {
  max-height: 70vh;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px 20px 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.user-hero {
  position: relative;
  overflow: hidden;
  padding: 24px 28px 24px;
  color: #fff;
  background: linear-gradient(148deg, #0f3d33 0%, #1c5a48 70%, #256a55 100%);
}
.user-hero::after {
  content: '';
  position: absolute;
  top: -130px;
  right: -90px;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
}
.user-hero__top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  color: #dff1e8;
  letter-spacing: 0.02em;
}
.user-hero__brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.user-hero__brand img {
  width: 22px;
  height: 22px;
  border-radius: 6px;
}
.user-hero__divider {
  color: rgba(223, 241, 232, 0.5);
}
.user-hero__action {
  color: #c9e4d7;
}
.user-hero__profile {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 15px;
  margin-top: 24px;
}
.user-hero__avatar {
  width: 62px;
  height: 62px;
  flex: none;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.16);
  font-size: 24px;
  font-weight: 700;
}
.user-hero__name {
  margin-bottom: 7px;
  font-size: 21px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.user-hero__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #c9e4d7;
}
.user-hero__tag {
  padding: 4px 9px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  color: #eafff5;
  font-size: 11.5px;
  font-weight: 700;
}
.user-form :deep(.el-form-item) {
  margin-bottom: 16px;
}
.user-form :deep(.el-form-item__label) {
  padding-bottom: 6px;
  line-height: 1.3;
  font-size: 12.5px;
  font-weight: 600;
  color: #3f4a44;
}
.user-form :deep(.el-input__wrapper),
.user-form :deep(.el-select__wrapper),
.user-form :deep(.el-textarea__inner) {
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 0 0 1px #dfe5e1 inset;
}
.user-form :deep(.el-input__wrapper:hover),
.user-form :deep(.el-select__wrapper:hover) {
  box-shadow: 0 0 0 1px #b9c9c1 inset;
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

/* ===== 方向 2 · 薄荷工作台 · 成员管理页版式 ===== */
.user-page { gap: 14px; }

.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  padding: 2px 2px 0;
}
.page-head__text .eyebrow {
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #2f6b57;
}
.page-title {
  margin: 0;
  font-size: 27px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: #15241e;
  line-height: 1.1;
}
.page-sub {
  margin: 7px 0 0;
  font-size: 13.5px;
  color: #5f7067;
}
.page-sub b {
  color: #17624a;
}
.page-head__actions {
  display: flex;
  gap: 10px;
  flex: none;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.stat-card {
  padding: 14px 18px;
  background: var(--app-surface-bg);
  border: 1px solid var(--app-surface-border);
  border-radius: 12px;
  box-shadow: var(--app-shadow-sm);
}
.stat-card__top {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #5f7067;
}
.sdot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.sdot.mint { background: #2f9e6b; box-shadow: 0 0 0 3px rgba(47, 158, 107, 0.14); }
.sdot.grey { background: #b9c2bc; }
.sdot.amber { background: #d9a33b; box-shadow: 0 0 0 3px rgba(217, 163, 59, 0.16); }
.stat-card__value {
  margin-top: 10px;
  font-size: 26px;
  font-weight: 800;
  line-height: 1;
  color: #15241e;
}
.stat-card__value em {
  margin-left: 3px;
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  color: #8a978f;
}
.stat-card__hint {
  margin-top: 8px;
  font-size: 11.5px;
  color: #96a099;
}

.filter-bar {
  padding: 14px 16px 2px;
  background: var(--app-surface-bg);
  border: 1px solid var(--app-surface-border);
  border-radius: 12px;
  box-shadow: var(--app-shadow-sm);
}
.filter-form :deep(.el-form-item) { margin-bottom: 12px; }
.filter-form :deep(.el-form-item__label) {
  font-size: 12.5px;
  font-weight: 600;
  color: #5f7067;
}
.filter-form__ops {
  margin-left: auto;
}

.table-panel { border-radius: 12px; }
.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.table-toolbar__left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.table-toolbar__left h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #15241e;
}
.count-pill {
  padding: 2px 9px;
  font-size: 11.5px;
  font-weight: 700;
  color: #17624a;
  background: #e8f2ec;
  border: 1px solid #d8e7dd;
  border-radius: 999px;
}
.sel-note { font-size: 12px; color: #7a857e; }
.sel-note a { color: #1c5a48; cursor: pointer; text-decoration: underline; }
.table-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-wrap: nowrap;
}

.member-cell { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.member-avatar {
  flex: none;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: #e8f2ec;
  color: #1c5a48;
  font-size: 13px;
  font-weight: 800;
}
.member-info { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
.member-name { font-size: 13.5px; font-weight: 700; color: #1d2b24; }
.member-account { font-size: 11.5px; color: #7c8880; }
.status-cell { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; }
.status-cell.is-on { color: #1f7a55; }
.status-cell.is-off { color: #8a948c; }

/* 表格：去竖线、左对齐、浅灰表头、行 hover 薄荷 */
.user-page :deep(.el-table th.el-table__cell),
.user-page :deep(.el-table td.el-table__cell) {
  text-align: left;
}
.user-page :deep(.el-table th.el-table__cell .cell),
.user-page :deep(.el-table td.el-table__cell .cell) {
  text-align: left !important;
}
/* 复选框与居中列保持居中，不受左对齐影响 */
.user-page :deep(.el-table__cell:nth-child(1) .cell),
.user-page :deep(.el-table-column--selection .cell),
.user-page :deep(.el-table__cell.is-center .cell) {
  text-align: center !important;
  justify-content: center;
}
.user-page :deep(.el-table th.el-table__cell) {
  background: #f6f8f7 !important;
  color: #5f7067;
  font-weight: 700;
  font-size: 12px;
}
.user-page :deep(.el-table td.el-table__cell) {
  padding: 9px 0;
}
.user-page :deep(.el-table .el-table__row:hover > td.el-table__cell) {
  background: #f6f8f7 !important;
}
.user-page :deep(.el-table) {
  border-radius: 10px;
}
</style>

<style lang="scss" scoped>
/* ===== 用户管理：部门树与成员列表底部对齐 ===== */
.user-page {
  height: calc(100vh - 76px - 24px - 8px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.app-main.with-tags-view .user-page {
  height: calc(100vh - 111px - 24px - 8px);
}
.user-page .content-grid {
  flex: 1;
  min-height: 0;
  align-items: stretch;
  margin-bottom: 0;
}
/* 左：部门树列 */
.user-page .tree-panel-col {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.user-page :deep(.tree-panel-shell) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.user-page :deep(.tree-panel-shell .el-card__body) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.user-page :deep(.dept-tree-wrap) {
  flex: 1;
  min-height: 0;
}
/* 右：成员列表列 */
.user-page .tree-content-col {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.user-page .tree-content-col .table-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.user-page .tree-content-col .table-panel :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>

<style lang="scss" scoped>
/* 页面上部区域固定高度，剩余空间全给内容区 */
.user-page > .page-head,
.user-page > .stat-grid,
.user-page > .filter-bar {
  flex: none;
}
.user-page > .content-grid {
  flex: 1;
  min-height: 0;
}
</style>

<style lang="scss" scoped>
/* 重置密码弹窗：输入框加宽 + 提示文字 */
.reset-pwd-dialog :deep(.el-form-item) {
  margin-bottom: 6px;
}
.reset-pwd-dialog :deep(.el-input__wrapper) {
  height: 42px;
  border-radius: 10px;
}
.reset-pwd-dialog :deep(.el-input__inner) {
  letter-spacing: 0.08em;
}
</style>

<style lang="scss" scoped>
/* ===== 分配角色弹窗 ===== */
.auth-role-table {
  border-radius: 10px;
}
.auth-role-table :deep(th.el-table__cell) {
  background: #f6f8f7 !important;
  color: #5f7067;
  font-weight: 700;
  font-size: 12px;
}
.auth-role-table :deep(th.el-table__cell .cell),
.auth-role-table :deep(td.el-table__cell .cell) {
  text-align: left !important;
}
.auth-role-table :deep(th.el-table__cell:nth-child(1) .cell),
.auth-role-table :deep(td.el-table__cell:nth-child(1) .cell) {
  text-align: center !important;
}
.auth-role-table :deep(.cell-placeholder) {
  color: #9aa39c;
}
.auth-role-table :deep(.cell-nowrap) {
  white-space: nowrap;
}
</style>

<style lang="scss" scoped>
/* 分配角色：表格宽度自适应容器，避免横向截断 */
.auth-role-table {
  width: 100%;
}
.auth-role-dialog :deep(.el-dialog__body) {
  overflow-x: hidden;
}
</style>

<style lang="scss" scoped>
/* 筛选区：控件统一高度，状态下拉收窄 */
.filter-form :deep(.el-input__wrapper),
.filter-form :deep(.el-select__wrapper),
.filter-form :deep(.el-range-editor) {
  height: 34px;
}
.filter-form.el-form--inline :deep(.el-select) {
  width: 130px;
}
</style>
