/**
 * Catalog 主题种子包（当前只有 Catalog Moss）。
 *
 * 林墨与晚晴已并入 `appearance/themes.ts` 的 builtin，走 shell 变量。
 * 这里的包**不再随应用注入**主题列表：它们只是 catalog 对外提供的安装包，
 * 用户点「安装」后才落盘到 `extensions/themes/`，成为可卸载的目录主题。
 * 每张主题在 `samples/<id>/` 下保留 manifest/theme/theme.json 的物化形态。
 */
import type { CatalogItem } from '../../catalog/types'
import {
  CATALOG_MOSS_CSS,
  CATALOG_MOSS_MANIFEST,
  CATALOG_MOSS_META,
} from './catalogMoss'

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

/** 列表顺序即设置页里的卡片顺序：官方 catalog 示例在前。 */
export const BUNDLED_THEMES: readonly BundledTheme[] = [
  bundledTheme(CATALOG_MOSS_MANIFEST, CATALOG_MOSS_CSS, CATALOG_MOSS_META),
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
