/**
 * Imported extension packages waiting to be installed.
 *
 * 「导入」只是把包放进待装列表，用户点「安装」才真正装进 extensions/plugins
 * 或 extensions/themes。所以待装的包必须放在一个别处：extensions/pending/<id>/。
 *
 * 为什么不能直接放 plugins/：listGlobalPluginPackages 会扫描 plugins/，读到的
 * 包立刻算作「已安装」，用户就没机会先看再装；pending/ 不在扫描范围内，
 * 只有安装成功后才复制过去并清掉待装副本。
 */

import { invoke, isTauri } from '@tauri-apps/api/core'
import { parseManifestJson } from '../plugin-host/manifest'
import { getAppStore, extensionPath } from '../extension/appStorage'
import { installCatalogPackage, type InstallResult } from './install'
import type { CatalogItem, CatalogPackage } from './types'

const PENDING_DIR = 'pending'

/** Tauri command returns the zip's files; the entry set is checked in Rust. */
interface ExtensionZipPayload {
  files: Record<string, string>
}

function pendingPath(id?: string): Promise<string> {
  return extensionPath(id ? [PENDING_DIR, id] : [PENDING_DIR])
}

/**
 * Turn a validated file map into the list row the catalog list renders.
 * The row has the same shape as a seed entry, so the list needs no special case.
 */
export function importedItemFromFiles(files: Record<string, string>): CatalogItem {
  const raw = files['manifest.json']
  if (!raw) throw new Error('扩展包缺少根目录下的 manifest.json')
  const manifest = parseManifestJson(raw)
  const permissions = [...manifest.permissions]
  const item: CatalogItem = {
    id: manifest.id,
    name: manifest.name,
    kind: manifest.kind,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    minAppVersion: manifest.minAppVersion,
    permissions: permissions.length ? permissions : undefined,
    tags: manifest.tags ? [...manifest.tags] : undefined,
    networkAllowlist: manifest.networkAllowlist ? [...manifest.networkAllowlist] : undefined,
  }
  return item
}

/** 包本身只留在 pending/，安装时再从磁盘读回来。 */
export function importedPackageFromFiles(
  files: Record<string, string>,
  item: CatalogItem,
): CatalogPackage {
  return {
    catalogProtocolVersion: '1',
    fileSyncResource: false,
    id: item.id,
    kind: item.kind,
    version: item.version,
    files,
  }
}

/** Read a local .zip and keep it in pending/. Installing is a separate step. */
export async function importExtensionZip(zipPath: string): Promise<CatalogItem> {
  if (!isTauri()) throw new Error('导入扩展包需要在桌面应用中进行')
  const payload = await invoke<ExtensionZipPayload>('read_extension_zip', { path: zipPath })
  const item = importedItemFromFiles(payload.files)
  await writePendingPackage(item.id, payload.files)
  return item
}

export async function writePendingPackage(id: string, files: Record<string, string>): Promise<void> {
  const store = getAppStore()
  const dir = await pendingPath(id)
  await store.mkdir(dir)
  for (const [name, content] of Object.entries(files)) {
    const text = content.endsWith('\n') ? content : content + '\n'
    await store.writeText(dir + '/' + name, text)
  }
}

/** 从 pending/ 读回一个待装包；包里缺 manifest 或 main 就当作损坏。 */
export async function readPendingPackage(id: string): Promise<CatalogPackage> {
  const store = getAppStore()
  const dir = await pendingPath(id)
  const manifestRaw = await store.readText(dir + '/manifest.json')
  if (!manifestRaw) throw new Error('待安装扩展缺少 manifest.json')
  const manifest = parseManifestJson(manifestRaw)
  if (manifest.id !== id) {
    throw new Error('目录名 ' + id + ' 与 manifest.id ' + manifest.id + ' 不一致')
  }
  // 包是平铺的，导入时已拒绝目录；这里只收文件条目。
  const files: Record<string, string> = { 'manifest.json': manifestRaw }
  for (const entry of await store.readDir(dir)) {
    if (entry.isDirectory || entry.name.startsWith('.')) continue
    const text = await store.readText(dir + '/' + entry.name)
    if (text != null) files[entry.name] = text
  }
  return importedPackageFromFiles(files, {
    id: manifest.id,
    name: manifest.name,
    kind: manifest.kind,
    version: manifest.version,
  })
}

/** Every package waiting in pending/, newest last. */
export async function listImportedExtensions(): Promise<CatalogItem[]> {
  const store = getAppStore()
  const root = await pendingPath()
  const entries = await store.readDir(root)
  const out: CatalogItem[] = []
  for (const entry of entries) {
    if (!entry.isDirectory || entry.name.startsWith('.')) continue
    try {
      const manifestRaw = await store.readText((await pendingPath(entry.name)) + '/manifest.json')
      if (!manifestRaw) continue
      out.push(importedItemFromFiles({ 'manifest.json': manifestRaw }))
    } catch {
      /* 坏的待装包跳过，不阻塞列表 */
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

/** 移出待装列表，不动任何已安装的东西。 */
export async function removeImportedExtension(id: string): Promise<void> {
  await getAppStore().remove(await pendingPath(id))
}

/**
 * Install a pending package: copy into plugins/ or themes/, then drop the
 * pending copy so the same package never sits in two lists.
 */
export async function installImportedPackage(id: string): Promise<InstallResult> {
  const pkg = await readPendingPackage(id)
  const result = await installCatalogPackage(pkg, 'imported')
  await removeImportedExtension(id)
  return result
}
