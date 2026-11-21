import type { CatalogItem, CatalogListResponse, CatalogPackage } from './types'
import { CATALOG_PROTOCOL_VERSION } from './types'
import { SAFE_FETCH_MAIN_JS, SAFE_FETCH_MANIFEST } from '../plugin-host/samples/safeFetch'

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
  {
    id: 'catalog-moss',
    name: 'Catalog Moss',
    kind: 'theme',
    version: '1.0.0',
    description: '官方 catalog 示例主题（柔和苔绿）',
    author: 'v5notes',
    minAppVersion: '0.1.0',
    permissions: ['ui:theme'],
    tags: ['demo', 'theme', 'official'],
    packagePath: '/vault/v1/catalog/plugins/catalog-moss/package',
  },
]

const BUNDLED_PACKAGES: Record<
  string,
  { id: string; kind: 'plugin' | 'theme'; version: string; files: Record<string, string> }
> = {
  'safe-fetch-demo': {
    id: 'safe-fetch-demo',
    kind: 'plugin',
    version: '1.0.0',
    files: {
      'manifest.json': `${JSON.stringify(SAFE_FETCH_MANIFEST, null, 2)}\n`,
      'main.js': SAFE_FETCH_MAIN_JS,
    },
  },
  'catalog-moss': {
    id: 'catalog-moss',
    kind: 'theme',
    version: '1.0.0',
    files: {
      'manifest.json': `${JSON.stringify(
        {
          id: 'catalog-moss',
          name: 'Catalog Moss',
          kind: 'theme',
          version: '1.0.0',
          minAppVersion: '0.1.0',
          description: '官方 catalog 示例主题（柔和苔绿）',
          author: 'v5notes',
          permissions: ['ui:theme'],
          tags: ['demo', 'theme', 'official'],
          theme: 'theme.css',
        },
        null,
        2,
      )}\n`,
      'theme.css': `/* Catalog Moss 的每条规则都必须限定到本主题：注入的社区主题 CSS
 * 叠在应用外壳之上，裸 :root 会让配色泄漏到其它主题。 */
:root[data-community-theme='catalog-moss'] {
  --bg: #f3f6f1;
  --panel: #fbfdfa;
  --ink: #1e2a22;
  --muted: #5c6b60;
  --line: #d5e0d6;
  --accent: #3d6b4f;
  --accent-hover: #31573f;
  --surface: #e9efe9;
  --danger: #8a3b2e;
  --danger-bg: #f3e4e0;
  --bg-glow-a: #e6eee7;
  --bg-glow-b: #f0f5f0;
  --vault: #3d6b4f !important;
}

:root[data-community-theme='catalog-moss'][data-color-mode='dark'] {
  --bg: #141b16;
  --panel: #1c2620;
  --ink: #e3ece5;
  --muted: #93a496;
  --line: #2e3b32;
  --accent: #7cb08c;
  --accent-hover: #97c5a5;
  --surface: #232e26;
  --danger: #e0a090;
  --danger-bg: #3a2a26;
  --bg-glow-a: #1a221c;
  --bg-glow-b: #151c17;
  --vault: #7cb08c !important;
}

:root[data-community-theme='catalog-moss'][data-color-preference='dark']:not([data-color-mode='dark']) {
  --bg: #141b16;
  --panel: #1c2620;
  --ink: #e3ece5;
  --muted: #93a496;
  --line: #2e3b32;
  --accent: #7cb08c;
  --accent-hover: #97c5a5;
  --surface: #232e26;
  --danger: #e0a090;
  --danger-bg: #3a2a26;
  --bg-glow-a: #1a221c;
  --bg-glow-b: #151c17;
  --vault: #7cb08c !important;
}
`,
    },
  },
}
