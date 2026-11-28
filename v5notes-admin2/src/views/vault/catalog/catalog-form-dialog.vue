<template>
  <FormDrawer
    :model-value="modelValue"
    :title="isEdit ? $t('vault.catalog.editTitle') : $t('vault.catalog.addTitle')"
    size="720px"
    :hint="$t('system.user.requiredHint')"
    :submitting="submitting"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="submit"
  >
    <template #hero>
      <div class="catalog-hero">
        <div class="catalog-hero__top">
          <span class="catalog-hero__brand"><img :src="logoUrl" alt="" />V5Notes {{ $t('vault.catalog.title') }}</span>
          <span class="catalog-hero__divider">·</span>
          <span class="catalog-hero__action">{{ isEdit ? $t('vault.catalog.editTitle') : $t('vault.catalog.addTitle') }}</span>
        </div>
        <div class="catalog-hero__profile">
          <div class="catalog-hero__avatar">{{ avatarText }}</div>
          <div class="catalog-hero__info">
            <div class="catalog-hero__name">{{ heroName }}</div>
            <div class="catalog-hero__meta">
              <span class="catalog-hero__tag">{{ form.kind === 'theme' ? $t('vault.catalog.kindTheme') : $t('vault.catalog.kindPlugin') }}</span>
              <span v-if="form.version">v{{ form.version }}</span>
            </div>
          </div>
          <el-upload
            class="catalog-hero__upload"
            :show-file-list="false"
            accept=".zip"
            :http-request="handleZipUpload"
          >
            <el-button class="catalog-hero__zip-btn" icon="Upload" :loading="parsingZip">
              {{ $t('vault.catalog.uploadZip') }}
            </el-button>
          </el-upload>
        </div>
      </div>
    </template>

    <div v-loading="loading" class="catalog-drawer-content">
      <el-alert
        v-for="(w, idx) in warnings"
        :key="idx"
        :title="w"
        type="warning"
        show-icon
        :closable="false"
      />

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="catalog-form">
        <section class="form-section">
          <h4>{{ $t('common.basicInfo') }}</h4>
          <el-row :gutter="18">
            <el-col :span="12">
              <el-form-item :label="$t('vault.catalog.id')" prop="id">
                <el-input v-model="form.id" :disabled="isEdit" placeholder="my-plugin" maxlength="64" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('vault.catalog.name')" prop="name">
                <el-input v-model="form.name" maxlength="100" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('vault.catalog.kind')" prop="kind">
                <el-select v-model="form.kind" style="width: 100%" @change="onKindChange">
                  <el-option :label="$t('vault.catalog.kindPlugin')" value="plugin" />
                  <el-option :label="$t('vault.catalog.kindTheme')" value="theme" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('vault.catalog.version')" prop="version">
                <el-input v-model="form.version" placeholder="1.0.0" maxlength="32" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('vault.catalog.minAppVersion')">
                <el-input v-model="form.minAppVersion" placeholder="0.1.0" maxlength="32" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('vault.catalog.sortOrder')">
                <el-input-number v-model="form.sortOrder" :min="0" :max="9999" controls-position="right" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('vault.catalog.author')">
                <el-input v-model="form.author" maxlength="100" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('vault.catalog.authorUrl')">
                <el-input v-model="form.authorUrl" maxlength="255" />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item :label="$t('vault.catalog.description')" class="mb-0">
                <el-input v-model="form.description" maxlength="500" />
              </el-form-item>
            </el-col>
          </el-row>
        </section>

        <section class="form-section">
          <h4>{{ $t('vault.catalog.permSection') }}</h4>
          <el-row :gutter="18">
            <el-col :span="12">
              <el-form-item :label="$t('vault.catalog.permissions')" :class="{ 'mb-0': !form.permissions.includes('network:safe') }">
                <el-select v-model="form.permissions" multiple filterable style="width: 100%">
                  <el-option v-for="perm in availablePermissions" :key="perm" :label="perm" :value="perm" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="$t('vault.catalog.tags')" :class="{ 'mb-0': !form.permissions.includes('network:safe') }">
                <el-input v-model="tagsText" :placeholder="$t('vault.catalog.tagsPh')" />
              </el-form-item>
            </el-col>
            <el-col v-if="form.permissions.includes('network:safe')" :span="24">
              <el-form-item :label="$t('vault.catalog.networkAllowlist')" class="mb-0">
                <el-input
                  v-model="allowlistText"
                  type="textarea"
                  :rows="2"
                  :placeholder="$t('vault.catalog.allowlistPh')"
                />
              </el-form-item>
            </el-col>
          </el-row>
        </section>

        <section class="form-section">
          <div class="files-header">
            <h4>{{ $t('vault.catalog.files') }}</h4>
            <div class="files-add">
              <el-input
                v-model="newFileName"
                size="small"
                :placeholder="$t('vault.catalog.fileNamePh')"
                style="width: 190px"
                @keyup.enter="addFileTab"
              />
              <el-button size="small" icon="Plus" @click="addFileTab">{{ $t('vault.catalog.addFile') }}</el-button>
            </div>
          </div>

          <el-tabs v-model="activeFile" type="card" class="files-tabs" @tab-remove="removeFileTab">
            <el-tab-pane
              v-for="name in fileNames"
              :key="name"
              :label="name"
              :name="name"
              :closable="name !== 'manifest.json'"
            >
              <el-input
                v-model="form.files[name]"
                type="textarea"
                :rows="11"
                class="code-textarea"
              />
            </el-tab-pane>
          </el-tabs>
        </section>
      </el-form>
    </div>
  </FormDrawer>
