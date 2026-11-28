/**
 * Engine tests for the §8.2/§9.3 protocol fixes:
 * - manifest pagination loop (hasMore)
 * - push-side rename/tombstone propagation (design §6.2)
 * - bootstrap merge conflict copies (design §9.3 两端都有内容)
 */

import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createSyncEngine, type SyncEngineDeps } from './engine'
import { VaultSyncApiError, type VaultSyncApi } from './api'

// The engine reads/writes vault.json / sync-state.json / retry-queue.json via
// Tauri fs directly. Route those calls through the in-memory files map below.
const metaFiles = new Map<string, string>()
vi.mock('@tauri-apps/api/path', () => ({
  join: async (...parts: string[]) => parts.join('/'),
}))
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: async (path: string) => {
    const content = metaFiles.get(path)
    if (content === undefined) throw new Error(`missing: ${path}`)
    return content
  },
  writeTextFile: async (path: string, content: string) => {
    metaFiles.set(path, content)
  },
}))
import type {
  VaultBindResult,
  VaultChange,
  VaultFileContent,
  VaultFileMeta,
  VaultManifest,
  VaultQuota,
} from './types'
import type { VaultTreeNode } from '../vault/types'
import type { VaultFs } from '../vault/vaultFs'
import type { VaultJson } from '../models/vault'
import { sha256Hex } from './hash'

const ROOT = '/vault'

function makeVaultJson(overrides?: Partial<VaultJson>): VaultJson {
  return {
    schemaVersion: 1,
    localVaultId: 'local-1',
    name: 'TestVault',
    createdAt: '2026-11-18T00:00:00.000Z',
    binding: {
      server: 'https://api.example.com',
      cloudVaultId: '9001',
      replicaId: 'device-abc123',
      lastCursor: null,
    },
    ...overrides,
  } as VaultJson
}

/** In-memory VaultFs over a map of relative path → text content. */
function makeFs(seed: Record<string, string> = {}) {
  const files = new Map(Object.entries(seed))
  const treeFromFiles = (): VaultTreeNode[] => {
    const dirs = new Map<string, VaultTreeNode>()
    const root: VaultTreeNode[] = []
    const ensureDir = (path: string): VaultTreeNode[] => {
      if (!path) return root
      let node = dirs.get(path)
      if (!node) {
        const slash = path.lastIndexOf('/')
        node = {
          path,
          identityKey: path.toLowerCase(),
          name: path.slice(slash + 1),
          kind: 'dir',
          children: [],
        }
        dirs.set(path, node)
        ensureDir(slash === -1 ? '' : path.slice(0, slash)).push(node)
      }
      return node.children!
    }
    for (const path of files.keys()) {
      const slash = path.lastIndexOf('/')
      const name = path.slice(slash + 1)
      ensureDir(slash === -1 ? '' : path.slice(0, slash)).push({
        path,
        identityKey: path.toLowerCase(),
        name,
        kind: name.toLowerCase().endsWith('.md') ? 'note' : 'file',
      })
    }
    return root
  }
  const fs: VaultFs = {
    async listTree() {
      return treeFromFiles()
    },
    async readText(_root, rel) {
      const content = files.get(rel)
      if (content === undefined) throw new Error(`missing: ${rel}`)
      return content
    },
    async writeText(_root, rel, content) {
      files.set(rel, content)
    },
    async readBytes(_root, rel) {
      const content = files.get(rel)
      if (content === undefined) throw new Error(`missing: ${rel}`)
      return new TextEncoder().encode(content)
    },
    async writeBytes(_root, rel, content) {
      files.set(rel, new TextDecoder().decode(content))
    },
    async mkdir() {},
    async rename(_root, from, to) {
      const content = files.get(from)
      if (content === undefined) throw new Error(`missing: ${from}`)
      files.delete(from)
      files.set(to, content)
    },
    async delete(_root, rel) {
      files.delete(rel)
    },
    async exists(_root, rel) {
      return rel === undefined || rel === '.' ? true : files.has(rel)
    },
    async absolute(_root, rel) {
      return `${ROOT}/${rel}`
    },
  }
  return { fs, files }
}

interface ApiOverrides {
  manifests?: VaultManifest[]
  onPut?: (args: { path: string; baseRev?: number | null }) => VaultFileMeta | never
  onDelete?: (args: { path: string; baseRev: number }) => VaultFileMeta | never
  onRename?: (args: { from: string; to: string; baseRev: number }) => VaultFileMeta | never
  onGetContent?: (path: string, rev?: number | null) => VaultFileContent
}

