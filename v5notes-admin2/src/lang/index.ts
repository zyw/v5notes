import { createI18n } from 'vue-i18n';
import { LanguageEnum } from '@/enums/LanguageEnum';
import en_US from '@/lang/en_US';
import zh_CN from '@/lang/zh_CN';
import zh_TW from '@/lang/zh_TW';

const LOCALES = [LanguageEnum.zh_CN, LanguageEnum.zh_TW, LanguageEnum.en_US];

export const getLanguage = (): LanguageEnum => {
  const language = useStorage<string>('language', LanguageEnum.zh_CN);
  if (LOCALES.includes(language.value as LanguageEnum)) {
    return language.value as LanguageEnum;
  }
  return LanguageEnum.zh_CN;
};

const i18n = createI18n({
  globalInjection: true,
  allowComposition: true,
  legacy: false,
  locale: getLanguage(),
  fallbackLocale: LanguageEnum.zh_CN,
  messages: {
    zh_CN,
    zh_TW,
    en_US
  }
});

export function t(key: string, values?: Record<string, unknown>): string {
  return i18n.global.t(key, values ?? {});
}

type LocaleMessages = { menu?: Record<string, string>; dict?: Record<string, string> };

export function translateLabel(group: 'menu' | 'dict', text?: string): string {
  if (!text) return '';
  const messages = i18n.global.getLocaleMessage(i18n.global.locale.value) as LocaleMessages;
  return messages[group]?.[text] || text;
}

/**
 * 翻译路由和菜单标题。内置中文名称走菜单对照，已有 route.* 键走语言包，其余保持原文。
 */
export const translateRouteTitle = (title?: string): string => {
  if (!title) return '';
  const menuTitle = translateLabel('menu', title);
  if (menuTitle !== title) return menuTitle;
  if (i18n.global.te('route.' + title)) {
    return i18n.global.t('route.' + title);
  }
  return title;
};

export default i18n;

export type LanguageType = typeof zh_CN;
