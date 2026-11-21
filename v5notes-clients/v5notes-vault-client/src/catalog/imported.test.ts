import { readFile } from 'node:fs/promises'
import { describe, expect, it, beforeEach } from 'vitest'
import { createMemoryAppStore, setAppStore } from '../extension/appStorage'
import { listGlobalPluginPackages } from '../extension/globalPlugins'
import { listGlobalThemes } from '../extension/globalThemes'
import {
  importedItemFromFiles,
  installImportedPackage,
  listImportedExtensions,
  readPendingPackage,
  removeImportedExtension,
  writePendingPackage,
} from './imported'

const ROOT = '/cfg/extensions'

const PLUGIN_MANIFEST = JSON.stringify({
  id: 'my-plugin',
  name: 'My Plugin',
  kind: 'plugin',
  version: '1.0.0',
  description: 'imported sample',
  author: 'tester',
  permissions: ['ui:commands'],
  tags: ['demo'],
  main: 'main.js',
})

const THEME_MANIFEST = JSON.stringify({
  id: 'my-theme',
  name: 'My Theme',
  kind: 'theme',
  version: '1.0.0',
  permissions: ['ui:theme'],
  theme: 'theme.css',
})

function seed() {
  setAppStore(createMemoryAppStore(), ROOT)
}

async function stagePlugin() {
  await writePendingPackage('my-plugin', {
    'manifest.json': PLUGIN_MANIFEST,
    'main.js': 'module.exports = class {}',
  })
}

describe('imported extension staging', () => {
  beforeEach(seed)

  it('builds a list row from the packaged manifest', () => {
    const item = importedItemFromFiles({ 'manifest.json': PLUGIN_MANIFEST })
    expect(item).toMatchObject({
      id: 'my-plugin',
      name: 'My Plugin',
      kind: 'plugin',
      version: '1.0.0',
      permissions: ['ui:commands'],
      tags: ['demo'],
    })
  })

  it('rejects a package without manifest.json', () => {
    expect(() => importedItemFromFiles({ 'main.js': 'x' })).toThrow(/manifest\.json/)
  })

  it('rejects publishing tags and forbidden permissions at import time', () => {
    const withPublishing = JSON.stringify({
      id: 'evil',
      name: 'Evil',
      version: '1.0.0',
      permissions: ['ui:commands'],
      tags: ['publishing'],
    })
    expect(() => importedItemFromFiles({ 'manifest.json': withPublishing })).toThrow(/publishing/)
    const badPerm = JSON.stringify({
      id: 'evil2',
      name: 'Evil',
      version: '1.0.0',
      permissions: ['network'],
    })
    expect(() => importedItemFromFiles({ 'manifest.json': badPerm })).toThrow(/network/)
  })

  it('keeps staged packages out of the installed list until installed', async () => {
    await stagePlugin()
    expect((await listImportedExtensions()).map((i) => i.id)).toEqual(['my-plugin'])
    // pending/ 不在 extensions/plugins 的扫描范围内。
    expect(await listGlobalPluginPackages()).toEqual([])
  })

  it('lists nothing before anything is imported', async () => {
    expect(await listImportedExtensions()).toEqual([])
  })

  it('installs a plugin package into plugins/ and drops the pending copy', async () => {
    await stagePlugin()
    const result = await installImportedPackage('my-plugin')
    expect(result).toMatchObject({ id: 'my-plugin', kind: 'plugin', source: 'imported' })
    // 安装后：出现在已安装扫描里，待装区清空。
    expect((await listGlobalPluginPackages()).map((p) => p.id)).toEqual(['my-plugin'])
    expect(await listImportedExtensions()).toEqual([])
    await expect(readPendingPackage('my-plugin')).rejects.toThrow(/manifest\.json/)
  })

  it('installs a theme package into themes/', async () => {
    await writePendingPackage('my-theme', {
      'manifest.json': THEME_MANIFEST,
      'theme.css': ':root { --bg: #fff; }',
    })
    const result = await installImportedPackage('my-theme')
    expect(result).toMatchObject({ kind: 'theme', source: 'imported' })
    expect((await listGlobalThemes()).map((t) => t.id)).toContain('my-theme')
    expect(await listImportedExtensions()).toEqual([])
  })

  it('removes a staged package without touching installed ones', async () => {
    await stagePlugin()
    await removeImportedExtension('my-plugin')
    expect(await listImportedExtensions()).toEqual([])
    expect(await listGlobalPluginPackages()).toEqual([])
  })

  it('refuses a staged folder whose name disagrees with manifest.id', async () => {
    await writePendingPackage('wrong-name', {
      'manifest.json': PLUGIN_MANIFEST,
      'main.js': 'x',
    })
    await expect(readPendingPackage('wrong-name')).rejects.toThrow(/manifest\.id/)
  })

  it('accepts the shipped Import Test package and installs it end to end', async () => {
    // 与 src-tauri/src/lib.rs 的 reads_the_shipped_import_test_zip 对应：
    // 那边验证 zip 能解，这边验证解出来的文件能走完整条导入→安装链路。
    const manifest = await readFile(
      new URL('../plugin-host/samples/import-test/manifest.json', import.meta.url),
      'utf8',
    )
    const mainJs = await readFile(
      new URL('../plugin-host/samples/import-test/main.js', import.meta.url),
      'utf8',
    )
    const item = importedItemFromFiles({ 'manifest.json': manifest, 'main.js': mainJs })
    expect(item).toMatchObject({ id: 'import-test', name: 'Import Test', kind: 'plugin', version: '1.2.3' })
    expect(item.permissions).toEqual(['ui:commands', 'ui:ribbon', 'ui:settings', 'vault:read'])

    await writePendingPackage('import-test', { 'manifest.json': manifest, 'main.js': mainJs })
    expect((await listImportedExtensions()).map((i) => i.id)).toEqual(['import-test'])
    const result = await installImportedPackage('import-test')
    expect(result).toMatchObject({ id: 'import-test', source: 'imported' })
    const installed = await listGlobalPluginPackages()
    expect(installed.map((p) => p.id)).toContain('import-test')
    expect(await listImportedExtensions()).toEqual([])
  })

  it('round-trips every packaged file when reading the staged package', async () => {
    await stagePlugin()
    const pkg = await readPendingPackage('my-plugin')
    expect(Object.keys(pkg.files).sort()).toEqual(['main.js', 'manifest.json'])
    expect(pkg.files['main.js']).toContain('module.exports')
  })
})