function makeApi(overrides: ApiOverrides = {}): VaultSyncApi & { calls: string[] } {
  const calls: string[] = []
  const meta = (path: string, rev = 1): VaultFileMeta => ({
    fileId: 'f-' + path,
    path,
    remoteRev: rev,
    contentHash: 'sha256:' + '0'.repeat(64),
    size: 10,
    type: 'note',
    cursor: '1',
  })
  const api = {
    calls,
    async createVault(): Promise<VaultSpaceSummaryAlias> {
      throw new Error('not used')
    },
    async listVaults() {
      throw new Error('not used')
    },
    async bind(): Promise<VaultBindResult> {
      throw new Error('not used')
    },
    async listReplicas() {
      return []
    },
    async kickReplica() {},
    async manifest(_vaultId: string, since?: string | null): Promise<VaultManifest> {
      calls.push(`manifest:${since ?? ''}`)
      const pages = overrides.manifests ?? []
      const idx = calls.filter(c => c.startsWith('manifest:')).length - 1
      return pages[Math.min(idx, pages.length - 1)]
    },
    async putFile(_vaultId: string, body: { path: string; baseRev?: number | null }) {
      calls.push(`put:${body.path}:${body.baseRev}`)
      if (overrides.onPut) return overrides.onPut(body)
      return meta(body.path)
    },
    async getContent(_vaultId: string, path: string, rev?: number | null) {
      calls.push(`content:${path}:${rev}`)
      if (overrides.onGetContent) return overrides.onGetContent(path, rev)
      return {
        fileId: 'f-' + path,
        path,
        remoteRev: rev ?? 1,
        contentHash: 'sha256:' + '0'.repeat(64),
        size: 10,
        body: 'remote-content',
        base64Body: null,
      }
    },
    async deleteFile(_vaultId: string, body: { path: string; baseRev: number }) {
      calls.push(`delete:${body.path}:${body.baseRev}`)
      if (overrides.onDelete) return overrides.onDelete(body)
      return meta(body.path)
    },
    async putBatch() {
      // Wired in api.ts but intentionally unused by the engine loop for now.
      throw new Error('not used by engine yet')
    },
    async rename(_vaultId: string, body: { from: string; to: string; baseRev: number }) {
      calls.push(`rename:${body.from}->${body.to}:${body.baseRev}`)
      if (overrides.onRename) return overrides.onRename(body)
      return meta(body.to)
    },
    async quota(): Promise<VaultQuota> {
      return {
        available: true,
        usedBytes: 0,
        quotaBytes: 1024 * 1024,
        replicaLimit: 3,
        replicaUsed: 1,
        overQuota: false,
        maxFileBytes: 25 * 1024 * 1024,
      }
    },
    async listFileVersions() {
      return []
    },
  }
  return api as unknown as VaultSyncApi & { calls: string[] }
}
type VaultSpaceSummaryAlias = { vaultId: string; name: string; usedBytes: number; empty?: boolean }

function makeDeps(
  fs: VaultFs,
  api: VaultSyncApi,
  extra: Partial<SyncEngineDeps> = {},
): SyncEngineDeps {
  return {
    rootPath: ROOT,
    getAuth: () => ({ server: 'https://api.example.com', clientId: 'c1', token: 'tok' }),
    onUnauthorized: () => {},
    fs,
    api,
    isOnline: () => true,
    ...extra,
  }
}

function seedState(state: Record<string, unknown>) {
  const metaPath = (rel: string) => `${ROOT}/${rel}`
  metaFiles.set(metaPath('.v5notes/vault.json'), JSON.stringify(makeVaultJson()))
  metaFiles.set(metaPath('.v5notes/sync-state.json'), JSON.stringify({ schemaVersion: 1, files: state }))
  return makeFs()
}

const change = (over: Partial<VaultChange> & { path: string }): VaultChange => ({
  op: 'upsert',
  fileId: 'f-' + over.path,
  remoteRev: 1,
  contentHash: 'sha256:' + '0'.repeat(64),
  size: 10,
  ...over,
})

