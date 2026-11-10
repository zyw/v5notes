<template>
  <el-drawer
    :model-value="modelValue"
    :size="size"
    :with-header="false"
    :close-on-click-modal="false"
    append-to-body
    class="form-drawer"
    @update:model-value="onVisibleChange"
    @closed="$emit('closed')"
  >
    <div class="fd-shell">
      <header class="fd-header" :class="{ 'fd-header--hero': !!$slots.hero }">
        <slot name="hero">
          <div class="fd-heading">
            <div v-if="eyebrow" class="fd-eyebrow">{{ eyebrow }}</div>
            <h2 class="fd-title">{{ title }}</h2>
            <p v-if="subtitle" class="fd-subtitle">{{ subtitle }}</p>
          </div>
        </slot>
        <button class="fd-close" type="button" :aria-label="$t('common.close')" @click="close">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>

      <div class="fd-body">
        <slot />
      </div>

      <footer class="fd-footer">
        <div class="fd-hint">
          <slot name="hint">
            <template v-if="hint"><i class="fd-hint__dot"></i>{{ hint }}</template>
          </slot>
        </div>
        <div class="fd-actions">
          <slot name="footer">
            <el-button @click="close">{{ $t('common.cancel') }}</el-button>
            <el-button type="primary" :loading="submitting" @click="$emit('submit')">
              {{ submitText || $t('widgets.formDrawer.saveChanges') }}
            </el-button>
          </slot>
        </div>
      </footer>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    subtitle?: string;
    eyebrow?: string;
    hint?: string;
    size?: string | number;
    submitText?: string;
    submitting?: boolean;
  }>(),
  {
    title: '',
    subtitle: '',
    eyebrow: '',
    hint: '',
    size: '680px',
    submitText: '',
    submitting: false
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit'): void;
  (e: 'closed'): void;
}>();

const onVisibleChange = (value: boolean) => emit('update:modelValue', value);
const close = () => emit('update:modelValue', false);
</script>

<style scoped lang="scss">
.form-drawer {
  :deep(.el-drawer__body) {
    padding: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
}

.fd-shell {
  --fd-accent: #1c5a48;
  --fd-accent-deep: #0f3d33;
  --fd-border: #e8ecea;
  --fd-muted: #8a978f;

  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}

.fd-header {
  position: relative;
  flex: none;
  padding: 24px 28px 18px;
  border-bottom: 1px solid #eef1ef;
  background: #fff;
}

.fd-header--hero {
  padding: 0;
  border-bottom: 0;
}

.fd-heading {
  padding-right: 40px;
}

.fd-eyebrow {
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--fd-accent);
}

.fd-title {
  margin: 0 0 5px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #111827;
}

.fd-subtitle {
  margin: 0;
  font-size: 12.5px;
  color: var(--fd-muted);
}

.fd-close {
  position: absolute;
  top: 18px;
  right: 20px;
  z-index: 2;
  width: 34px;
  height: 34px;
  border: 1px solid #e7eaf0;
  border-radius: 10px;
  background: #fff;
  color: #7b8494;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: 0.15s ease;
}

.fd-close:hover {
  background: #f6f8f7;
  color: #1f2937;
}

.fd-header--hero .fd-close {
  border-color: rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.fd-header--hero .fd-close:hover {
  background: rgba(255, 255, 255, 0.16);
}

.fd-body {
  flex: 1;
  overflow-y: auto;
  padding: 22px 28px 16px;
  background: #fbfcfb;
}

.fd-footer {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 15px 28px 17px;
  border-top: 1px solid #e9ecea;
  background: #fff;
}

.fd-hint {
  min-width: 0;
  font-size: 12px;
  color: #94a29a;
}

.fd-hint__dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 7px;
  border-radius: 50%;
  background: #e0a93b;
  vertical-align: 1px;
}

.fd-actions {
  display: flex;
  gap: 10px;
}

.fd-actions :deep(.el-button) {
  height: 40px;
  min-width: 92px;
  border-radius: 10px;
  font-weight: 600;
}

.fd-actions :deep(.el-button--primary) {
  color: #fff;
  background-color: #1c5a48;
  border-color: #1c5a48;
  box-shadow: 0 8px 18px rgba(28, 90, 72, 0.22);
}

.fd-actions :deep(.el-button--primary:hover),
.fd-actions :deep(.el-button--primary:focus) {
  color: #fff;
  background-color: #236a55;
  border-color: #236a55;
}
</style>
