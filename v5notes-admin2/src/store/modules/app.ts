import { useStorage } from '@vueuse/core';
import enUS from 'element-plus/es/locale/lang/en';
import zhCN from 'element-plus/es/locale/lang/zh-cn';
import zhTW from 'element-plus/es/locale/lang/zh-tw';
import { defineStore } from 'pinia';
import { computed, reactive, ref, watch } from 'vue';
import { VxeUI } from 'vxe-pc-ui';
import vxeEnUS from 'vxe-pc-ui/es/language/en-US';
import vxeZhCN from 'vxe-pc-ui/es/language/zh-CN';
import vxeZhTW from 'vxe-pc-ui/es/language/zh-TW';
import i18n from '@/lang';
import { LanguageEnum } from '@/enums/LanguageEnum';

export const useAppStore = defineStore('app', () => {
  const sidebarStatus = useStorage('sidebarStatus', '1');
  const sidebar = reactive({
    opened: sidebarStatus.value ? !!+sidebarStatus.value : true,
    withoutAnimation: false,
    hide: false
  });
  const device = ref<string>('desktop');
  const size = useStorage<'large' | 'default' | 'small'>('size', 'default');

  // 语言
  const language = useStorage('language', LanguageEnum.zh_CN);
  const languageObj: Record<string, object> = {
    en_US: enUS,
    zh_CN: zhCN,
    zh_TW: zhTW
  };
  const locale = computed(() => languageObj[language.value] || zhCN);

  const htmlLang: Record<string, string> = {
    zh_CN: 'zh-CN',
    zh_TW: 'zh-TW',
    en_US: 'en'
  };
  const vxeLang: Record<string, string> = {
    zh_CN: 'zh-CN',
    zh_TW: 'zh-TW',
    en_US: 'en-US'
  };
  VxeUI.setI18n('zh-CN', vxeZhCN);
  VxeUI.setI18n('zh-TW', vxeZhTW);
  VxeUI.setI18n('en-US', vxeEnUS);

  const applyLanguage = (val: string) => {
    const next = languageObj[val] ? val : LanguageEnum.zh_CN;
    if (language.value !== next) language.value = next;
    i18n.global.locale.value = next as 'zh_CN' | 'zh_TW' | 'en_US';
    VxeUI.setLanguage(vxeLang[next]);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = htmlLang[next];
    }
  };
  applyLanguage(language.value);
  watch(language, applyLanguage);

  const toggleSideBar = (withoutAnimation: boolean) => {
    if (sidebar.hide) {
      return false;
    }

    sidebar.opened = !sidebar.opened;
    sidebar.withoutAnimation = withoutAnimation;
    if (sidebar.opened) {
      sidebarStatus.value = '1';
    } else {
      sidebarStatus.value = '0';
    }
  };

  const closeSideBar = ({ withoutAnimation }: any): void => {
    sidebarStatus.value = '0';
    sidebar.opened = false;
    sidebar.withoutAnimation = withoutAnimation;
  };
  const toggleDevice = (d: string): void => {
    device.value = d;
  };
  const setSize = (s: 'large' | 'default' | 'small'): void => {
    size.value = s;
  };
  const toggleSideBarHide = (status: boolean): void => {
    sidebar.hide = status;
  };

  const changeLanguage = (val: string): void => {
    applyLanguage(val);
  };

  return {
    device,
    sidebar,
    language,
    locale,
    size,
    changeLanguage,
    toggleSideBar,
    closeSideBar,
    toggleDevice,
    setSize,
    toggleSideBarHide
  };
});