describe('manifest pagination (§8.2)', () => {
  it('pages through hasMore pages until exhausted and stores the final cursor', async () => {
    const { fs, files } = makeFs()
    metaFiles.set(`${ROOT}/.v5notes/vault.json`, JSON.stringify(makeVaultJson()))
    const api = makeApi({
      manifests: [
        {
          cursor: '500',
          hasMore: true,
          changes: [change({ path: 'a.md' })],
        },
        {
          cursor: '900',
          hasMore: false,
          changes: [change({ path: 'b.md' })],
        },
      ],
    })
    const engine = createSyncEngine(makeDeps(fs, api))
    await engine.pushPull()

    expect(api.calls.filter(c => c.startsWith('manifest:'))).toEqual([
      'manifest:',
      'manifest:500',
    ])
    const saved = JSON.parse(metaFiles.get(`${ROOT}/.v5notes/vault.json`)!)
    expect(saved.binding.lastCursor).toBe('900')
  })

  it('does not loop forever when the server keeps saying hasMore with an unchanged cursor', async () => {
    const { fs } = makeFs()
    metaFiles.set(`${ROOT}/.v5notes/vault.json`, JSON.stringify(makeVaultJson()))
    const stuck: VaultManifest = { cursor: '500', hasMore: true, changes: [] }
    const api = makeApi({ manifests: [stuck] })
    const engine = createSyncEngine(makeDeps(fs, api))
    // Must terminate (single request; stale hasMore with no changes cannot advance).
    await engine.pushPull()
    expect(api.calls.filter(c => c.startsWith('manifest:')).length).toBe(1)
  })
})

describe('push-side rename/tombstone propagation (§6.2)', () => {
  it('sends an explicit rename when a tracked clean file moved locally', async () => {
    const { fs, files } = seedState({
      'old-name.md': {
        fileId: 'f-100',
        identityKey: 'old-name.md',
        localHash: null,
        remoteRev: 4,
        status: 'clean',
        size: 10,
        mtimeMs: 0,
      },
    })
    // On disk: old file gone, new untracked file present.
    files.set('new-name.md', '# moved')

    const api = makeApi({
      manifests: [{ cursor: '10', hasMore: false, changes: [] }],
    })
    const engine = createSyncEngine(makeDeps(fs as VaultFs, api))
    await engine.pushPull()

    expect(api.calls).toContain('rename:old-name.md->new-name.md:4')
    // The local move must not also tombstone the cloud file.
    expect(api.calls.some(c => c.startsWith('delete:'))).toBe(false)
    const state = JSON.parse(metaFiles.get(`${ROOT}/.v5notes/sync-state.json`)!)
    expect(state.files['new-name.md'].fileId).toBe('f-100')
    expect(state.files['old-name.md']).toBeUndefined()
  })

  it('sends a tombstone when a tracked clean file was deleted locally', async () => {
    const { fs, files } = seedState({
      'gone.md': {
        fileId: 'f-200',
        identityKey: 'gone.md',
        localHash: null,
        remoteRev: 2,
        status: 'clean',
        size: 10,
        mtimeMs: 0,
      },
    })
    // On disk the file is already gone — nothing else present.
    const api = makeApi({
      manifests: [{ cursor: '10', hasMore: false, changes: [] }],
    })
    const engine = createSyncEngine(makeDeps(fs, api))
    await engine.pushPull()

    expect(api.calls).toContain('delete:gone.md:2')
    expect(api.calls.some(c => c.startsWith('rename:'))).toBe(false)
    const state = JSON.parse(metaFiles.get(`${ROOT}/.v5notes/sync-state.json`)!)
    expect(state.files['gone.md']).toBeUndefined()
  })

  it('marks a conflict instead of silently deleting when the delete hits a remote 409', async () => {
    const { fs, files } = seedState({
      'hot.md': {
        fileId: 'f-300',
        identityKey: 'hot.md',
        localHash: null,
        remoteRev: 2,
        status: 'clean',
        size: 10,
        mtimeMs: 0,
      },
    })
    const api = makeApi({
      manifests: [{ cursor: '10', hasMore: false, changes: [] }],
      onDelete: () => {
        throw new VaultSyncApiError('conflict', 409, 'vault.conflict.rev')
      },
    })
    const engine = createSyncEngine(makeDeps(fs, api))
    const status = await engine.pushPull()
    expect(status.conflictPaths).toContain('hot.md')
    const state = JSON.parse(metaFiles.get(`${ROOT}/.v5notes/sync-state.json`)!)
    expect(state.files['hot.md'].status).toBe('conflict')
  })
})

