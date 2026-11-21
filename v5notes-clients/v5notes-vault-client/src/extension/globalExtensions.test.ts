import { describe, expect, it } from 'vitest'
import { createMemoryAppStore, setAppStore } from './appStorage'
import {
  communityPluginsPath,
  listGlobalPluginPackages,
  readGlobalCommunityPlugins,
  writeGlobalCommunityPlugins,
  writeGlobalPluginPackage,
} from './globalPlugins'
import { listGlobalThemes } from './globalThemes'
import { installCatalogPackage } from '../catalog'

const ROOT = '/cfg/extensions'

const MANIFEST = JSON.stringify({
  id: 'hello-world',
  name: 'Hello',
  kind: 'plugin',
  version: '1.0.0',
  minAppVersion: '0.1.0',
  description: 'sample',
  author: 'test',
  permissions: ['ui:commands'],
  main: 'main.js',
})

function seed() {
  const store = createMemoryAppStore()
  setAppStore(store, ROOT)
  return store
}

describe('app-level extension storage', () => {
  it('keeps the enable list in the app directory, not in a vault', async () => {
    seed()
    await writeGlobalCommunityPlugins({
      schemaVersion: 1,
      enabled: ['hello-world'],
      versions: {},
      userEnableSeen: {},
    })
    expect(await communityPluginsPath()).toBe(ROOT + '/community-plugins.json')
    expect((await readGlobalCommunityPlugins()).enabled).toEqual(['hello-world'])
  })

  it('finds installed plugins the same way for every vault', async () => {
    seed()
    await writeGlobalPluginPackage({ id: 'hello-world', manifestJson: MANIFEST, mainJs: 'x' })
    const packages = await listGlobalPluginPackages()
    expect(packages.map(p => p.id)).toEqual(['hello-world'])
    expect(packages[0].mainSource).toBe('x\n')
  })

  it('skips a folder whose name disagrees with manifest.id', async () => {
    const store = createMemoryAppStore({
      [ROOT + '/plugins/other/manifest.json']: MANIFEST,
      [ROOT + '/plugins/other/main.js']: 'x',
    })
    setAppStore(store, ROOT)
    expect(await listGlobalPluginPackages()).toEqual([])
  })

  it('installs catalog packages into the app directory', async () => {
    seed()
    const result = await installCatalogPackage(
      {
        catalogProtocolVersion: '1',
        fileSyncResource: false,
        id: 'hello-world',
        kind: 'plugin',
        version: '1.0.0',
        files: { 'manifest.json': MANIFEST, 'main.js': 'x' },
      },
      'bundled',
    )
    expect(result.kind).toBe('plugin')
    expect((await listGlobalPluginPackages()).map(p => p.id)).toEqual(['hello-world'])
  })

  // Catalog Moss 现在是普通目录主题：只报磁盘上真实存在的包，
  // 既不自动投放种子，也不会把用户卸载掉的目录再写回来、改写用户的 CSS。
  it('lists only themes that are actually installed, without seeding or repairing', async () => {
    const store = seed()
    expect(await listGlobalThemes()).toEqual([])

    await installCatalogPackage({
      catalogProtocolVersion: '1',
      fileSyncResource: false,
      id: 'catalog-moss',
      kind: 'theme',
      version: '1.0.0',
      files: {
        'manifest.json': JSON.stringify({
          id: 'catalog-moss',
          name: 'Catalog Moss',
          kind: 'theme',
          version: '1.0.0',
          minAppVersion: '0.1.0',
          permissions: ['ui:theme'],
          theme: 'theme.css',
        }),
        'theme.css': ":root[data-community-theme='catalog-moss'] { --bg: #f3f6f1; }\n",
      },
    })

    expect((await listGlobalThemes()).map(t => t.id)).toEqual(['catalog-moss'])
    expect(await store.readText(ROOT + '/themes/catalog-moss/theme.css')).toBe(
      ":root[data-community-theme='catalog-moss'] { --bg: #f3f6f1; }\n",
    )
  })

  it('returns an empty list instead of throwing when nothing is installed', async () => {
    seed()
    expect(await listGlobalPluginPackages()).toEqual([])
    expect(await listGlobalThemes()).toEqual([])
    expect((await readGlobalCommunityPlugins()).enabled).toEqual([])
  })
})
