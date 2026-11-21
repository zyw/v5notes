import type { CatalogItem, CatalogListResponse, CatalogPackage } from './types'
import { CATALOG_PROTOCOL_VERSION } from './types'
import { HELLO_WORLD_MAIN_JS, HELLO_WORLD_MANIFEST } from '../plugin-host/samples/helloWorld'
import { SAFE_FETCH_MAIN_JS, SAFE_FETCH_MANIFEST } from '../plugin-host/samples/safeFetch'
import {
  BUNDLED_THEMES,
  bundledThemeFiles,
  bundledThemePackages,
} from '../theme-host/samples/bundled'

/** Offline / no-server fallback catalog (same seeds as backend). */
export function bundledCatalogList(kind?: string): CatalogListResponse {
  let items = BUNDLED_ITEMS
  if (kind) {
    items = items.filter((i) => i.kind === kind)
  }
  return {
    catalogProtocolVersion: CATALOG_PROTOCOL_VERSION,
    fileSyncResource: false,
    items: items.map((i) => ({ ...i })),
  }
}

export function bundledCatalogPackage(id: string): CatalogPackage {
  const pkg = BUNDLED_PACKAGES[id]
  if (!pkg) throw new Error(`本地 catalog 无此条目: ${id}`)
  return {
    catalogProtocolVersion: CATALOG_PROTOCOL_VERSION,
    fileSyncResource: false,
    ...pkg,
  }
}

const BUNDLED_ITEMS: CatalogItem[] = [
  {
    id: HELLO_WORLD_MANIFEST.id,
    name: HELLO_WORLD_MANIFEST.name,
    kind: 'plugin',
    version: HELLO_WORLD_MANIFEST.version,
    description: HELLO_WORLD_MANIFEST.description,
    author: HELLO_WORLD_MANIFEST.author,
    minAppVersion: HELLO_WORLD_MANIFEST.minAppVersion,
    permissions: [...HELLO_WORLD_MANIFEST.permissions],
    packagePath: `/vault/v1/catalog/plugins/${HELLO_WORLD_MANIFEST.id}/package`,
  },
  {
    id: SAFE_FETCH_MANIFEST.id,
    name: SAFE_FETCH_MANIFEST.name,
    kind: 'plugin',
    version: SAFE_FETCH_MANIFEST.version,
    description: SAFE_FETCH_MANIFEST.description,
    author: SAFE_FETCH_MANIFEST.author,
    minAppVersion: SAFE_FETCH_MANIFEST.minAppVersion,
    permissions: [...SAFE_FETCH_MANIFEST.permissions],
    tags: [...SAFE_FETCH_MANIFEST.tags],
    networkAllowlist: [...SAFE_FETCH_MANIFEST.networkAllowlist],
    packagePath: `/vault/v1/catalog/plugins/${SAFE_FETCH_MANIFEST.id}/package`,
  },
  // 主题种子与随应用内置的主题是同一份数据（theme-host/samples/bundled.ts），
  // 这里只负责把它们排进 catalog。
  ...bundledThemePackages(),
]

const BUNDLED_PACKAGES: Record<
  string,
  { id: string; kind: 'plugin' | 'theme'; version: string; files: Record<string, string> }
> = {
  'hello-world': {
    id: 'hello-world',
    kind: 'plugin',
    version: '1.0.0',
    files: {
      'manifest.json': `${JSON.stringify(HELLO_WORLD_MANIFEST, null, 2)}\n`,
      'main.js': HELLO_WORLD_MAIN_JS,
    },
  },
  'safe-fetch-demo': {
    id: 'safe-fetch-demo',
    kind: 'plugin',
    version: '1.0.0',
    files: {
      'manifest.json': `${JSON.stringify(SAFE_FETCH_MANIFEST, null, 2)}\n`,
      'main.js': SAFE_FETCH_MAIN_JS,
    },
  },
  ...Object.fromEntries(
    BUNDLED_THEMES.map((theme) => [
      theme.id,
      {
        id: theme.id,
        kind: 'theme' as const,
        version: theme.version,
        files: bundledThemeFiles(theme),
      },
    ]),
  ),
}
