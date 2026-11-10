<template>
  <el-form ref="userRef" :model="userForm" :rules="rules" label-width="100px" class="profile-form">
    <el-form-item :label="$t('system.user.nickName')" prop="nickName">
      <el-input v-model="userForm.nickName" maxlength="30" />
    </el-form-item>
    <el-form-item :label="$t('system.user.phone')" prop="phoneNumber">
      <el-input v-model="userForm.phoneNumber" maxlength="11" />
    </el-form-item>
    <el-form-item :label="$t('system.user.email')" prop="email">
      <el-input v-model="userForm.email" maxlength="50" />
    </el-form-item>
    <el-form-item :label="$t('system.profile.gender')">
      <el-radio-group v-model="userForm.gender">
        <el-radio v-for="dict in sys_user_gender" :key="dict.value" :value="dict.value">
          {{ dict.label }}
        </el-radio>
      </el-radio-group>
    </el-form-item>
    <el-form-item class="profile-form__actions">
      <el-button type="primary" @click="submit">{{ $t('common.save') }}</el-button>
      <el-button @click="close">{{ $t('common.close') }}</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { updateUserProfile } from '@/api/system/user';
import type { UserProfileForm } from '@/api/system/user/types';
import modal from '@/plugins/modal';
import tab from '@/plugins/tab';
import { useDict } from '@/utils/dict';
import { propTypes } from '@/utils/propTypes';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { sys_user_gender } = toRefs<any>(useDict('sys_user_gender'));
const props = defineProps({
  user: propTypes.any.isRequired
});
const userForm = computed(() => props.user);
const userRef = ref<ElFormInstance>();
const rules = computed<ElFormRules>(() => ({
  nickName: [{ required: true, message: t('system.user.required', { label: t('system.user.nickName') }), trigger: 'blur' }],
  email: [
    { required: true, message: t('system.profile.emailRequired'), trigger: 'blur' },
    {
      type: 'email',
      message: t('system.user.emailInvalid'),
      trigger: ['blur', 'change']
    }
  ],
  phoneNumber: [
    {
      required: true,
      message: t('system.user.required', { label: t('system.user.phone') }),
      trigger: 'blur'
    },
    {
      pattern: /^1[3456789][0-9]\d{8}$/,
      message: t('system.user.phoneInvalid'),
      trigger: 'blur'
    }
  ]
}));

/** 提交按钮 */
const submit = () => {
  userRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      const profile: UserProfileForm = {
        nickName: props.user.nickName,
        phoneNumber: props.user.phoneNumber,
        email: props.user.email,
        gender: props.user.gender
      };
      await updateUserProfile(profile);
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

/* 标签不换行、右对齐，避免「用户昵称」被拆成两行 */
.profile-form :deep(.el-form-item__label) {
  flex: none;
  white-space: nowrap;
  word-break: keep-all;
  justify-content: flex-end;
}

.profile-form :deep(.el-input__wrapper) {
  border-radius: 12px;
}

.profile-form :deep(.el-radio-group) {
  gap: 16px;
}

.profile-form :deep(.el-button) {
  border-radius: 10px;
}

.profile-form__actions :deep(.el-form-item__content) {
  display: flex;
  gap: 8px;
}
</style>
