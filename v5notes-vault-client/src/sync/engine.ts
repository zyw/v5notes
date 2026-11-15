/**
 * SyncEngine — Phase 5 hardening (retry queue, attachments, idle background sync).
 * Design §9 + Phase 5 checklist.
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
import {
  attachmentBadgeLabel,
  base64ToBytes,
  bytesToBase64,
  classifyFileKind,
  isAttachmentTooLarge,
  prefersTextBody,
} from './attachments'
import { planBootstrap } from './bootstrap'
import { buildConflictCopyPath } from './conflict'
import { applySyncIgnore, parseSyncIgnore } from './exclude'
import { normalizeContentHash, sha256Hex } from './hash'
import { VaultQuotaRules } from './limits'
import { overQuotaPushMessage } from './quotaCopy'
import {
  createRetryQueue,
  RETRY_QUEUE_REL,
  type RetryQueue,
  type RetryQueueSnapshot,
} from './retryQueue'
import type {
  BootstrapPlan,
  LocalScanFile,
  SyncEngineStatus,
  SyncStatus,
  VaultChange,
  VaultDeviceInfo,
  VaultFileVersion,
  VaultQuota,
} from './types'

export interface SyncEngineDeps {
  rootPath: string
  getAuth: () => { server: string; clientId: string; token: string }
  onUnauthorized: () => void
  fs?: VaultFs
  api?: VaultSyncApi
  transport?: typeof fetch
  /** Injected for tests; defaults to navigator.onLine / true. */
  isOnline?: () => boolean
  /** Idle background sync interval (ms). 0 disables. Default 60s. */
  backgroundIntervalMs?: number
}

const DEFAULT_BG_INTERVAL_MS = 60_000