</template>

<script setup lang="ts">
import type { UploadRequestOptions } from 'element-plus';
import { useI18n } from 'vue-i18n';
import logoUrl from '@/assets/logo/logo.png';
import FormDrawer from '@/components/FormDrawer/index.vue';
import {
  createVaultCatalog,
  getVaultCatalogDetail,
  parseVaultCatalogZip,
  updateVaultCatalog
} from '@/api/vault/catalog';
import type { CatalogKind } from '@/api/vault/catalog/types';

const PLUGIN_PERMISSIONS = [
  'vault:read',
  'vault:write',
  'ui:commands',
  'ui:ribbon',
  'ui:status',
  'ui:settings',
  'ui:views',
  'ui:theme',
  'editor:extend',
  'editor:provide',
  'clipboard',
  'network:safe'
];

const THEME_PERMISSIONS = ['ui:theme', 'ui:settings', 'ui:commands'];

const props = defineProps<{
  modelValue: boolean;
  editingId: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved'): void;
}>();

const { t } = useI18n();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const formRef = ref<ElFormInstance>();
const loading = ref(false);
const parsingZip = ref(false);
const submitting = ref(false);
const warnings = ref<string[]>([]);
const activeFile = ref('main.js');
const newFileName = ref('');
const tagsText = ref('');
const allowlistText = ref('');

const createEmptyForm = () => ({
  id: '',
  name: '',
  kind: 'plugin' as CatalogKind,
  version: '1.0.0',
  minAppVersion: '0.1.0',
  description: '',
  author: 'v5notes',
  authorUrl: '',
  permissions: ['ui:commands'] as string[],
  sortOrder: 0,
  files: {
    'manifest.json': '{}',
    'main.js': 'module.exports = class CustomPlugin extends Plugin {\n  async onload() {}\n}\n'
  } as Record<string, string>
});

const form = ref(createEmptyForm());

const isEdit = computed(() => Boolean(props.editingId));
const heroName = computed(() => form.value.name.trim() || (isEdit.value ? t('vault.catalog.editTitle') : t('vault.catalog.addTitle')));
const avatarText = computed(() => {
  const src = form.value.name.trim() || form.value.id.trim();
  if (src) return src.slice(0, 1).toUpperCase();
  return form.value.kind === 'theme' ? 'T' : 'P';
});
const fileNames = computed(() => Object.keys(form.value.files));
const availablePermissions = computed(() => (form.value.kind === 'theme' ? THEME_PERMISSIONS : PLUGIN_PERMISSIONS));

const rules = computed(() => ({
  id: [
    { required: true, message: t('vault.catalog.idRequired'), trigger: 'blur' },
    { pattern: /^[a-z0-9-]+$/, message: t('vault.catalog.idRequired'), trigger: 'blur' }
  ],
  name: [{ required: true, message: t('vault.catalog.nameRequired'), trigger: 'blur' }],
  version: [{ required: true, message: t('vault.catalog.versionRequired'), trigger: 'blur' }]
}));

