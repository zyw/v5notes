/**
 * SyncEngine — Phase 4 vertical slice (design §9).
 * Bind when logged in; path identity + §6.4 exclude; conflict copies; bootstrap authority.
 */

import { join } from '@tauri-apps/api/path'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import type { SyncFileEntry, SyncStateJson } from '../models/sync-state'
import { SYNC_STATE_SCHEMA_VERSION } from '../models/sync-state'
import type { VaultJson } from '../models/vault'
import { toIdentityKey, normalizeVaultPath } from '../path/identity'
import { SYNC_STATE_REL, SYNCIGNORE_REL, VAULT_JSON_REL } from '../vault/skeleton'
import type { VaultFs } from '../vault/vaultFs'
import { vaultFs as defaultVaultFs } from '../vault/vaultFs'
import { createVaultSyncApi, VaultSyncApiError, type VaultSyncApi } from './api'
import { planBootstrap } from './bootstrap'
import { buildConflictCopyPath } from './conflict'
import { applySyncIgnore, parseSyncIgnore } from './exclude'
import { normalizeContentHash, sha256Hex } from './hash'
import type {
  BootstrapPlan,
  LocalScanFile,
  SyncEngineStatus,
  SyncStatus,
  VaultChange,
  VaultQuota,
} from './types'

export interface SyncEngineDeps {
  rootPath: string
  getAuth: () => { server: string; clientId: string; token: string }
  onUnauthorized: () => void
  fs?: VaultFs
  api?: VaultSyncApi
  transport?: typeof fetch
}