describe('bootstrap merge conflict copies (§9.3)', () => {
  it('preserves an untracked local file as a conflict copy when the cloud baseline differs', async () => {
    const localBody = '# my local version'
    const localHash = await sha256Hex(localBody)
    const { fs, files } = makeFs({ 'weekly.md': localBody })
    metaFiles.set(`${ROOT}/.v5notes/vault.json`, JSON.stringify(makeVaultJson()))
    const remoteHash = 'sha256:' + '1'.repeat(64)
    const api = makeApi({
      manifests: [
        {
          cursor: '10',
          hasMore: false,
          changes: [change({ path: 'weekly.md', contentHash: remoteHash })],
        },
      ],
      onGetContent: (path, rev) => ({
        fileId: 'f-' + path,
        path,
        remoteRev: rev ?? 1,
        contentHash: remoteHash,
        size: 10,
        body: '# cloud version',
        base64Body: null,
      }),
    })
    const engine = createSyncEngine(makeDeps(fs, api))
    const status = await engine.pushPull()

    expect(status.conflictPaths.length).toBe(1)
    // Cloud baseline landed at the original path.
    expect(files.get('weekly.md')).toBe('# cloud version')
    // Local version preserved under a conflict copy path.
    const copyKey = [...files.keys()].find(k => k.includes('冲突') && k.endsWith('.md'))
    expect(copyKey).toBeDefined()
    expect(files.get(copyKey!)).toBe(localBody)
    // The conflict copy is preserved with the local content; since it is a new
    // untracked file, the push phase of the same cycle uploads it (dirty → clean)
    // so the local version also reaches the cloud under its copy path.
    const state = JSON.parse(metaFiles.get(`${ROOT}/.v5notes/sync-state.json`)!)
    expect(state.files[copyKey!].status).toBe('clean')
    expect(api.calls.some(c => c.startsWith(`put:${copyKey}:`))).toBe(true)
  })

  it('overwrites without a conflict copy when the untracked local content matches the cloud baseline', async () => {
    const sameBody = '# identical'
    const sameHash = await sha256Hex(sameBody)
    const { fs, files } = makeFs({ 'same.md': sameBody })
    metaFiles.set(`${ROOT}/.v5notes/vault.json`, JSON.stringify(makeVaultJson()))
    const api = makeApi({
      manifests: [
        {
          cursor: '10',
          hasMore: false,
          changes: [change({ path: 'same.md', contentHash: sameHash })],
        },
      ],
      onGetContent: (path, rev) => ({
        fileId: 'f-' + path,
        path,
        remoteRev: rev ?? 1,
        contentHash: sameHash,
        size: 10,
        body: sameBody,
        base64Body: null,
      }),
    })
    const engine = createSyncEngine(makeDeps(fs, api))
    const status = await engine.pushPull()

    expect(status.conflictPaths.length).toBe(0)
    expect([...files.keys()].filter(k => k.includes('冲突'))).toHaveLength(0)
  })
})

describe('getContent rev mismatch (§8.2)', () => {
  it('does not write stale content when the content endpoint reports a rev conflict', async () => {
    const { fs, files } = makeFs()
    metaFiles.set(`${ROOT}/.v5notes/vault.json`, JSON.stringify(makeVaultJson()))
    const api = makeApi({
      manifests: [
        {
          cursor: '10',
          hasMore: false,
          changes: [change({ path: 'moving.md', remoteRev: 5 })],
        },
      ],
      onGetContent: () => {
        throw new VaultSyncApiError('rev mismatch', 409, 'vault.conflict.rev')
      },
    })
    const engine = createSyncEngine(makeDeps(fs, api))
    // Must not throw out of the cycle; the change is skipped and retried next cycle.
    const status = await engine.pushPull()
    expect(status.status).toBeDefined()
    expect(files.get('moving.md')).toBeUndefined()
  })
})

describe('sanity', () => {
  it('injects fs and api without tauri', () => {
    const { fs } = makeFs()
    const api = makeApi()
    expect(() => createSyncEngine(makeDeps(fs, api))).not.toThrow()
  })
})