const splitTokens = (text: string) =>
  text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

const onKindChange = (kind: string) => {
  if (kind === 'theme') {
    form.value.permissions = form.value.permissions.filter((p) => THEME_PERMISSIONS.includes(p));
    if (form.value.permissions.length === 0) form.value.permissions = ['ui:theme'];
    if (!form.value.files['theme.css']) {
      form.value.files['theme.css'] = `:root[data-community-theme='${form.value.id || 'custom-theme'}'] {\n  --bg: #f5f7f4;\n  --panel: #ffffff;\n  --ink: #1f2a22;\n  --muted: #5c6b60;\n  --line: #d5e0d6;\n  --accent: #3d6b4f;\n}\n`;
    }
    activeFile.value = 'theme.css';
  } else {
    if (!form.value.files['main.js']) {
      form.value.files['main.js'] = 'module.exports = class CustomPlugin extends Plugin {\n  async onload() {}\n}\n';
    }
    activeFile.value = 'main.js';
  }
};

const addFileTab = () => {
  const name = newFileName.value.trim();
  if (!name || name === '.' || name === '..' || name.startsWith('.') || name.includes('/') || name.includes('\\')) {
    proxy?.$modal.msgWarning(t('vault.catalog.invalidFileName'));
    return;
  }
  if (form.value.files[name] !== undefined) {
    proxy?.$modal.msgWarning(t('vault.catalog.fileExists'));
    activeFile.value = name;
    return;
  }
  form.value.files[name] = '';
  activeFile.value = name;
  newFileName.value = '';
};

const removeFileTab = (name: string | number) => {
  const key = String(name);
  if (key === 'manifest.json') return;
  delete form.value.files[key];
  const rest = Object.keys(form.value.files);
  activeFile.value = rest[0] || '';
};

const handleZipUpload = async (options: UploadRequestOptions) => {
  parsingZip.value = true;
  try {
    const res = await parseVaultCatalogZip(options.file as File);
    const d = res.data;
    if (!isEdit.value) {
      form.value.id = d.id;
    }
    form.value.name = d.name;
    form.value.kind = (d.kind === 'theme' ? 'theme' : 'plugin') as CatalogKind;
    form.value.version = d.version;
    form.value.minAppVersion = d.minAppVersion || '0.1.0';
    form.value.description = d.description || '';
    form.value.author = d.author || '';
    form.value.authorUrl = d.authorUrl || '';
    form.value.permissions = [...(d.permissions || [])];
    tagsText.value = (d.tags || []).join(', ');
    allowlistText.value = (d.networkAllowlist || []).join('\n');
    form.value.files = d.files ? { ...d.files } : {};
    warnings.value = d.warnings || [];
    activeFile.value = form.value.files['main.js'] != null ? 'main.js' : form.value.files['theme.css'] != null ? 'theme.css' : 'manifest.json';
    proxy?.$modal.msgSuccess(t('vault.catalog.zipParsed'));
  } finally {
    parsingZip.value = false;
  }
};

const submit = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitting.value = true;
  try {
    const payload = {
      id: form.value.id.trim(),
      name: form.value.name.trim(),
      kind: form.value.kind,
      version: form.value.version.trim(),
      minAppVersion: form.value.minAppVersion.trim() || '0.1.0',
      description: form.value.description.trim() || undefined,
      author: form.value.author.trim() || undefined,
      authorUrl: form.value.authorUrl.trim() || undefined,
      permissions: form.value.permissions,
      networkAllowlist: form.value.permissions.includes('network:safe') ? splitTokens(allowlistText.value) : [],
      tags: splitTokens(tagsText.value),
      files: form.value.files,
      sortOrder: form.value.sortOrder
    };
    if (isEdit.value && props.editingId) {
      await updateVaultCatalog(props.editingId, payload);
    } else {
      await createVaultCatalog(payload);
    }
    proxy?.$modal.msgSuccess(t('vault.catalog.saveSuccess'));
    emit('update:modelValue', false);
    emit('saved');
  } finally {
    submitting.value = false;
  }
};

