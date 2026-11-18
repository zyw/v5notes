import { join } from '@tauri-apps/api/path'
import { mkdir, readDir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import type { VaultAdapter, WorkspaceApi } from '@v5notes/vault-plugin-api'
import { COMMUNITY_PLUGINS_REL, PLUGINS_DIR_REL } from '../vault/skeleton'
import { vaultFs } from '../vault/vaultFs'
import { parseCommunityPlugins, type CommunityPluginsFile } from './communityPlugins'
import { parseManifestJson } from './manifest'
import type { VaultPluginPackage } from './PluginHost'

/** Permission-proxied VaultAdapter backed by VaultFs (relative paths only). */
export function createVaultAdapter(rootPath: string): VaultAdapter {
  return {
    async list(path: string) {
      const tree = await vaultFs.listTree(rootPath)
      // Flatten immediate children of path for a simple list API.
      const target = path.replace(/^\/+|\/+$/g, '')
      if (!target) {
        return tree.map((n) => n.path)
      }
      const node = findNode(tree, target)
      return (node?.children || []).map((c) => c.path)
    },
    async read(path: string) {
      return vaultFs.readText(rootPath, path)
    },
    async write(path: string, data: string) {
      await ensureParent(rootPath, path)
      await vaultFs.writeText(rootPath, path, data)
    },
    async delete(path: string) {
      await vaultFs.delete(rootPath, path)
    },
    async rename(from: string, to: string) {
      await vaultFs.rename(rootPath, from, to)
    },
    async exists(path: string) {
      return vaultFs.exists(rootPath, path)
    },
  }
}

function findNode(
  nodes: { path: string; children?: { path: string; children?: unknown[] }[] }[],
  path: string,
): { path: string; children?: { path: string }[] } | null {
  for (const n of nodes) {
    if (n.path === path) return n as { path: string; children?: { path: string }[] }
    if (n.children) {
      const hit = findNode(n.children as typeof nodes, path)
      if (hit) return hit
    }
  }
  return null
}

async function ensureParent(rootPath: string, relativePath: string): Promise<void> {
  const parts = relativePath.split('/').filter(Boolean)
  if (parts.length <= 1) return
  const parent = parts.slice(0, -1).join('/')
  if (!(await vaultFs.exists(rootPath, parent))) {
    await vaultFs.mkdir(rootPath, parent)
  }
}

export function createWorkspaceApi(options: {
  getActivePath: () => string | null
  openFile?: (path: string) => Promise<void>
  onNotice: (message: string) => void
}): WorkspaceApi {
  return {
    openNotice: options.onNotice,
    getActiveFile: () => {
      const path = options.getActivePath()
      return path ? { path } : null
    },
    openFile: options.openFile,
  }
}

export async function readCommunityPluginsFile(rootPath: string): Promise<CommunityPluginsFile> {
  try {
    const abs = await join(rootPath, ...COMMUNITY_PLUGINS_REL.split('/'))
    const raw = await readTextFile(abs)
    return parseCommunityPlugins(raw)
  } catch {
    return parseCommunityPlugins({})
  }
}

export async function writeCommunityPluginsFile(
  rootPath: string,
  file: CommunityPluginsFile,
): Promise<void> {
  const abs = await join(rootPath, ...COMMUNITY_PLUGINS_REL.split('/'))
  await writeTextFile(abs, `${JSON.stringify(file, null, 2)}\n`)
}

export async function loadPluginDataFile(rootPath: string, pluginId: string): Promise<unknown> {
  try {
    const abs = await join(rootPath, PLUGINS_DIR_REL, pluginId, 'data.json')
    return JSON.parse(await readTextFile(abs))
  } catch {
    return null
  }
}

export async function savePluginDataFile(
  rootPath: string,
  pluginId: string,
  data: unknown,
): Promise<void> {
  const dir = await join(rootPath, PLUGINS_DIR_REL, pluginId)
  await mkdir(dir, { recursive: true })
  const abs = await join(dir, 'data.json')
  await writeTextFile(abs, `${JSON.stringify(data, null, 2)}\n`)
}

export async function listVaultPluginPackages(rootPath: string): Promise<VaultPluginPackage[]> {
  const pluginsRoot = await join(rootPath, PLUGINS_DIR_REL)
  let entries: Awaited<ReturnType<typeof readDir>>
  try {
    entries = await readDir(pluginsRoot)
  } catch {
    return []
  }
  const out: VaultPluginPackage[] = []
  for (const entry of entries) {
    if (!entry.isDirectory || !entry.name) continue
    if (entry.name.startsWith('.')) continue
    try {
      const manifestRaw = await readTextFile(await join(pluginsRoot, entry.name, 'manifest.json'))
      const manifest = parseManifestJson(manifestRaw)
      if (manifest.id !== entry.name) {
        throw new Error(`目录名 ${entry.name} 与 manifest.id ${manifest.id} 不一致`)
      }
      if (manifest.kind === 'theme') continue
      let mainSource: string | undefined
      if (manifest.main && manifest.main !== 'core') {
        try {
          mainSource = await readTextFile(await join(pluginsRoot, entry.name, manifest.main))
        } catch {
          mainSource = undefined
        }
      }
      out.push({ id: manifest.id, manifest, mainSource })
    } catch {
      /* skip broken packages */
    }
  }
  return out
}

export async function writeSamplePlugin(
  rootPath: string,
  sample: { id: string; manifestJson: string; mainJs: string },
): Promise<void> {
  const dir = await join(rootPath, PLUGINS_DIR_REL, sample.id)
  await mkdir(dir, { recursive: true })
  await writeTextFile(await join(dir, 'manifest.json'), sample.manifestJson.endsWith('\n') ? sample.manifestJson : `${sample.manifestJson}\n`)
  await writeTextFile(await join(dir, 'main.js'), sample.mainJs.endsWith('\n') ? sample.mainJs : `${sample.mainJs}\n`)
}