export function createSyncEngine(deps: SyncEngineDeps) {
  const fs = deps.fs ?? defaultVaultFs
  const api = deps.api ?? createVaultSyncApi(deps.getAuth, deps.onUnauthorized, deps.transport)

  let status: SyncStatus = 'idle'
  let message = '未同步'
  let lastErrorCode: string | null = null
  let overQuota = false
  let conflictPaths: string[] = []
  let listeners = new Set<(s: SyncEngineStatus) => void>()

  function emit() {
    const snap = getStatus()
    for (const listener of listeners) listener(snap)
  }

  function setStatus(next: SyncStatus, msg: string, code: string | null = null) {
    status = next
    message = msg
    lastErrorCode = code
    emit()
  }

  async function readVaultJson(): Promise<VaultJson> {
    const raw = await readTextFile(await join(deps.rootPath, VAULT_JSON_REL))
    return JSON.parse(raw) as VaultJson
  }

  async function writeVaultJson(config: VaultJson): Promise<void> {
    await writeTextFile(await join(deps.rootPath, VAULT_JSON_REL), `${JSON.stringify(config, null, 2)}\n`)
  }

  async function readSyncState(): Promise<SyncStateJson> {
    try {
      const raw = await readTextFile(await join(deps.rootPath, SYNC_STATE_REL))
      return JSON.parse(raw) as SyncStateJson
    } catch {
      return { schemaVersion: SYNC_STATE_SCHEMA_VERSION, files: {} }
    }
  }

  async function writeSyncState(state: SyncStateJson): Promise<void> {
    await writeTextFile(await join(deps.rootPath, SYNC_STATE_REL), `${JSON.stringify(state, null, 2)}\n`)
  }

  async function readIgnorePatterns(): Promise<string[]> {
    try {
      const text = await readTextFile(await join(deps.rootPath, SYNCIGNORE_REL))
      return parseSyncIgnore(text)
    } catch {
      return []
    }
  }

  async function listSyncableFiles(): Promise<LocalScanFile[]> {
    const patterns = await readIgnorePatterns()
    const tree = await fs.listTree(deps.rootPath)
    const files: LocalScanFile[] = []

    async function walk(nodes: Awaited<ReturnType<VaultFs['listTree']>>) {
      for (const node of nodes) {
        if (node.kind === 'dir') {
          if (node.children) await walk(node.children)
          continue
        }
        if (node.kind !== 'file') continue
        // Also consider intent configs under .v5notes that listTree skips — handled below via explicit reads.
        const decision = applySyncIgnore(node.path, patterns)
        if (!decision.sync) continue
        if (!node.path.toLowerCase().endsWith('.md') && decision.reason !== 'intent-config') {
          // Phase 4 slice: sync markdown + intent configs; attachments later.
          continue
        }
        const content = await fs.readText(deps.rootPath, node.path)
        const hash = await sha256Hex(content)
        files.push({
          displayPath: node.path,
          identityKey: node.identityKey,
          content,
          hash,
          size: new TextEncoder().encode(content).length,
          mtimeMs: Date.now(),
        })
      }
    }

    await walk(tree)

    // Intent configs live under .v5notes and are skipped by listTree — read explicitly.
    for (const rel of [
      '.v5notes/appearance.json',
      '.v5notes/plugins/community-plugins.json',
      '.v5notes/themes/community-themes.json',
    ]) {
      if (!applySyncIgnore(rel, patterns).sync) continue
      try {
        const content = await readTextFile(await join(deps.rootPath, rel))
        const normalized = normalizeVaultPath(rel)
        files.push({
          displayPath: normalized.displayPath,
          identityKey: normalized.identityKey,
          content,
          hash: await sha256Hex(content),
          size: new TextEncoder().encode(content).length,
          mtimeMs: Date.now(),
        })
      } catch {
        // optional
      }
    }

    return files
  }

  function getStatus(): SyncEngineStatus {
    return {
      status,
      message,
      lastCursor: null,
      cloudVaultId: null,
      overQuota,
      lastErrorCode,
      conflictPaths: [...conflictPaths],
    }
  }

  async function refreshQuota(): Promise<VaultQuota | null> {
    try {
      const quota = await api.quota()
      overQuota = Boolean(quota.overQuota || (quota.quotaBytes > 0 && quota.usedBytes >= quota.quotaBytes))
      return quota
    } catch {
      return null
    }
  }

  /**
   * Bind local vault to cloud (create cloud vault if needed). Requires login token.
   */
  async function bind(options?: { vaultName?: string; existingVaultId?: string | null }): Promise<BootstrapPlan> {
    const auth = deps.getAuth()
    if (!auth.token) {
      setStatus('error', '请先登录后再绑定同步', 'auth.unauthorized')
      throw new VaultSyncApiError('请先登录', 401, 'auth.unauthorized')
    }
    setStatus('binding', '正在绑定云端库…')
    const config = await readVaultJson()
    const deviceId = config.binding.deviceId || crypto.randomUUID()
    config.binding.deviceId = deviceId
    config.binding.server = auth.server

    let vaultId = options?.existingVaultId || config.binding.cloudVaultId
    if (!vaultId) {
      const created = await api.createVault(options?.vaultName || config.name)
      vaultId = created.vaultId
    }
    const bindResult = await api.bind(vaultId, {
      deviceId,
      clientInfo: 'v5notes-vault-client/phase4',
    })
    config.binding.cloudVaultId = bindResult.vaultId
    await writeVaultJson(config)

    const localFiles = await listSyncableFiles()
    const plan = planBootstrap({
      cloudHasContent: Boolean(bindResult.cloudHasContent),
      localSyncableFileCount: localFiles.length,
    })
    overQuota = Boolean(bindResult.quota?.overQuota)
    setStatus('idle', `已绑定 · ${plan.mode}`)
    return plan
  }

  async function pushOne(
    vaultId: string,
    file: LocalScanFile,
    entry: SyncFileEntry | undefined,
  ): Promise<SyncFileEntry> {
    const meta = await api.putFile(vaultId, {
      path: file.displayPath,
      fileId: entry?.fileId,
      baseRev: entry?.remoteRev ?? 0,
      hash: file.hash,
      type: file.displayPath.startsWith('.v5notes/') ? 'config' : 'note',
      body: file.content,
    })
    return {
      fileId: meta.fileId,
      identityKey: file.identityKey,
      localHash: normalizeContentHash(meta.contentHash),
      remoteRev: meta.remoteRev,
      status: 'clean',
      size: meta.size,
      mtimeMs: file.mtimeMs,
    }
  }

  async function applyRemoteUpsert(
    vaultId: string,
    change: VaultChange,
    state: SyncStateJson,
    occupied: Set<string>,
    deviceId: string | null,
  ): Promise<void> {
    if (!change.path) return
    const content = await api.getContent(vaultId, change.path, change.remoteRev)
    const body = content.body ?? ''
    const identityKey = toIdentityKey(change.path)
    const localEntry = Object.entries(state.files).find(([, e]) => e.identityKey === identityKey
      || (e.fileId && e.fileId === change.fileId))
    const localPath = localEntry?.[0]
    const local = localEntry?.[1]

    const localDirty = local && (local.status === 'dirty' || local.status === 'conflict')
    const hashMismatch = local?.localHash
      && change.contentHash
      && normalizeContentHash(local.localHash) !== normalizeContentHash(change.contentHash)

    if (localDirty && hashMismatch && localPath) {
      // Keep local edits as conflict copy; write remote to original path.
      const copyPath = buildConflictCopyPath(localPath, deviceId, occupied, toIdentityKey)
      occupied.add(toIdentityKey(copyPath))
      const localContent = await fs.readText(deps.rootPath, localPath)
      await fs.writeText(deps.rootPath, copyPath, localContent)
      conflictPaths.push(copyPath)
      state.files[copyPath] = {
        fileId: null,
        identityKey: toIdentityKey(copyPath),
        localHash: await sha256Hex(localContent),
        remoteRev: null,
        status: 'dirty',
        size: new TextEncoder().encode(localContent).length,
        mtimeMs: Date.now(),
      }
    }

    await fs.writeText(deps.rootPath, change.path, body)
    occupied.add(identityKey)
    state.files[change.path] = {
      fileId: change.fileId,
      identityKey,
      localHash: change.contentHash ? normalizeContentHash(change.contentHash) : await sha256Hex(body),
      remoteRev: change.remoteRev,
      status: 'clean',
      size: change.size ?? new TextEncoder().encode(body).length,
      mtimeMs: Date.now(),
    }
    if (localPath && localPath !== change.path) {
      delete state.files[localPath]
    }
  }

  /**
   * One sync cycle: pull manifest, merge with conflict copies, push local dirty/new.
   */
  async function pushPull(): Promise<SyncEngineStatus> {
    const auth = deps.getAuth()
    if (!auth.token) {
      setStatus('error', '未登录，本地编辑仍可用', 'auth.unauthorized')
      return getStatusSnapshot()
    }
    conflictPaths = []
    setStatus('syncing', '同步中…')
    try {
      const config = await readVaultJson()
      const vaultId = config.binding.cloudVaultId
      if (!vaultId) {
        setStatus('error', '尚未绑定云端库', 'vault.not.found')
        return getStatusSnapshot(config)
      }

      await refreshQuota()
      const state = await readSyncState()
      const cursor = config.binding.lastCursor

      // Pull
      const manifest = await api.manifest(vaultId, cursor)
      const occupied = new Set(
        Object.values(state.files).map(e => e.identityKey).filter(Boolean) as string[],
      )
      for (const change of manifest.changes) {
        if (change.op === 'upsert') {
          await applyRemoteUpsert(vaultId, change, state, occupied, config.binding.deviceId)
        } else if (change.op === 'delete' && change.path) {
          const identityKey = toIdentityKey(change.path)
          const localEntry = Object.entries(state.files).find(([, e]) => e.identityKey === identityKey)
          if (localEntry && (localEntry[1].status === 'dirty' || localEntry[1].status === 'conflict')) {
            // delete+edit: keep local content as conflict copy (design §9.3)
            const copyPath = buildConflictCopyPath(localEntry[0], config.binding.deviceId, occupied, toIdentityKey)
            occupied.add(toIdentityKey(copyPath))
            const localContent = await fs.readText(deps.rootPath, localEntry[0])
            await fs.writeText(deps.rootPath, copyPath, localContent)
            conflictPaths.push(copyPath)
            state.files[copyPath] = {
              fileId: null,
              identityKey: toIdentityKey(copyPath),
              localHash: await sha256Hex(localContent),
              remoteRev: null,
              status: 'dirty',
              size: new TextEncoder().encode(localContent).length,
              mtimeMs: Date.now(),
            }
          } else {
            try {
              await fs.delete(deps.rootPath, change.path)
            } catch {
              // already gone
            }
          }
          if (localEntry) delete state.files[localEntry[0]]
        } else if (change.op === 'rename' && change.from && change.path) {
          try {
            await fs.rename(deps.rootPath, change.from, change.path)
          } catch {
            // may already be at target after prior pull
          }
          const fromKey = toIdentityKey(change.from)
          const entry = Object.entries(state.files).find(([, e]) => e.identityKey === fromKey)
          if (entry) {
            const [, meta] = entry
            delete state.files[entry[0]]
            state.files[change.path] = {
              ...meta,
              identityKey: toIdentityKey(change.path),
              remoteRev: change.remoteRev,
              status: 'clean',
            }
          }
        }
      }
      config.binding.lastCursor = manifest.cursor
      await writeVaultJson(config)

      // Push local
      const localFiles = await listSyncableFiles()
      const remoteIdentity = new Set(
        Object.values(state.files)
          .filter(e => e.fileId && e.status === 'clean')
          .map(e => e.identityKey),
      )

      for (const file of localFiles) {
        const entry = state.files[file.displayPath]
          || Object.values(state.files).find(e => e.identityKey === file.identityKey)
        const dirty = !entry
          || entry.status === 'dirty'
          || entry.status === 'conflict'
          || !entry.localHash
          || normalizeContentHash(entry.localHash) !== normalizeContentHash(file.hash)
          || entry.remoteRev == null

        // Bootstrap merge: local-only files (no remote identity) still upload.
        if (!dirty && remoteIdentity.has(file.identityKey)) continue
        if (!dirty) continue

        if (overQuota) {
          setStatus('over-quota', '容量超额：已跳过 push，仍可 pull / 本地编辑', 'vault.quota.exceeded')
          break
        }
        try {
          state.files[file.displayPath] = await pushOne(vaultId, file, entry)
        } catch (err) {
          if (err instanceof VaultSyncApiError && err.isQuota) {
            overQuota = true
            setStatus('over-quota', err.message, err.businessCode)
            break
          }
          if (err instanceof VaultSyncApiError && err.isConflict) {
            // Fetch remote into conflict flow on next pull; mark local conflict.
            state.files[file.displayPath] = {
              fileId: entry?.fileId ?? null,
              identityKey: file.identityKey,
              localHash: file.hash,
              remoteRev: entry?.remoteRev ?? null,
              status: 'conflict',
              size: file.size,
              mtimeMs: file.mtimeMs,
            }
            conflictPaths.push(file.displayPath)
            continue
          }
          throw err
        }
      }

      await writeSyncState(state)
      if (conflictPaths.length) {
        setStatus('conflict', `同步完成，有 ${conflictPaths.length} 个冲突副本`, 'vault.conflict.rev')
      } else if (!overQuota) {
        setStatus('idle', '同步完成')
      }
      return getStatusSnapshot(config)
    } catch (err) {
      const code = err instanceof VaultSyncApiError ? err.businessCode : null
      const msg = err instanceof Error ? err.message : String(err)
      setStatus('error', msg, code)
      return getStatusSnapshot()
    }
  }

  function getStatusSnapshot(config?: VaultJson): SyncEngineStatus {
    return {
      status,
      message,
      lastCursor: config?.binding.lastCursor ?? null,
      cloudVaultId: config?.binding.cloudVaultId ?? null,
      overQuota,
      lastErrorCode,
      conflictPaths: [...conflictPaths],
    }
  }

  return {
    bind,
    pushPull,
    refreshQuota,
    listSyncableFiles,
    getStatus: () => getStatusSnapshot(),
    subscribe(listener: (s: SyncEngineStatus) => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

export type SyncEngine = ReturnType<typeof createSyncEngine>