describe('pull-side protective branches (§9.3)', () => {
  it('keeps a local dirty file when the cloud deletes its identity, re-uploading it as a new file', async () => {
    const localBody = '# my edits win over an un-synced delete'
    const localHash = await sha256Hex(localBody)
    const { fs, files } = seedState({
      'hot.md': {
        fileId: 'f-400',
        identityKey: 'hot.md',
        localHash,
        remoteRev: 3,
        status: 'dirty',
        size: localBody.length,
        mtimeMs: 0,
      },
    })
    files.set('hot.md', localBody)
    const api = makeApi({
      manifests: [
        {
          cursor: '20',
          hasMore: false,
          changes: [{ op: 'delete', path: 'hot.md', fileId: 'f-400', remoteRev: 4 }],
        },
      ],
      onPut: ({ path }) => ({
        fileId: 'f-900',
        path,
        remoteRev: 1,
        contentHash: localHash,
        size: localBody.length,
        type: 'note',
        cursor: '21',
      }),
    })
    const engine = createSyncEngine(makeDeps(fs, api))
    const status = await engine.pushPull()

    // §9.3 删改冲突：改胜于删 — the edited content survives at its original path.
    expect(status.conflictPaths).toHaveLength(0)
    expect(files.get('hot.md')).toBe(localBody)
    const state = JSON.parse(metaFiles.get(`${ROOT}/.v5notes/sync-state.json`)!)
    // The reference to the tombstoned file is dropped; the same-cycle push sees
    // the surviving disk file as untracked and uploads it under a NEW fileId
    // (§8.2: recreate after tombstone gets a new identity reference), so the
    // deleted cloud file is never resurrected with its old rev.
    const rec = state.files['hot.md']
    expect(rec).toBeDefined()
    expect(rec.fileId).toBe('f-900')
    expect(rec.remoteRev).toBe(1)
    expect(rec.status).toBe('clean')
    const puts = api.calls.filter(c => c.startsWith('put:'))
    expect(puts).toEqual(['put:hot.md:0'])
  })

  it('deletes a clean local file when the cloud tombstones it', async () => {
    const { fs, files } = seedState({
      'gone.md': {
        fileId: 'f-401',
        identityKey: 'gone.md',
        localHash: null,
        remoteRev: 2,
        status: 'clean',
        size: 10,
        mtimeMs: 0,
      },
    })
    files.set('gone.md', '# gone')
    const api = makeApi({
      manifests: [
        {
          cursor: '21',
          hasMore: false,
          changes: [{ op: 'delete', path: 'gone.md', fileId: 'f-401', remoteRev: 3 }],
        },
      ],
    })
    const engine = createSyncEngine(makeDeps(fs, api))
    const status = await engine.pushPull()

    expect(status.conflictPaths).toHaveLength(0)
    expect(files.has('gone.md')).toBe(false)
    const state = JSON.parse(metaFiles.get(`${ROOT}/.v5notes/sync-state.json`)!)
    expect(state.files['gone.md']).toBeUndefined()
  })

  it('applies a cloud rename keeping rev and lands the new body at the target path', async () => {
    const renamedBody = '# renamed'
    const renamedHash = await sha256Hex(renamedBody)
    const { fs, files } = seedState({
      'old-name.md': {
        fileId: 'f-402',
        identityKey: 'old-name.md',
        localHash: null,
        remoteRev: 4,
        status: 'clean',
        size: 10,
        mtimeMs: 0,
      },
    })
    files.set('old-name.md', '# stale until pulled')
    const api = makeApi({
      manifests: [
        {
          cursor: '22',
          hasMore: false,
          changes: [
            {
              op: 'rename',
              from: 'old-name.md',
              path: 'new-name.md',
              fileId: 'f-402',
              remoteRev: 5,
              contentHash: renamedHash,
            },
            // The server logs rename as metadata-only; the body arrives via
            // its own upsert change (backend appendChange emits upsert per PUT).
            {
              op: 'upsert',
              path: 'new-name.md',
              fileId: 'f-402',
              remoteRev: 5,
              contentHash: renamedHash,
            },
          ],
        },
      ],
      onGetContent: (path, rev) => ({
        fileId: 'f-402',
        path,
        // Server-accurate echo: the stored rev at request time is what the
        // manifest promised (5); a mid-cycle bump would be a 409 instead.
        remoteRev: 5,
        contentHash: renamedHash,
        size: renamedBody.length,
        body: renamedBody,
        base64Body: null,
      }),
    })
    const engine = createSyncEngine(makeDeps(fs, api))
    await engine.pushPull()

    // Disk follows the rename; the upsert refetch applies the new rev's body.
    expect(files.has('old-name.md')).toBe(false)
    expect(files.get('new-name.md')).toBe(renamedBody)
    const state = JSON.parse(metaFiles.get(`${ROOT}/.v5notes/sync-state.json`)!)
    expect(state.files['old-name.md']).toBeUndefined()
    const moved = state.files['new-name.md']
    expect(moved.identityKey).toBe('new-name.md')
    expect(moved.remoteRev).toBe(5)
    expect(moved.status).toBe('clean')
    // The renamed file kept its identity: never re-PUT or tombstoned locally.
    const puts = api.calls.filter(c => c.startsWith('put:'))
    expect(puts.some(c => c.includes('old-name.md') || c.includes('new-name.md'))).toBe(false)
    expect(api.calls.some(c => c.startsWith('delete:'))).toBe(false)
  })
})

