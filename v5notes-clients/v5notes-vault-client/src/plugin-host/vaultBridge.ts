import type { VaultAdapter, WorkspaceApi } from '@v5notes/vault-plugin-api'
import { V5NOTES_DIR } from '../vault/skeleton'
import { vaultFs } from '../vault/vaultFs'

function assertNotInternalMetaPath(path: string): void {
  const clean = path.replace(/\\/g, '/').replace(/^\/+/, '')
  const first = clean.split('/')[0]?.toLowerCase()
  if (first === V5NOTES_DIR.toLowerCase()) {
    throw new Error(`插件禁止直接访问库内部元数据目录 ${V5NOTES_DIR}`)
  }
}

/**
 * Vault access for plugin code. Plugin packages, enable state and plugin data
 * live in the app directory (extension/appStorage), not here.
 */
export function createVaultAdapter(rootPath: string): VaultAdapter {
  return {
    async list(path: string) {
      const tree = await vaultFs.listTree(rootPath)
      const target = path.replace(/^\/+|\/+$/g, '')
      if (!target) {
        return tree.map((n) => n.path)
      }
      const node = findNode(tree, target)
      return (node?.children || []).map((c) => c.path)
    },
    async read(path: string) {
      assertNotInternalMetaPath(path)
      return vaultFs.readText(rootPath, path)
    },
    async write(path: string, data: string) {
      assertNotInternalMetaPath(path)
      await vaultFs.writeText(rootPath, path, data)
    },
    async delete(path: string) {
      assertNotInternalMetaPath(path)
      await vaultFs.delete(rootPath, path)
    },
    async rename(from: string, to: string) {
      assertNotInternalMetaPath(from)
      assertNotInternalMetaPath(to)
      await vaultFs.rename(rootPath, from, to)
    },
    async exists(path: string) {
      assertNotInternalMetaPath(path)
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