watch(
  () => [props.modelValue, props.editingId] as const,
  async ([open, editingId]) => {
    if (!open) return;
    warnings.value = [];
    newFileName.value = '';
    if (!editingId) {
      form.value = createEmptyForm();
      tagsText.value = '';
      allowlistText.value = '';
      activeFile.value = 'main.js';
      return;
    }
    loading.value = true;
    try {
      const res = await getVaultCatalogDetail(editingId);
      const d = res.data;
      form.value = {
        id: d.id,
        name: d.name,
        kind: (d.kind === 'theme' ? 'theme' : 'plugin') as CatalogKind,
        version: d.version,
        minAppVersion: d.minAppVersion || '0.1.0',
        description: d.description || '',
        author: d.author || '',
        authorUrl: d.authorUrl || '',
        permissions: [...(d.permissions || [])],
        sortOrder: d.sortOrder ?? 0,
        files: d.files ? { ...d.files } : {}
      };
      tagsText.value = (d.tags || []).join(', ');
      allowlistText.value = (d.networkAllowlist || []).join('\n');
      warnings.value = d.warnings || [];
      activeFile.value = form.value.files['main.js'] != null ? 'main.js' : form.value.files['theme.css'] != null ? 'theme.css' : Object.keys(form.value.files)[0] || '';
    } finally {
      loading.value = false;
    }
  }
);
</script>

<style scoped lang="scss">
.catalog-hero {
  position: relative;
  overflow: hidden;
  padding: 24px 28px;
  color: #fff;
  background: linear-gradient(148deg, #0f3d33 0%, #1c5a48 70%, #256a55 100%);
}

.catalog-hero::after {
  content: '';
  position: absolute;
  top: -130px;
  right: -90px;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
}

.catalog-hero__top {
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

.catalog-hero__brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  img {
    width: 22px;
    height: 22px;
    border-radius: 6px;
  }
}

.catalog-hero__divider {
  color: rgba(223, 241, 232, 0.5);
}

.catalog-hero__action {
  color: #c9e4d7;
}

.catalog-hero__profile {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 15px;
  margin-top: 24px;
}

.catalog-hero__avatar {
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

.catalog-hero__info {
  min-width: 0;
  flex: 1;
}

.catalog-hero__name {
  margin-bottom: 7px;
  font-size: 21px;
  font-weight: 700;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.catalog-hero__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #c9e4d7;
}

.catalog-hero__tag {
  padding: 4px 9px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  color: #eafff5;
  font-size: 11.5px;
  font-weight: 700;
}

.catalog-hero__upload {
  flex: none;
}

.catalog-hero__zip-btn {
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  border-radius: 10px;
  font-weight: 600;

  &:hover,
  &:focus {
    border-color: rgba(255, 255, 255, 0.45);
    background: rgba(255, 255, 255, 0.22);
    color: #fff;
  }
}

.catalog-drawer-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.catalog-form {
  :deep(.el-form-item) {
    margin-bottom: 16px;
  }

  :deep(.el-form-item__label) {
    padding-bottom: 6px;
    line-height: 1.3;
    font-size: 12.5px;
    font-weight: 600;
    color: #3f4a44;
  }

  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper),
  :deep(.el-textarea__inner) {
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 0 0 1px #dfe5e1 inset;
  }

  :deep(.el-input__wrapper:hover),
  :deep(.el-select__wrapper:hover) {
    box-shadow: 0 0 0 1px #b9c9c1 inset;
  }

  :deep(.mb-0) {
    margin-bottom: 0;
  }
}

.form-section {
  padding: 0 0 15px;
  margin-bottom: 18px;
  border-bottom: 1px solid #edf0ef;

  &:last-child {
    padding-bottom: 0;
    margin-bottom: 0;
    border-bottom: 0;
  }

  h4 {
    margin: 0 0 13px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: #6b7d74;
  }
}

.files-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 13px;

  h4 {
    margin: 0;
  }
}

.files-add {
  display: flex;
  align-items: center;
  gap: 6px;
}

.files-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 10px;
  }
}

.code-textarea :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.55;
  background: #fff;
  border-radius: 10px;
}
</style>
