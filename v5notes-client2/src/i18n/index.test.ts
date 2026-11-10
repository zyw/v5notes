import { describe, expect, it } from 'vitest'
import { detectLocale, resolveLocale, t } from '.'
import { i18n } from '.'

describe('locale selection', () => {
  it('keeps a saved choice and otherwise follows the system language', () => {
    expect(resolveLocale('en', 'zh-CN')).toBe('en')
    expect(resolveLocale('zh-TW', 'en-US')).toBe('zh-TW')
    expect(resolveLocale(null, 'zh-HK')).toBe('zh-TW')
    expect(resolveLocale(null, 'zh-Hant-TW')).toBe('zh-TW')
    expect(resolveLocale('', 'zh-CN')).toBe('zh-CN')
    expect(detectLocale('en-GB')).toBe('en')
    expect(detectLocale('fr-FR')).toBe('zh-CN')
  })

  it('translates the active interface language', () => {
    i18n.global.locale.value = 'en'
    expect(t('sidebar.notes')).toBe('Notes')
    expect(t('dialogs.deleteNoteMessage', { name: 'Draft' })).toContain('Draft')
    i18n.global.locale.value = 'zh-TW'
    expect(t('sidebar.trash')).toBe('回收桶')
    i18n.global.locale.value = 'zh-CN'
    expect(t('sidebar.notes')).toBe('笔记')
  })
})
