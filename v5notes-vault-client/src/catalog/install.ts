import { join } from '@tauri-apps/api/path'
import { mkdir, writeTextFile } from '@tauri-apps/plugin-fs'
import { parseManifestJson } from '../plugin-host/manifest'
import { PLUGINS_DIR_REL, THEMES_DIR_REL } from '../vault/skeleton'
import { fetchCatalogPackage } from './api'
import { assertCatalogItemInstallable } from './rejectPublishing'
import type { CatalogItem, CatalogPackage } from './types'

export interface InstallResult {
  id: string
  kind: 'plugin' | 'theme'
  version: string
  source: 'server' | 'bundled'
}

/** Install a catalog entry into the open vault (local files only). */
export async function installCatalogItem(
  rootPath: string,
  item: CatalogItem,
  options?: { server?: string; transport?: typeof fetch; allowBundledFallback?: boolean },
): Promise<InstallResult> {
  assertCatalogItemInstallable(item)
  const { pkg, source } = await fetchCatalogPackage(item.id, options)
  return installCatalogPackage(rootPath, pkg, source)
}

export async function installCatalogPackage(
  rootPath: string,
  pkg: CatalogPackage,
  source: 'server' | 'bundled' = 'bundled',
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
    throw new Error(`包 id ${pkg.id} 与 manifest.id ${manifest.id} 不一致`)
  }

  const baseRel = manifest.kind === 'theme' ? THEMES_DIR_REL : PLUGINS_DIR_REL
  const dir = await join(rootPath, baseRel, manifest.id)
  await mkdir(dir, { recursive: true })

  for (const [name, content] of Object.entries(pkg.files)) {
    if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) {
      throw new Error(`非法包内文件名: ${name}`)
    }
    const text = content.endsWith('\n') ? content : `${content}\n`
    await writeTextFile(await join(dir, name), text)
  }

  return {
    id: manifest.id,
    kind: manifest.kind,
    version: manifest.version,
    source,
  }
}
