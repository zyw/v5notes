import css from './catalog-moss/theme.css?raw'
import meta from './catalog-moss/theme.json'

/** Bundled Catalog Moss sample theme (mirrors samples/catalog-moss/ for install-to-vault). */
export const CATALOG_MOSS_MANIFEST = {
  id: 'catalog-moss',
  name: 'Catalog Moss',
  kind: 'theme' as const,
  version: '1.0.0',
  minAppVersion: '0.1.0',
  description: '官方 catalog 示例主题（柔和苔绿）',
  author: 'v5notes',
  permissions: ['ui:theme'] as const,
  tags: ['demo', 'theme', 'official'],
  theme: 'theme.css',
  themeMeta: 'theme.json',
}

export const CATALOG_MOSS_CSS = css
export const CATALOG_MOSS_META = meta
