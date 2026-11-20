/** Bundled 晚晴 sample theme (mirrors samples/wanqing/). */
import css from './wanqing/theme.css?raw'

export const WANQING_MANIFEST = {
  id: 'wanqing',
  name: '晚晴',
  kind: 'theme' as const,
  version: '1.0.0',
  minAppVersion: '0.1.0',
  description: '暖纸底 + 靛蓝强调，深色为夜蓝',
  author: 'v5notes',
  permissions: ['ui:theme'] as const,
  theme: 'theme.css',
  themeMeta: 'theme.json',
}

export const WANQING_CSS = css
