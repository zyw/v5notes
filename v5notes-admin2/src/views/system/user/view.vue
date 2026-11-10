<template>
  <el-drawer
    v-model="visible"
    :title="$t('system.user.detailTitle')"
    :size="680"
    append-to-body
    :close-on-click-modal="true"
    @closed="info = null"
  >
    <el-descriptions v-if="info" v-loading="loading" :column="2" border>
      <el-descriptions-item :label="$t('system.user.userName')">{{ info.nickName }}</el-descriptions-item>
      <el-descriptions-item :label="$t('system.user.belongDept')">
        {{ info.deptName || (info.dept && info.dept.deptName) || '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('system.user.phone')">{{ info.phoneNumber || '-' }}</el-descriptions-item>
      <el-descriptions-item :label="$t('system.user.email')">{{ info.email || '-' }}</el-descriptions-item>
      <el-descriptions-item :label="$t('system.user.loginAccount')">{{ info.userName }}</el-descriptions-item>
      <el-descriptions-item :label="$t('system.user.userStatus')">
        <el-tag :type="info.status === '0' ? 'success' : 'danger'">
          {{ selectDictLabel(sys_normal_disable, info.status) }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item :label="$t('system.user.post')">{{ postNames || '-' }}</el-descriptions-item>
      <el-descriptions-item :label="$t('system.user.gender')">
        {{ selectDictLabel(sys_user_gender, info.gender) || '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('system.user.role')" :span="2">{{ roleNames || '-' }}</el-descriptions-item>
    </el-descriptions>

    <el-divider />

    <el-descriptions v-if="info" :column="2" border>
      <el-descriptions-item :label="$t('common.createTime')">{{ info.createTime || '-' }}</el-descriptions-item>
      <el-descriptions-item :label="$t('common.updateTime')">{{ info.updateTime || '-' }}</el-descriptions-item>
      <el-descriptions-item :label="$t('system.user.loginIp')">{{ info.loginIp || '-' }}</el-descriptions-item>
      <el-descriptions-item :label="$t('system.user.loginDate')">{{ info.loginDate || '-' }}</el-descriptions-item>
      <el-descriptions-item :label="$t('common.remark')" :span="2">{{ info.remark || '-' }}</el-descriptions-item>
    </el-descriptions>
  </el-drawer>
</template>

<script setup lang="ts">
import type { PostVO } from '@/api/system/post/types';
import type { RoleVO } from '@/api/system/role/types';
import type { UserVO } from '@/api/system/user/types';
import api from '@/api/system/user';
import { useDict } from '@/utils/dict';
import { selectDictLabel } from '@/utils/ruoyi';

const { sys_normal_disable, sys_user_gender } = toRefs<any>(useDict('sys_normal_disable', 'sys_user_gender'));

const visible = ref(false);
const loading = ref(false);
const info = ref<UserVO | null>(null);
const postOptions = ref<PostVO[]>([]);
const roleOptions = ref<RoleVO[]>([]);
const postIds = ref<string[]>([]);
const roleIds = ref<string[]>([]);

const postNames = computed(() => {
  if (!postOptions.value.length || !postIds.value.length) return '';
  return postOptions.value
    .filter(p => postIds.value.includes(String(p.postId)))
    .map(p => p.postName)
    .join('、');
});

const roleNames = computed(() => {
  if (!roleOptions.value.length || !roleIds.value.length) return '';
  return roleOptions.value
    .filter(r => roleIds.value.includes(String(r.roleId)))
    .map(r => r.roleName)
    .join('、');
});

async function openDrawer(userId: string | number) {
  visible.value = true;
  loading.value = true;
  try {
    const { data } = await api.getUser(userId);
    info.value = data.user;
    postOptions.value = data.posts || [];
    roleOptions.value = data.roles || [];
    postIds.value = (data.postIds || []).map(String);
    roleIds.value = (data.roleIds || []).map(String);
  } catch (error) {
    console.error('获取用户信息失败:', error);
  } finally {
    loading.value = false;
  }
}

defineExpose({ openDrawer });
</script>

<style lang="scss" scoped>
:deep(.el-descriptions__label) {
  min-width: 110px;
}
</style>