describe('retry queue growth (§14 断网队列)', () => {
  // The meta map is shared by this file's tests; start from an unbound vault so
  // another test's sync-state cannot be read as a local rename.
  beforeAll(() => {
    metaFiles.clear()
  })

  it('does not append another dead item for the same permanent failure', async () => {
    const { fs } = makeFs({ 'a.md': '# a' })
    metaFiles.set(`${ROOT}/.v5notes/vault.json`, JSON.stringify(makeVaultJson()))
    const api = makeApi({
      manifests: [{ cursor: '10', hasMore: false, changes: [] }],
      onPut: () => {
        throw new VaultSyncApiError('contentHash 与正文不一致', 400, 'vault.hash.mismatch')
      },
    })
    const engine = createSyncEngine(makeDeps(fs, api))

    await engine.pushPull()
    const afterFirst = engine.getRetryQueue().length
    await engine.pushPull()

    expect(afterFirst).toBe(1)
    expect(engine.getRetryQueue()).toHaveLength(1)
    // The entry is permanent, so it must never be retried on its own.
    expect(engine.getRetryQueue()[0]?.dead).toBe(true)
  })

  it('reports its size in the status snapshot', async () => {
    const { fs } = makeFs({ 'a.md': '# a' })
    metaFiles.set(`${ROOT}/.v5notes/vault.json`, JSON.stringify(makeVaultJson()))
    const api = makeApi({
      manifests: [{ cursor: '10', hasMore: false, changes: [] }],
      onPut: () => {
        throw new VaultSyncApiError('contentHash 与正文不一致', 400, 'vault.hash.mismatch')
      },
    })
    const engine = createSyncEngine(makeDeps(fs, api))
    await engine.pushPull()
    expect(engine.getStatus().retryQueueSize).toBe(1)
  })
})

describe('replica identity in vault.json (§6.4)', () => {
  function legacyVaultJson(): string {
    const json = makeVaultJson() as unknown as { binding: Record<string, unknown> }
    delete json.binding.replicaId
    json.binding.deviceId = 'legacy-device-uuid'
    return JSON.stringify(json)
  }

  it('reads an old deviceId as the replica id instead of treating the vault as new', async () => {
    const { fs } = makeFs()
    metaFiles.set(`${ROOT}/.v5notes/vault.json`, legacyVaultJson())
    const api = makeApi({ manifests: [{ cursor: '10', hasMore: false, changes: [] }] })
    const engine = createSyncEngine(makeDeps(fs, api))

    // Still bound: the sync runs rather than asking for a re-bind.
    const status = await engine.pushPull()
    expect(status.status).not.toBe('error')
    expect(api.calls.some(c => c.startsWith('manifest:'))).toBe(true)
  })

  it('refuses to sync a bound vault that has no replica id at all', async () => {
    const { fs } = makeFs()
    const json = makeVaultJson()
    json.binding.replicaId = null
    metaFiles.set(`${ROOT}/.v5notes/vault.json`, JSON.stringify(json))
    const api = makeApi({ manifests: [{ cursor: '10', hasMore: false, changes: [] }] })
    const engine = createSyncEngine(makeDeps(fs, api))

    const status = await engine.pushPull()
    expect(status.status).toBe('error')
    expect(status.lastErrorCode).toBe('vault.replica.missing')
    // Nothing reached the server: no row could have been created there.
    expect(api.calls.some(c => c.startsWith('manifest:'))).toBe(false)
  })

  it('names a conflict copy after the replica that wrote it', async () => {
    const { fs, files } = makeFs({ 'weekly.md': '# local' })
    metaFiles.set(`${ROOT}/.v5notes/vault.json`, JSON.stringify(makeVaultJson()))
    const api = makeApi({
      manifests: [
        {
          cursor: '10',
          hasMore: false,
          changes: [change({ path: 'weekly.md', contentHash: 'sha256:' + '1'.repeat(64) })],
        },
      ],
      onGetContent: (path, rev) => ({
        fileId: 'f-' + path,
        path,
        remoteRev: rev ?? 1,
        contentHash: 'sha256:' + '1'.repeat(64),
        size: 10,
        body: '# cloud',
        base64Body: null,
      }),
    })
    const engine = createSyncEngine(makeDeps(fs, api))
    await engine.pushPull()
    const copy = [...files.keys()].find(k => k.includes('冲突'))
    // makeVaultJson's replica id is 'device-abc123' → device
    expect(copy).toContain('device')
  })
})

