<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? $t('vault.quota.editOverride') : $t('vault.quota.addOverride')"
    width="520px"
    append-to-body
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="136px">
      <el-form-item :label="$t('vault.quota.user')" prop="userId">
        <el-input v-if="isEdit" :model-value="editingUserLabel" disabled />
        <el-select
          v-else
          v-model="form.userId"
          filterable
          remote
          :remote-method="searchUsers"
          :loading="userLoading"
          :placeholder="$t('vault.quota.userPh')"
          style="width: 100%"
        >
          <el-option
            v-for="u in userOptions"
            :key="String(u.userId)"
            :label="formatUserLabel(u)"
            :value="String(u.userId)"
          />
        </el-select>
      </el-form-item>

      <el-form-item :label="$t('vault.quota.quotaMb')">
        <el-input-number
          v-model="form.quotaMb"
          :min="10"
          :step="128"
          controls-position="right"
          :placeholder="$t('vault.quota.inheritDefaultPh')"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item :label="$t('vault.quota.replicaLimit')">
        <el-input-number
          v-model="form.replicaLimit"
          :min="1"
          :max="50"
          controls-position="right"
          :placeholder="$t('vault.quota.inheritDefaultPh')"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item :label="$t('vault.quota.maxFileMb')">
        <el-input-number
          v-model="form.maxFileMb"
          :min="1"
          :max="maxFileLimitMb"
          controls-position="right"
          :placeholder="$t('vault.quota.inheritDefaultPh')"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item :label="$t('vault.quota.planName')">
        <el-input v-model="form.planName" :placeholder="$t('vault.quota.planNamePh')" maxlength="64" clearable />
      </el-form-item>

      <el-form-item :label="$t('vault.quota.expireTime')">
        <el-date-picker
          v-model="form.expireTime"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          :placeholder="$t('vault.quota.expireTimePh')"
          clearable
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item :label="$t('vault.quota.remark')">
        <el-input v-model="form.remark" maxlength="255" clearable />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">{{ $t('common.confirm') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { listUser } from '@/api/system/user';
import type { UserVO } from '@/api/system/user/types';
import { saveVaultUserQuota } from '@/api/vault/quota';
import type { VaultAdminUserQuota } from '@/api/vault/quota/types';

const props = defineProps<{
  modelValue: boolean;
  editing: VaultAdminUserQuota | null;
  multipartMaxFileBytes: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved'): void;
}>();

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const formRef = ref<ElFormInstance>();
const submitting = ref(false);
const userLoading = ref(false);
const userOptions = ref<UserVO[]>([]);

const form = ref<{
  userId: string;
  quotaMb: number | undefined;
  replicaLimit: number | undefined;
  maxFileMb: number | undefined;
  planName: string;
  expireTime: string | null;
  remark: string;
}>({
  userId: '',
  quotaMb: undefined,
  replicaLimit: undefined,
  maxFileMb: undefined,
  planName: '',
  expireTime: null,
  remark: ''
});

const isEdit = computed(() => Boolean(props.editing));
const maxFileLimitMb = computed(() => Math.max(1, Math.floor((props.multipartMaxFileBytes || 25 * 1024 * 1024) / (1024 * 1024))));

const editingUserLabel = computed(() => {
  if (!props.editing) return '';
  if (props.editing.nickName && props.editing.userName) {
    return `${props.editing.nickName} (${props.editing.userName})`;
  }
  return props.editing.nickName || props.editing.userName || props.editing.userId;
});

const rules = computed(() => ({
  userId: [{ required: true, message: t('vault.quota.userRequired'), trigger: 'change' }]
}));

const formatUserLabel = (u: UserVO) => {
  if (u.nickName && u.nickName !== u.userName) {
    return `${u.nickName} (${u.userName})`;
  }
  return u.userName;
};

const searchUsers = async (query: string) => {
  userLoading.value = true;
  try {
    const res = await listUser({ pageNum: 1, pageSize: 30, userName: query || undefined });
    userOptions.value = (res as any).rows || (res as any).data?.rows || [];
  } finally {
    userLoading.value = false;
  }
};

const submit = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitting.value = true;
  try {
    await saveVaultUserQuota(form.value.userId, {
      quotaBytes: form.value.quotaMb != null ? Math.round(form.value.quotaMb * 1024 * 1024) : null,
      replicaLimit: form.value.replicaLimit ?? null,
      maxFileBytes: form.value.maxFileMb != null ? Math.round(form.value.maxFileMb * 1024 * 1024) : null,
      planName: form.value.planName.trim() || null,
      expireTime: form.value.expireTime || null,
      remark: form.value.remark.trim() || null
    });
    proxy?.$modal.msgSuccess(t('vault.quota.saveSuccess'));
    emit('update:modelValue', false);
    emit('saved');
  } finally {
    submitting.value = false;
  }
};

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    if (props.editing) {
      form.value = {
        userId: props.editing.userId,
        quotaMb: props.editing.quotaBytes != null ? Math.round(props.editing.quotaBytes / (1024 * 1024)) : undefined,
        replicaLimit: props.editing.replicaLimit ?? undefined,
        maxFileMb: props.editing.maxFileBytes != null ? Math.round(props.editing.maxFileBytes / (1024 * 1024)) : undefined,
        planName: props.editing.planName || '',
        expireTime: props.editing.expireTime || null,
        remark: props.editing.remark || ''
      };
    } else {
      form.value = {
        userId: '',
        quotaMb: undefined,
        replicaLimit: undefined,
        maxFileMb: undefined,
        planName: '',
        expireTime: null,
        remark: ''
      };
      searchUsers('');
    }
  }
);
</script>
