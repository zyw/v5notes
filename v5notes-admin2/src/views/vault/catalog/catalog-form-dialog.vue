<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? $t('vault.catalog.editTitle') : $t('vault.catalog.addTitle')"
    width="860px"
    top="5vh"
    append-to-body
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="loading">
      <div class="dialog-top-actions">
        <el-upload
          :show-file-list="false"
          accept=".zip"
          :http-request="handleZipUpload"
        >
          <el-button type="primary" plain icon="Upload" :loading="parsingZip">
            {{ $t('vault.catalog.uploadZip') }}
          </el-button>
        </el-upload>
      </div>

      <el-alert
        v-for="(w, idx) in warnings"
        :key="idx"
        :title="w"
        type="warning"
        show-icon
        :closable="false"
        class="mb-2"
      />

      <el-form ref="formRef" :model="form" :rules="rules" label-width="116px">
        <el-row :gutter="14">
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
          <el-col :span="8">
            <el-form-item :label="$t('vault.catalog.kind')" prop="kind">
              <el-select v-model="form.kind" style="width: 100%" @change="onKindChange">
                <el-option :label="$t('vault.catalog.kindPlugin')" value="plugin" />
                <el-option :label="$t('vault.catalog.kindTheme')" value="theme" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="$t('vault.catalog.version')" prop="version">
              <el-input v-model="form.version" placeholder="1.0.0" maxlength="32" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="$t('vault.catalog.minAppVersion')">
              <el-input v-model="form.minAppVersion" placeholder="0.1.0" maxlength="32" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="$t('vault.catalog.author')">
              <el-input v-model="form.author" maxlength="100" />
            </el-form-item>
          </el-col>
          <el-col :span="10">
            <el-form-item :label="$t('vault.catalog.authorUrl')">
              <el-input v-model="form.authorUrl" maxlength="255" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item :label="$t('vault.catalog.sortOrder')">
              <el-input-number v-model="form.sortOrder" :min="0" :max="9999" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item :label="$t('vault.catalog.description')">
              <el-input v-model="form.description" maxlength="500" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="$t('vault.catalog.permissions')">
              <el-select v-model="form.permissions" multiple filterable style="width: 100%">
                <el-option v-for="perm in availablePermissions" :key="perm" :label="perm" :value="perm" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="$t('vault.catalog.tags')">
              <el-input v-model="tagsText" :placeholder="$t('vault.catalog.tagsPh')" />
            </el-form-item>
          </el-col>
          <el-col v-if="form.permissions.includes('network:safe')" :span="24">
            <el-form-item :label="$t('vault.catalog.networkAllowlist')">
              <el-input
                v-model="allowlistText"
                type="textarea"
                :rows="2"
                :placeholder="$t('vault.catalog.allowlistPh')"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <div class="files-header">
          <span class="files-title">{{ $t('vault.catalog.files') }}</span>
          <div class="files-add">
            <el-input
              v-model="newFileName"
              size="small"
              :placeholder="$t('vault.catalog.fileNamePh')"
              style="width: 180px"
              @keyup.enter="addFileTab"
            />
            <el-button size="small" icon="Plus" @click="addFileTab">{{ $t('vault.catalog.addFile') }}</el-button>
          </div>
        </div>

        <el-tabs v-model="activeFile" type="card" @tab-remove="removeFileTab">
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
      </el-form>
    </div>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ $t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">{{ $t('common.confirm') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { UploadRequestOptions } from 'element-plus';
import { useI18n } from 'vue-i18n';
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
    form.value.files = { ...(d.files || {}) };
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
        files: { ...(d.files || {}) }
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
.dialog-top-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.files-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 4px 0 8px;
}

.files-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.files-add {
  display: flex;
  align-items: center;
  gap: 6px;
}

.code-textarea :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.5;
}
</style>