describe('proxy attachment download auth', () => {
  it('passes Authorization and clientid when pulling a proxy attachment', async () => {
    metaFiles.clear()
    const payload = 'binary-attachment-payload'
    const payloadHash = await sha256Hex(payload)
    const { fs, files } = makeFs()
    metaFiles.set(`${ROOT}/.v5notes/vault.json`, JSON.stringify(makeVaultJson()))

    const calls: Array<{ url: string; headers: Record<string, string> }> = []
    const transport = (async (url: string, init?: RequestInit) => {
      calls.push({ url, headers: (init?.headers as Record<string, string>) ?? {} })
      return new Response(new TextEncoder().encode(payload), {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Content-Hash': payloadHash.replace(/^sha256:/, ''),
        },
      })
    }) as unknown as typeof fetch

    const api = makeApi({
      manifests: [
        {
          cursor: '10',
          hasMore: false,
          changes: [change({ path: 'attachments/pic.png', type: 'asset', contentHash: payloadHash, size: payload.length })],
        },
      ],
      onGetContent: (path, rev) => ({
        fileId: 'f-' + path,
        path,
        remoteRev: rev ?? 1,
        contentHash: payloadHash,
        size: payload.length,
        type: 'asset',
        body: null,
        download: {
          mode: 'proxy',
          url: '/vault/v1/vaults/9001/assets/42/content',
          supportsRange: true,
        },
      }),
    })

    const engine = createSyncEngine(makeDeps(fs, api, { transport }))
    const status = await engine.pushPull()

    expect(status.status).toBe('idle')
    expect(files.get('attachments/pic.png')).toBe(payload)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.example.com/vault/v1/vaults/9001/assets/42/content')
    expect(calls[0].headers.Authorization).toBe('Bearer tok')
    expect(calls[0].headers.clientid).toBe('c1')
  })

  it('surfaces auth failure instead of hash mismatch when proxy returns HTTP 200 code 401', async () => {
    metaFiles.clear()
    const payloadHash = 'sha256:' + 'a'.repeat(64)
    const { fs, files } = makeFs()
    metaFiles.set(`${ROOT}/.v5notes/vault.json`, JSON.stringify(makeVaultJson()))
    const onUnauthorized = vi.fn()

    const transport = (async () => {
      return new Response(JSON.stringify({ code: 401, msg: '认证失败，无法访问系统资源', data: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as unknown as typeof fetch

    const api = makeApi({
      manifests: [
        {
          cursor: '10',
          hasMore: false,
          changes: [change({ path: 'attachments/pic.png', type: 'asset', contentHash: payloadHash, size: 100 })],
        },
      ],
      onGetContent: (path, rev) => ({
        fileId: 'f-' + path,
        path,
        remoteRev: rev ?? 1,
        contentHash: payloadHash,
        size: 100,
        type: 'asset',
        body: null,
        download: {
          mode: 'proxy',
          url: '/vault/v1/vaults/9001/assets/42/content',
          supportsRange: true,
        },
      }),
    })

    const engine = createSyncEngine(makeDeps(fs, api, { transport, onUnauthorized }))
    const status = await engine.pushPull()

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(status.status).toBe('error')
    expect(status.message).toBe('认证失败，无法访问系统资源')
    expect(files.has('attachments/pic.png')).toBe(false)
  })
})
