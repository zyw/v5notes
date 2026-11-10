<template>
  <el-dropdown trigger="click" @command="handleLanguageChange">
    <div class="lang-select--style">
      <svg-icon icon-class="language" />
    </div>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item :disabled="appStore.language === 'zh_CN'" command="zh_CN">简体中文</el-dropdown-item>
        <el-dropdown-item :disabled="appStore.language === 'zh_TW'" command="zh_TW">繁體中文</el-dropdown-item>
        <el-dropdown-item :disabled="appStore.language === 'en_US'" command="en_US">English</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import SvgIcon from '@/components/SvgIcon/index.vue';
import { LanguageEnum } from '@/enums/LanguageEnum';
import { useAppStore } from '@/store/modules/app';

const appStore = useAppStore();
const { t } = useI18n();

const handleLanguageChange = (lang: LanguageEnum) => {
  appStore.changeLanguage(lang);
  ElMessage.success(t('lang.switched'));
};
</script>

<style lang="scss" scoped>
.lang-select--style {
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
