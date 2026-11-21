import { parseManifestJson } from '../plugin-host/manifest'
import { extensionPath, getAppStore } from '../extension/appStorage'
import { fetchCatalogPackage } from './api'
import { assertCatalogItemInstallable } from './rejectPublishing'
import type { CatalogItem, CatalogPackage } from './types'

export interface InstallResult {
  id: string
  kind: 'plugin' | 'theme'
  version: string
  source: 'server' | 'bundled' | 'imported'
}

/**
 * Install a catalog entry into the app's extension folder (local files only).
 * Extensions are shared by every vault, so no vault path is involved.
 */
export async function installCatalogItem(
  item: CatalogItem,
  options?: { server?: string; transport?: typeof fetch; allowBundledFallback?: boolean },
): Promise<InstallResult> {
  assertCatalogItemInstallable(item)
  const { pkg, source } = await fetchCatalogPackage(item.id, options)
  return installCatalogPackage(pkg, source)
}

export async function installCatalogPackage(
  pkg: CatalogPackage,
  source: 'server' | 'bundled' | 'imported' = 'bundled',
): Promise<InstallResult> {
  if (pkg.fileSyncResource) {
    throw new Error('拒绝安装：包标记为 file-sync 资源')
  }
  const manifestRaw = pkg.files['manifest.json']
  if (!manifestRaw) throw new Error('catalog 包缺少 manifest.json')
  const manifest = parseManifestJson(manifestRaw)
  assertCatalogItemInstallable({
    tags: manifest.tags,
    permissions: manifest.permissions,
  })
  if (manifest.id !== pkg.id) {
    throw new Error('包 id ' + pkg.id + ' 与 manifest.id ' + manifest.id + ' 不一致')
  }

  const baseDir = manifest.kind === 'theme' ? 'themes' : 'plugins'
  const store = getAppStore()
  const dir = await extensionPath([baseDir, manifest.id])
  await store.mkdir(dir)

  for (const [name, content] of Object.entries(pkg.files)) {
    if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) {
      throw new Error('非法包内文件名: ' + name)
    }
    const text = content.endsWith('\n') ? content : content + '\n'
    await store.writeText(dir + '/' + name, text)
  }

  return {
    id: manifest.id,
    kind: manifest.kind,
    version: manifest.version,
    source,
  }
}