export function createSyncEngine(deps: SyncEngineDeps) {
  const fs = deps.fs ?? defaultVaultFs
  const api = deps.api ?? createVaultSyncApi(deps.getAuth, deps.onUnauthorized, deps.transport)
  const retryQueue: RetryQueue = createRetryQueue()
  const isOnline = deps.isOnline ?? (() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false)
  const backgroundIntervalMs = deps.backgroundIntervalMs ?? DEFAULT_BG_INTERVAL_MS

  let status: SyncStatus = 'idle'
  let message = '未同步'
  let lastErrorCode: string | null = null
  let overQuota = false
  let conflictPaths: string[] = []
  let skippedTooLarge: string[] = []
  let maxFileBytes = VaultQuotaRules.DEFAULT_MAX_FILE_BYTES
  let listeners = new Set<(s: SyncEngineStatus) => void>()
  let bgTimer: ReturnType<typeof setInterval> | null = null
  let syncInFlight = false
  let queueHydrated = false

  function emit() {
    const snap = getStatusSnapshot()
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

  async function persistRetryQueue(): Promise<void> {
    const snap = retryQueue.snapshot()
    await writeTextFile(
      await join(deps.rootPath, RETRY_QUEUE_REL),
      `${JSON.stringify(snap, null, 2)}\n`,
    )
  }

  async function hydrateRetryQueue(): Promise<void> {
    if (queueHydrated) return
    queueHydrated = true
    try {
      const raw = await readTextFile(await join(deps.rootPath, RETRY_QUEUE_REL))
      retryQueue.load(JSON.parse(raw) as RetryQueueSnapshot)
    } catch {
      retryQueue.load(null)
    }
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
        if (node.kind !== 'file' && node.kind !== 'note') continue
        const decision = applySyncIgnore(node.path, patterns)
        if (!decision.sync) continue

        const kind = decision.reason === 'intent-config'
          ? 'config' as const
          : classifyFileKind(node.path)
        const useText = prefersTextBody(node.path)

        try {
          if (useText) {
            const content = await fs.readText(deps.rootPath, node.path)
            const encoded = new TextEncoder().encode(content)
            const size = encoded.length
            const tooLarge = isAttachmentTooLarge(size, maxFileBytes)
            files.push({
              displayPath: node.path,
              identityKey: node.identityKey,
              content,
              hash: await sha256Hex(content),
              size,
              mtimeMs: Date.now(),
              kind,
              tooLarge,
            })
          } else {
            const bytes = await fs.readBytes(deps.rootPath, node.path)
            const size = bytes.byteLength
            const tooLarge = isAttachmentTooLarge(size, maxFileBytes)
            files.push({
              displayPath: node.path,
              identityKey: node.identityKey,
              base64Body: bytesToBase64(bytes),
              hash: await sha256Hex(bytes),
              size,
              mtimeMs: Date.now(),
              kind: 'asset',
              tooLarge,
            })
          }
        } catch {
          // Unreadable file — skip this cycle; watcher/next sync may recover.
        }
      }
    }

    await walk(tree)

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
          kind: 'config',
        })
      } catch {
        // optional
      }
    }

    return files
  }

  async function refreshQuota(): Promise<VaultQuota | null> {
    try {
      const quota = await api.quota()
      overQuota = Boolean(quota.overQuota || (quota.quotaBytes > 0 && quota.usedBytes >= quota.quotaBytes))
      if (quota.maxFileBytes && quota.maxFileBytes > 0) {
        maxFileBytes = quota.maxFileBytes
      }
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
    try {
      const bindResult = await api.bind(vaultId, {
        deviceId,
        clientInfo: 'v5notes-vault-client/phase5',
      })
      config.binding.cloudVaultId = bindResult.vaultId
      await writeVaultJson(config)

      const localFiles = await listSyncableFiles()
      const plan = planBootstrap({
        cloudHasContent: Boolean(bindResult.cloudHasContent),
        localSyncableFileCount: localFiles.length,
      })
      overQuota = Boolean(bindResult.quota?.overQuota)
      if (bindResult.quota?.maxFileBytes) maxFileBytes = bindResult.quota.maxFileBytes
      setStatus('idle', `已绑定 · ${plan.mode}`)
      return plan
    } catch (err) {
      if (err instanceof VaultSyncApiError && err.isQuota) {
        setStatus('over-quota', err.message || '同步设备数已达上限', err.businessCode)
      }
      throw err
    }
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
      type: file.kind,
      body: file.content,
      base64Body: file.base64Body,
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
    const identityKey = toIdentityKey(change.path)
    const localEntry = Object.entries(state.files).find(([, e]) => e.identityKey === identityKey
      || (e.fileId && e.fileId === change.fileId))
    const localPath = localEntry?.[0]
    const local = localEntry?.[1]

    const isBinary = Boolean(content.base64Body && !content.body)
    const remoteHash = change.contentHash
      ? normalizeContentHash(change.contentHash)
      : content.contentHash
        ? normalizeContentHash(content.contentHash)
        : null

    const localDirty = local && (local.status === 'dirty' || local.status === 'conflict')
    const hashMismatch = local?.localHash
      && remoteHash
      && normalizeContentHash(local.localHash) !== remoteHash

    if (localDirty && hashMismatch && localPath) {
      const copyPath = buildConflictCopyPath(localPath, deviceId, occupied, toIdentityKey)
      occupied.add(toIdentityKey(copyPath))
      if (prefersTextBody(localPath)) {
        const localContent = await fs.readText(deps.rootPath, localPath)
        await fs.writeText(deps.rootPath, copyPath, localContent)
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
        const localBytes = await fs.readBytes(deps.rootPath, localPath)
        await fs.writeBytes(deps.rootPath, copyPath, localBytes)
        state.files[copyPath] = {
          fileId: null,
          identityKey: toIdentityKey(copyPath),
          localHash: await sha256Hex(localBytes),
          remoteRev: null,
          status: 'dirty',
          size: localBytes.byteLength,
          mtimeMs: Date.now(),
        }
      }
      conflictPaths.push(copyPath)
    }

    if (isBinary && content.base64Body) {
      const bytes = base64ToBytes(content.base64Body)
      await fs.writeBytes(deps.rootPath, change.path, bytes)
      occupied.add(identityKey)
      state.files[change.path] = {
        fileId: change.fileId,
        identityKey,
        localHash: remoteHash ?? await sha256Hex(bytes),
        remoteRev: change.remoteRev,
        status: 'clean',
        size: change.size ?? bytes.byteLength,
        mtimeMs: Date.now(),
      }
    } else {
      const body = content.body ?? ''
      await fs.writeText(deps.rootPath, change.path, body)
      occupied.add(identityKey)
      state.files[change.path] = {
        fileId: change.fileId,
        identityKey,
        localHash: remoteHash ?? await sha256Hex(body),
        remoteRev: change.remoteRev,
        status: 'clean',
        size: change.size ?? new TextEncoder().encode(body).length,
        mtimeMs: Date.now(),
      }
    }
    if (localPath && localPath !== change.path) {
      delete state.files[localPath]
    }
  }

  async function enqueueTransientFailure(
    err: unknown,
    kind: 'push' | 'cycle',
    path?: string,
  ): Promise<void> {
    await hydrateRetryQueue()
    if (err instanceof VaultSyncApiError) {
      retryQueue.enqueue({
        kind,
        path,
        error: err.message,
        errorCode: err.businessCode,
        httpStatus: err.httpStatus,
      })
    } else {
      retryQueue.enqueue({
        kind,
        path,
        error: err instanceof Error ? err.message : String(err),
        httpStatus: 0,
      })
    }
    await persistRetryQueue()
  }

  /**
   * One sync cycle: pull manifest, merge with conflict copies, push local dirty/new.
   */
  async function pushPull(): Promise<SyncEngineStatus> {
    await hydrateRetryQueue()
    const auth = deps.getAuth()
    if (!auth.token) {
      setStatus('error', '未登录，本地编辑仍可用', 'auth.unauthorized')
      return getStatusSnapshot()
    }
    if (!isOnline()) {
      setStatus('offline', '网络不可用，变更已入重试队列', null)
      retryQueue.enqueue({ kind: 'cycle', error: 'offline', httpStatus: 0 })
      await persistRetryQueue()
      return getStatusSnapshot()
    }

    if (syncInFlight) return getStatusSnapshot()
    syncInFlight = true
    conflictPaths = []
    skippedTooLarge = []
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
            const copyPath = buildConflictCopyPath(localEntry[0], config.binding.deviceId, occupied, toIdentityKey)
            occupied.add(toIdentityKey(copyPath))
            if (prefersTextBody(localEntry[0])) {
              const localContent = await fs.readText(deps.rootPath, localEntry[0])
              await fs.writeText(deps.rootPath, copyPath, localContent)
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
              const localBytes = await fs.readBytes(deps.rootPath, localEntry[0])
              await fs.writeBytes(deps.rootPath, copyPath, localBytes)
              state.files[copyPath] = {
                fileId: null,
                identityKey: toIdentityKey(copyPath),
                localHash: await sha256Hex(localBytes),
                remoteRev: null,
                status: 'dirty',
                size: localBytes.byteLength,
                mtimeMs: Date.now(),
              }
            }
            conflictPaths.push(copyPath)
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
        if (file.tooLarge) {
          skippedTooLarge.push(attachmentBadgeLabel(file.displayPath, maxFileBytes))
          continue
        }

        const entry = state.files[file.displayPath]
          || Object.values(state.files).find(e => e.identityKey === file.identityKey)
        const dirty = !entry
          || entry.status === 'dirty'
          || entry.status === 'conflict'
          || !entry.localHash
          || normalizeContentHash(entry.localHash) !== normalizeContentHash(file.hash)
          || entry.remoteRev == null

        if (!dirty && remoteIdentity.has(file.identityKey)) continue
        if (!dirty) continue

        if (overQuota) {
          setStatus('over-quota', overQuotaPushMessage(), 'vault.quota.exceeded')
          break
        }
        try {
          state.files[file.displayPath] = await pushOne(vaultId, file, entry)
        } catch (err) {
          if (err instanceof VaultSyncApiError && err.isQuota) {
            overQuota = true
            setStatus('over-quota', err.message || overQuotaPushMessage(), err.businessCode)
            break
          }
          if (err instanceof VaultSyncApiError && err.isTooLarge) {
            skippedTooLarge.push(attachmentBadgeLabel(file.displayPath, maxFileBytes))
            continue
          }
          if (err instanceof VaultSyncApiError && err.isConflict) {
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
          if (err instanceof VaultSyncApiError && err.isRetryable) {
            await enqueueTransientFailure(err, 'push', file.displayPath)
            continue
          }
          // Unknown / network — queue and continue other files
          await enqueueTransientFailure(err, 'push', file.displayPath)
        }
      }

      await writeSyncState(state)
      await persistRetryQueue()

      if (conflictPaths.length) {
        setStatus('conflict', `同步完成，有 ${conflictPaths.length} 个冲突副本`, 'vault.conflict.rev')
      } else if (skippedTooLarge.length && !overQuota) {
        setStatus('idle', `同步完成（${skippedTooLarge.length} 个附件超限已跳过）`)
      } else if (retryQueue.pendingCount() > 0 && !overQuota) {
        setStatus('retrying', `部分失败，已入重试队列（${retryQueue.pendingCount()}）`)
      } else if (!overQuota) {
        setStatus('idle', '同步完成')
      }
      return getStatusSnapshot(config)
    } catch (err) {
      const code = err instanceof VaultSyncApiError ? err.businessCode : null
      const msg = err instanceof Error ? err.message : String(err)
      if (!(err instanceof VaultSyncApiError) || err.isRetryable || err.httpStatus === 0) {
        await enqueueTransientFailure(err, 'cycle')
        setStatus(isOnline() ? 'retrying' : 'offline', msg, code)
      } else {
        setStatus('error', msg, code)
      }
      return getStatusSnapshot()
    } finally {
      syncInFlight = false
    }
  }

  async function flushRetryQueue(): Promise<SyncEngineStatus> {
    await hydrateRetryQueue()
    if (!isOnline()) {
      setStatus('offline', '网络不可用，等待重连后重试', null)
      return getStatusSnapshot()
    }
    const ready = retryQueue.ready()
    if (ready.length === 0 && retryQueue.pendingCount() === 0) {
      return pushPull()
    }
    setStatus('retrying', `重试队列 ${ready.length || retryQueue.pendingCount()} 项…`)
    // Full cycle recovers cursor + dirty files; individual push items are covered by rescan.
    for (const item of ready) {
      retryQueue.markSuccess(item.id)
    }
    await persistRetryQueue()
    return pushPull()
  }

  function startBackgroundSync(): () => void {
    stopBackgroundSync()
    if (backgroundIntervalMs <= 0) return () => {}
    bgTimer = setInterval(() => {
      if (!isOnline()) return
      if (syncInFlight) return
      const auth = deps.getAuth()
      if (!auth.token) return
      void (async () => {
        await hydrateRetryQueue()
        if (retryQueue.pendingCount() > 0 || retryQueue.ready().length > 0) {
          await flushRetryQueue()
        } else {
          // Idle opportunistic sync when already bound.
          try {
            const config = await readVaultJson()
            if (config.binding.cloudVaultId) await pushPull()
          } catch {
            /* ignore idle failures */
          }
        }
      })()
    }, backgroundIntervalMs)
    return stopBackgroundSync
  }

  function stopBackgroundSync(): void {
    if (bgTimer) {
      clearInterval(bgTimer)
      bgTimer = null
    }
  }

  async function listDevices(): Promise<VaultDeviceInfo[]> {
    const config = await readVaultJson()
    const vaultId = config.binding.cloudVaultId
    if (!vaultId) return []
    return api.listDevices(vaultId)
  }

  async function kickDevice(deviceId: string): Promise<void> {
    const config = await readVaultJson()
    const vaultId = config.binding.cloudVaultId
    if (!vaultId) throw new VaultSyncApiError('尚未绑定云端库', 404, 'vault.not.found')
    await api.kickDevice(vaultId, deviceId)
  }

  async function listFileVersions(path: string): Promise<VaultFileVersion[]> {
    const config = await readVaultJson()
    const vaultId = config.binding.cloudVaultId
    if (!vaultId) return []
    return api.listVersions(vaultId, path)
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
      skippedTooLarge: [...skippedTooLarge],
      retryQueueSize: retryQueue.size(),
      online: isOnline(),
    }
  }

  return {
    bind,
    pushPull,
    flushRetryQueue,
    startBackgroundSync,
    stopBackgroundSync,
    refreshQuota,
    listSyncableFiles,
    listDevices,
    kickDevice,
    listFileVersions,
    getRetryQueue: () => retryQueue.list(),
    getStatus: () => getStatusSnapshot(),
    subscribe(listener: (s: SyncEngineStatus) => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

export type SyncEngine = ReturnType<typeof createSyncEngine>
