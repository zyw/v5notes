import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryAppStore, setAppStore } from './appStorage'
import {
  forgetGlobalPlugin,
  listGlobalPluginPackages,
  readGlobalCommunityPlugins,
  removeGlobalPluginPackage,
  writeGlobalCommunityPlugins,
  writeGlobalPluginPackage,
} from './globalPlugins'
import { listGlobalThemes, removeGlobalTheme } from './globalThemes'
import { isCorePluginId } from './runtime'

const ROOT = '/cfg/extensions'

const MANIFEST = JSON.stringify({
  id: 'import-test',
  name: 'Import Test',
  kind: 'plugin',
  version: '1.2.3',
  permissions: ['ui:commands'],
  main: 'main.js',
})

const THEME_MANIFEST = JSON.stringify({
  id: 'catalog-moss',
  name: 'Catalog Moss',
  kind: 'theme',
  version: '1.0.0',
  permissions: ['ui:theme'],
  theme: 'theme.css',
})

function seed() {
  setAppStore(createMemoryAppStore(), ROOT)
}

async function installPlugin() {
  await writeGlobalPluginPackage({ id: 'import-test', manifestJson: MANIFEST, mainJs: 'x' })
}

async function installTheme() {
  const store = createMemoryAppStore()
  setAppStore(store, ROOT)
  await store.mkdir(ROOT + '/themes/catalog-moss')
  await store.writeText(ROOT + '/themes/catalog-moss/manifest.json', THEME_MANIFEST)
  await store.writeText(ROOT + '/themes/catalog-moss/theme.css', ':root { --bg: #fff; }')
}

describe('uninstalling extensions', () => {
  beforeEach(seed)

  it('removes the plugin folder so the scan no longer finds it', async () => {
    await installPlugin()
    expect((await listGlobalPluginPackages()).map((p) => p.id)).toEqual(['import-test'])
    await removeGlobalPluginPackage('import-test')
    expect(await listGlobalPluginPackages()).toEqual([])
  })

  it('deletes the global data.json with the package', async () => {
    const store = createMemoryAppStore({
      [ROOT + '/plugins/import-test/manifest.json']: MANIFEST,
      [ROOT + '/plugins/import-test/main.js']: 'x',
      [ROOT + '/plugins/import-test/data.json']: '{"a":1}',
    })
    setAppStore(store, ROOT)
    expect((await listGlobalPluginPackages()).map((p) => p.id)).toEqual(['import-test'])
    await removeGlobalPluginPackage('import-test')
    expect(await store.readText(ROOT + '/plugins/import-test/data.json')).toBeNull()
    expect(await listGlobalPluginPackages()).toEqual([])
  })

  it('forgets the plugin from every field of the enable file', async () => {
    await writeGlobalCommunityPlugins({
      schemaVersion: 1,
      enabled: ['import-test', 'daily-notes'],
      versions: { 'import-test': '1.2.3', 'daily-notes': '1.0.0' },
      userEnableSeen: { 'import-test': true },
    })
    await forgetGlobalPlugin('import-test')
    const file = await readGlobalCommunityPlugins()
    expect(file.enabled).toEqual(['daily-notes'])
    expect(file.versions).toEqual({ 'daily-notes': '1.0.0' })
    expect(file.userEnableSeen).toEqual({})
  })

  it('refuses to delete a folder that has no package in it', async () => {
    await expect(removeGlobalPluginPackage('not-installed')).rejects.toThrow(/不存在/)
  })

  it('removes an installed theme', async () => {
    await installTheme()
    expect((await listGlobalThemes()).map((t) => t.id)).toEqual(['catalog-moss'])
    await removeGlobalTheme('catalog-moss')
    expect(await listGlobalThemes()).toEqual([])
  })

  it('refuses to delete a theme that is not installed', async () => {
    await expect(removeGlobalTheme('nope')).rejects.toThrow(/不存在/)
  })

  it('treats the bundled core plugins as not uninstallable', () => {
    for (const id of ['v5-editor', 'plain-text', 'daily-notes', 'templates']) {
      expect(isCorePluginId(id)).toBe(true)
    }
    expect(isCorePluginId('import-test')).toBe(false)
  })
})
