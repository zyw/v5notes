<template>
  <el-form ref="pwdRef" :model="user" :rules="rules" label-width="100px" class="profile-form">
    <el-form-item :label="$t('system.profile.oldPassword')" prop="oldPassword">
      <el-input v-model="user.oldPassword" :placeholder="$t('common.pleaseInput', { label: $t('system.profile.oldPassword') })" type="password" show-password />
    </el-form-item>
    <el-form-item :label="$t('system.profile.newPassword')" prop="newPassword">
      <el-input v-model="user.newPassword" :placeholder="$t('common.pleaseInput', { label: $t('system.profile.newPassword') })" type="password" show-password />
    </el-form-item>
    <el-form-item :label="$t('system.profile.confirmPassword')" prop="confirmPassword">
      <el-input v-model="user.confirmPassword" :placeholder="$t('system.profile.confirmPasswordPh')" type="password" show-password />
    </el-form-item>
    <el-form-item class="profile-form__actions">
      <el-button type="primary" @click="submit">{{ $t('common.save') }}</el-button>
      <el-button @click="close">{{ $t('common.close') }}</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import type { ResetPwdForm } from '@/api/system/user/types';
import { updateUserPwd } from '@/api/system/user';
import modal from '@/plugins/modal';
import tab from '@/plugins/tab';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const pwdRef = ref<ElFormInstance>();
const user = ref<ResetPwdForm>({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
});

const equalToPassword = (rule: any, value: string, callback: any) => {
  if (user.value.newPassword !== value) {
    callback(new Error(t('system.profile.passwordMismatch')));
  } else {
    callback();
  }
};
const rules = computed(() => ({
  oldPassword: [{ required: true, message: t('system.profile.required', { label: t('system.profile.oldPassword') }), trigger: 'blur' }],
  newPassword: [
    { required: true, message: t('system.profile.required', { label: t('system.profile.newPassword') }), trigger: 'blur' },
    {
      min: 6,
      max: 20,
      message: t('system.profile.lengthRange'),
      trigger: 'blur'
    },
    {
      pattern: /^[^<>"'|\\]+$/,
      message: t('system.profile.illegalChars'),
      trigger: 'blur'
    }
  ],
  confirmPassword: [
    { required: true, message: t('system.profile.required', { label: t('system.profile.confirmPassword') }), trigger: 'blur' },
    {
      required: true,
      validator: equalToPassword,
      trigger: 'blur'
    }
  ]
}));

/** 提交按钮 */
const submit = () => {
  pwdRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      await updateUserPwd(user.value.oldPassword, user.value.newPassword);
      modal.msgSuccess(t('common.editSuccess'));
    }
  });
};
/** 关闭按钮 */
const close = () => {
  tab.closePage();
};
</script>

<style lang="scss" scoped>
.profile-form {
  max-width: 560px;
  height: 100%;
  overflow-y: auto;
  padding-bottom: 4px;
}

/* 标签不换行，避免「确认密码」被拆行 */
.profile-form :deep(.el-form-item__label) {
  flex: none;
  white-space: nowrap;
  word-break: keep-all;
  justify-content: flex-end;
}

.profile-form :deep(.el-input__wrapper) {
  border-radius: 12px;
}

.profile-form :deep(.el-button) {
  border-radius: 10px;
}

.profile-form__actions :deep(.el-form-item__content) {
  display: flex;
  gap: 8px;
}
</style>
