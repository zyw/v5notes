<template>
  <div>
    <el-dropdown trigger="click" @command="handleSetSize">
      <div class="size-icon--style">
        <svg-icon class-name="size-icon" icon-class="size" />
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="item of sizeOptions"
            :key="item.value"
            :disabled="size === item.value"
            :command="item.value"
          >
            {{ item.label }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useAppStore } from '@/store/modules/app';

const appStore = useAppStore();
const { t } = useI18n();
const size = computed(() => appStore.size);

const sizeOptions = computed(() => [
  { label: t('size.large'), value: 'large' as const },
  { label: t('size.default'), value: 'default' as const },
  { label: t('size.small'), value: 'small' as const }
]);

const handleSetSize = (size: 'large' | 'default' | 'small') => {
  appStore.setSize(size);
};
</script>

<style lang="scss" scoped>
.size-icon--style {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;

  :deep(.svg-icon) {
    width: 18px;
    height: 18px;
  }
}
</style>
