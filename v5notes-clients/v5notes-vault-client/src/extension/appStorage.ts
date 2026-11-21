/**
 * App-level storage for extensions.
 *
 * Plugins and themes belong to the installation, not to a vault: what you
 * install and what is enabled is the same everywhere, and a vault only decides
 * which notes a plugin can touch. Vault-specific colour stays in the vault.
 *
 * Layout (under the app config dir, next to recent-vaults.json):
 *   extensions/plugins/<id>/{manifest.json, main.js, data.json}
 *   extensions/themes/<id>/{manifest.json, theme.css}
 *   extensions/community-plugins.json
 *
 * data.json here is a plugin's GLOBAL settings. Settings that belong to the
 * notes of one vault live in that vault; see extension/pluginData.ts.
 */

import { appConfigDir, join } from '@tauri-apps/api/path'
import { isTauri } from '@tauri-apps/api/core'
import { mkdir, readDir, readTextFile, remove, writeTextFile } from '@tauri-apps/plugin-fs'

export interface AppDirEntry {
  name: string
  isDirectory: boolean
}

/** Everything the extension host needs from the app directory. */
export interface AppFileStore {
  readDir(path: string): Promise<AppDirEntry[]>
  readText(path: string): Promise<string | null>
  writeText(path: string, data: string): Promise<void>
  mkdir(path: string): Promise<void>
  /** 递归删除；待装扩展移出或安装完成后清掉暂存副本。 */
  remove(path: string): Promise<void>
}

type MemoryEntry = { kind: 'file'; content: string } | { kind: 'dir' }

export function normalizeAppPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/+$/, '')
}

function parentOf(path: string): string {
  const norm = normalizeAppPath(path)
  const cut = norm.lastIndexOf('/')
  return cut <= 0 ? '/' : norm.slice(0, cut)
}

/** In-memory store with the same read/write semantics as the file system. */
export function createMemoryAppStore(seed: Record<string, string> = {}): AppFileStore {
  const entries = new Map<string, MemoryEntry>()
  const ensureDir = (path: string) => {
    const norm = normalizeAppPath(path)
    if (!norm || entries.has(norm)) return
    entries.set(norm, { kind: 'dir' })
    ensureDir(parentOf(norm))
  }
  for (const path of Object.keys(seed)) ensureDir(parentOf(normalizeAppPath(path)))
  for (const [path, content] of Object.entries(seed)) {
    entries.set(normalizeAppPath(path), { kind: 'file', content })
  }
  return {
    async readDir(path) {
      const dir = normalizeAppPath(path)
      const prefix = dir + '/'
      const children = new Map<string, boolean>()
      for (const [key, entry] of entries) {
        if (!key.startsWith(prefix)) continue
        const rest = key.slice(prefix.length)
        if (!rest) continue
        const head = rest.split('/')[0]
        const isDirectory = rest.includes('/') || entry.kind === 'dir'
        children.set(head, (children.get(head) ?? false) || isDirectory)
      }
      return [...children.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, isDirectory]) => ({ name, isDirectory }))
    },
    async readText(path) {
      const entry = entries.get(normalizeAppPath(path))
      return entry && entry.kind === 'file' ? entry.content : null
    },
    async writeText(path, data) {
      const norm = normalizeAppPath(path)
      ensureDir(parentOf(norm))
      entries.set(norm, { kind: 'file', content: data })
    },
    async mkdir(path) {
      ensureDir(path)
    },
    async remove(path) {
      const norm = normalizeAppPath(path)
      for (const key of [...entries.keys()]) {
        if (key === norm || key.startsWith(norm + '/')) entries.delete(key)
      }
    },
  }
}

function createTauriAppStore(): AppFileStore {
  const api: AppFileStore = {
    async readDir(path) {
      try {
        const list = await readDir(path)
        return list
          .filter(entry => Boolean(entry.name))
          .map(entry => ({ name: entry.name as string, isDirectory: entry.isDirectory }))
      } catch {
        return []
      }
    },
    async readText(path) {
      try {
        return await readTextFile(path)
      } catch {
        return null
      }
    },
    async mkdir(path) {
      await mkdir(path, { recursive: true })
    },
    async writeText(path, data) {
      await api.mkdir(parentOf(path))
      await writeTextFile(path, data)
    },
    async remove(path) {
      try {
        await remove(path, { recursive: true })
      } catch {
        /* 已经不在了就是删除成功 */
      }
    },
  }
  return api
}

let injectedStore: AppFileStore | null = null
let tauriStore: AppFileStore | null = null
let cachedRoot: string | null = null
/** Tests pin the config dir because there is no Tauri path API to ask. */
let injectedRoot: string | null = null

/** Swap the store (tests) and drop the cached config dir. */
export function setAppStore(next: AppFileStore | null, root?: string): void {
  injectedStore = next
  injectedRoot = next ? (root ?? DEFAULT_TEST_ROOT) : null
  cachedRoot = null
}

const DEFAULT_TEST_ROOT = '/app/extensions'

export function getAppStore(): AppFileStore {
  if (injectedStore) return injectedStore
  if (!tauriStore) tauriStore = createTauriAppStore()
  return tauriStore
}

/** The extensions folder under the app config dir, resolved once. */
export async function getExtensionRootDir(): Promise<string> {
  if (cachedRoot) return cachedRoot
  if (injectedRoot) {
    cachedRoot = normalizeAppPath(injectedRoot)
    return cachedRoot
  }
  const dir = await appConfigDir()
  cachedRoot = normalizeAppPath(await join(dir, 'extensions'))
  return cachedRoot
}

export async function extensionPath(parts: string[]): Promise<string> {
  const root = await getExtensionRootDir()
  return normalizeAppPath([root, ...parts].join('/'))
}

/** The app directory only exists inside the Tauri shell. */
export function hasAppDirectory(): boolean {
  return injectedStore !== null || isTauri()
}
