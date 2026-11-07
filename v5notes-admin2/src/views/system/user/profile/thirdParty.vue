<template>
  <div class="profile-auth">
    <div class="profile-auth-table-wrap">
    <el-table
      :data="auths"
      border
      class="data-table profile-auth-table"
      data-full-height-table="false"
      empty-text="暂无第三方账号绑定"
    >
      <el-table-column label="序号" type="index" width="64" align="center" />
      <el-table-column label="绑定账号平台" min-width="150" align="center" prop="source" show-overflow-tooltip />
      <el-table-column label="头像" width="110" align="center" prop="avatar">
        <template #default="scope">
          <img v-if="scope.row.avatar" :src="scope.row.avatar" class="profile-auth-avatar" />
          <span v-else class="profile-auth-avatar-empty">—</span>
        </template>
      </el-table-column>
      <el-table-column label="系统账号" min-width="160" align="center" prop="userName" :show-overflow-tooltip="true" />
      <el-table-column label="绑定时间" min-width="170" align="center" prop="createTime" />
      <el-table-column label="操作" width="90" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-tooltip content="解绑" placement="top">
            <el-button link type="primary" icon="CircleClose" @click="unlockAuth(scope.row)"></el-button>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>
    </div>

    <div class="provider-section">
      <div class="provider-heading">
        <h4 class="provider-desc">可绑定的第三方应用</h4>
        <p>点击下方平台完成账号绑定。</p>
      </div>
      <div class="user-bind">
        <a class="third-app" href="#" title="使用 微信 账号授权登录" @click="authUrl('wechat')">
          <div class="third-app__icon">
            <svg-icon icon-class="wechat" />
          </div>
          <span class="app-name">微信</span>
        </a>
        <a class="third-app" href="#" title="使用 MaxKey 账号授权登录" @click="authUrl('maxkey')">
          <div class="third-app__icon">
            <svg-icon icon-class="maxkey" />
          </div>
          <span class="app-name">MaxKey</span>
        </a>
        <a class="third-app" href="#" title="使用 TopIam 账号授权登录" @click="authUrl('topiam')">
          <div class="third-app__icon">
            <svg-icon icon-class="topiam" />
          </div>
          <span class="app-name">TopIam</span>
        </a>
        <a class="third-app" href="#" title="使用 Gitee 账号授权登录" @click="authUrl('gitee')">
          <div class="third-app__icon">
            <svg-icon icon-class="gitee" />
          </div>
          <span class="app-name">Gitee</span>
        </a>
        <a class="third-app" href="#" title="使用 GitHub 账号授权登录" @click="authUrl('github')">
          <div class="third-app__icon">
            <svg-icon icon-class="github" />
          </div>
          <span class="app-name">GitHub</span>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { authUnlock, authRouterUrl } from '@/api/system/social/auth';
import modal from '@/plugins/modal';
import tab from '@/plugins/tab';
import { propTypes } from '@/utils/propTypes';

const props = defineProps({
  auths: propTypes.any.isRequired
});
const auths = computed(() => props.auths);

const unlockAuth = (row: any) => {
  ElMessageBox.confirm('您确定要解除"' + row.source + '"的账号绑定吗？')
    .then(() => {
      return authUnlock(row.id);
    })
    .then((res: any) => {
      if (res.code === 200) {
        modal.msgSuccess('解绑成功');
        tab.refreshPage();
      } else {
        modal.msgError(res.msg);
      }
    })
    .catch(() => {});
};

const authUrl = (source: string) => {
  authRouterUrl(source).then((res: any) => {
    if (res.code === 200) {
      window.location.href = res.data;
    } else {
      modal.msgError(res.msg);
    }
  });
};
</script>

<style lang="scss" scoped>
.profile-auth {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

/* 表格占满剩余高度，内部滚动；下方绑定区固定高度 */
.profile-auth-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.profile-auth-table {
  height: 100%;
}

.profile-auth-table {
  width: 100%;
}

/* 表头不换行，避免「序号」竖排 */
.profile-auth-table :deep(th.el-table__cell .cell) {
  white-space: nowrap;
}

.profile-auth-table :deep(.el-table__cell) {
  padding: 10px 0;
}

.profile-auth-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  display: inline-block;
}

.profile-auth-avatar-empty {
  color: var(--el-text-color-placeholder);
}

.provider-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: none;
}

.provider-heading p {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
}

.user-bind .third-app {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 84px;
  padding: 12px 10px;
  border: 1px solid var(--app-surface-border);
  border-radius: 12px;
  background: var(--app-elevated-soft-bg);
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.user-bind {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 108px));
  gap: 10px;
  justify-content: start;
}

.third-app:hover {
  transform: translateY(-1px);
  border-color: rgba(28, 90, 72, 0.3);
  box-shadow: var(--app-shadow-sm);
}

.third-app__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(28, 90, 72, 0.08);
  font-size: 18px;
}

a {
  text-decoration: none;
  cursor: pointer;
  color: inherit;
}

.provider-desc {
  margin: 0;
  font-size: 16px;
}

.app-name {
  font-weight: 600;
  font-size: 13px;
  line-height: 1.2;
  text-align: center;
  word-break: break-word;
}

html.dark {
  .user-bind .third-app {
    background: rgba(15, 23, 42, 0.64);
  }
}
</style>
