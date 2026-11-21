/**
 * 随应用内置的主题包（默认 / 暮色之外的那几张）。
 *
 * 与 `appearance/themes.ts` 里的 builtin（默认 / 暮色）合起来就是主题列表的全部
 * 预设：catalog 用同一份数据对外提供种子包，ThemeHost 用同一份数据直接注入，
 * 不用先装进 `extensions/themes/`。每张主题在 `samples/<id>/` 下保留
 * manifest/theme/theme.json 的物化形态，供「装到应用目录」使用。
 */
import type { CatalogItem } from '../../catalog/types'
import {
  CATALOG_MOSS_CSS,
  CATALOG_MOSS_MANIFEST,
  CATALOG_MOSS_META,
} from './catalogMoss'
import { FOREST_INK_CSS, FOREST_INK_MANIFEST, FOREST_INK_META } from './forestInk'
import { WANQING_CSS, WANQING_MANIFEST, WANQING_META } from './wanqing'

interface PackagedThemeManifest {
  id: string
  name: string
  kind: 'theme'
  version: string
  minAppVersion?: string
  description?: string
  author?: string
  permissions?: readonly string[]
  tags?: readonly string[]
  theme?: string
  themeMeta?: string
}

/** One theme shipped with the app: manifest, CSS, and the optional theme.json. */
export interface BundledTheme {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  css: string
  manifest: PackagedThemeManifest
  meta: { modes: readonly string[]; accent: string }
}

function bundledTheme(
  manifest: PackagedThemeManifest,
  css: string,
  meta: BundledTheme['meta'],
): BundledTheme {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    css,
    manifest,
    meta,
  }
}

/** 列表顺序即设置页里的卡片顺序：官方 catalog 示例在前，设计师做的两张在后。 */
export const BUNDLED_THEMES: readonly BundledTheme[] = [
  bundledTheme(CATALOG_MOSS_MANIFEST, CATALOG_MOSS_CSS, CATALOG_MOSS_META),
  bundledTheme(FOREST_INK_MANIFEST, FOREST_INK_CSS, FOREST_INK_META),
  bundledTheme(WANQING_MANIFEST, WANQING_CSS, WANQING_META),
]

/** The theme's package as the catalog serves it (manifest.json + theme.css + theme.json). */
export function bundledThemePackages(): CatalogItem[] {
  return BUNDLED_THEMES.map((theme) => ({
    id: theme.id,
    name: theme.name,
    kind: 'theme',
    version: theme.version,
    description: theme.description,
    author: theme.author,
    minAppVersion: theme.manifest.minAppVersion,
    permissions: [...(theme.manifest.permissions ?? ['ui:theme'])],
    tags: [...(theme.manifest.tags ?? [])],
    packagePath: `/vault/v1/catalog/plugins/${theme.id}/package`,
  }))
}

export function bundledThemeFiles(theme: BundledTheme): Record<string, string> {
  return {
    'manifest.json': `${JSON.stringify(theme.manifest, null, 2)}\n`,
    'theme.css': theme.css,
    'theme.json': `${JSON.stringify(theme.meta, null, 2)}\n`,
  }
}
