/**
 * SyncEngine — Phase 5 hardening (retry queue, attachments, idle background sync).
 * Design §9 + Phase 5 checklist.
 */

import { join } from '@tauri-apps/api/path'
import { readDir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import type { SyncFileEntry, SyncStateJson } from '../models/sync-state'
import { SYNC_STATE_SCHEMA_VERSION } from '../models/sync-state'
import type { VaultJson } from '../models/vault'
import { toIdentityKey, normalizeVaultPath } from '../path/identity'
import { DOC_KINDS, type DocKindSpec } from '../vault/docKinds'
import { SYNC_STATE_REL, SYNCIGNORE_REL, VAULT_JSON_REL } from '../vault/skeleton'
import type { VaultFs } from '../vault/vaultFs'
import { vaultFs as defaultVaultFs } from '../vault/vaultFs'
import { createVaultSyncApi, toNumericBytes, VaultSyncApiError, type VaultSyncApi } from './api'
import {
  attachmentBadgeLabel,
  classifyFileKind,
  isAttachmentTooLarge,
  prefersTextBody,
} from './attachments'
import { downloadAttachment, DownloadError } from './download'
import { planBootstrap } from './bootstrap'
import { buildConflictCopyPath } from './conflict'
import { describeFileHash as describeHash } from './diagnostics'
import { getDeviceId } from '../account/deviceIdentity'
import { bindLabelForVault, rememberLocalDeviceName } from './localDeviceNames'
import { applySyncIgnore, parseSyncIgnore } from './exclude'
import { normalizeContentHash, sha256Hex } from './hash'
import { VaultQuotaRules } from './limits'
import { overQuotaPushMessage } from './quotaCopy'
import {
  createRetryQueue,
  isRetryableError,
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
  VaultReplicaInfo,
  VaultFileVersion,
  VaultQuota,
} from './types'

/** Leaf name of a vault path, used as the multipart filename. */
function leafName(path: string): string {
  return path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path
}

/** Absolute prefix for proxy download paths returned by the server. */
function v3UrlPrefix(server: string): string {
  return server.replace(/\/+$/, '')
}

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
  /**
   * Core plus plugin-declared document kinds. Notes sync and conflict-copy as
   * text; everything else is an asset. Defaults to the core kinds.
   */
  docKinds?: () => readonly DocKindSpec[]
}

const DEFAULT_BG_INTERVAL_MS = 60_000

type VaultJsonWithLegacyBinding = VaultJson & {
  binding: VaultJson['binding'] & { deviceId?: string }
}

/**
 * A vault.json written before the replica field was renamed may still carry the
 * id under its old name. Map it once, in the one place every reader goes
 * through, so a bound vault keeps its binding row instead of looking unbound
 * and taking a new id at the next bind.
 */
function migrateBindingDeviceId(config: VaultJsonWithLegacyBinding): VaultJson {
  if (!config.binding) return config
  if (!config.binding.replicaId && config.binding.deviceId) {
    config.binding.replicaId = config.binding.deviceId
  }
  delete config.binding.deviceId
  return config
}

/** Replica id of the open vault, minted when the file has none. */
function ensureReplicaId(config: VaultJson): string {
  if (!config.binding.replicaId) config.binding.replicaId = crypto.randomUUID()
  return config.binding.replicaId
}

export function createSyncEngine(deps: SyncEngineDeps) {
  const fs = deps.fs ?? defaultVaultFs
  const api = deps.api ?? createVaultSyncApi(deps.getAuth, deps.onUnauthorized, deps.transport)
  const retryQueue: RetryQueue = createRetryQueue()
  const isOnline = deps.isOnline ?? (() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false)
  const backgroundIntervalMs = deps.backgroundIntervalMs ?? DEFAULT_BG_INTERVAL_MS
  const docKinds = () => deps.docKinds?.() ?? DOC_KINDS

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
    return migrateBindingDeviceId(JSON.parse(raw) as VaultJsonWithLegacyBinding)
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
    const tree = await fs.listTree(deps.rootPath, docKinds(), { includeAttachments: true })
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
          : classifyFileKind(node.path, docKinds())
        // Backend requires all `asset` files (including .svg/.json/.csv) to go through
        // multipart `/assets` upload + asset reference commit (design §4.2.1 / D5).
        const useText = kind === 'note' || kind === 'config'

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
              // Bytes are uploaded through the multipart attachment endpoint (design D5);
              // no base64 copy is built here any more.
              bytes,
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

    const configCandidates = ['.v5notes/appearance.json']
    try {
      const pluginDirs = await readDir(await join(deps.rootPath, '.v5notes', 'plugins'))
      for (const dir of pluginDirs) {
        if (dir.isDirectory && dir.name && !dir.name.startsWith('.')) {
          configCandidates.push(`.v5notes/plugins/${dir.name}/data.json`)
        }
      }
    } catch {
      // .v5notes/plugins is optional
    }

    for (const rel of configCandidates) {
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
      const raw = await api.quota()
      // normalizeIds can stringify >2^53 numbers; coerce byte sizes back to
      // numeric so guards never degrade into NaN comparisons (silent pass).
      const quotaBytes = toNumericBytes(raw.quotaBytes)
      const usedBytes = toNumericBytes(raw.usedBytes)
      const maxFile = toNumericBytes(raw.maxFileBytes ?? undefined)
      overQuota = Boolean(raw.overQuota || (quotaBytes > 0 && usedBytes >= quotaBytes))
      if (maxFile > 0) {
        maxFileBytes = maxFile
      }
      // Hand the UI numeric sizes so display never sees stringified numbers.
      return { ...raw, usedBytes, quotaBytes, maxFileBytes: maxFile || undefined }
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
    const replicaId = ensureReplicaId(config)
    config.binding.server = auth.server

    const vaultName = options?.vaultName || config.name
    let vaultId = options?.existingVaultId || config.binding.cloudVaultId
    if (!vaultId) {
      const created = await api.createVault(vaultName)
      vaultId = created.vaultId
    }
    try {
      const userAgent = typeof navigator === 'undefined' ? null : navigator.userAgent
      const deviceId = getDeviceId()
      const label = bindLabelForVault(vaultName, deviceId, userAgent)
      const bindResult = await api.bind(vaultId, {
        replicaId,
        deviceId,
        clientInfo: label,
      })
      // Remembered so this machine can recognise its own row when bound devices
      // are listed (the server never says which row is the caller's).
      rememberLocalDeviceName(auth.server, bindResult.vaultId, label)
      config.binding.cloudVaultId = bindResult.vaultId
      await writeVaultJson(config)

      const localFiles = await listSyncableFiles()
      const plan = planBootstrap({
        cloudHasContent: Boolean(bindResult.cloudHasContent),
        localSyncableFileCount: localFiles.length,
      })
      overQuota = Boolean(bindResult.quota?.overQuota)
      const bindMaxFile = toNumericBytes(bindResult.quota?.maxFileBytes)
      if (bindMaxFile > 0) maxFileBytes = bindMaxFile
      setStatus('idle', `已绑定 · ${plan.mode}`)
      return plan
    } catch (err) {
      if (err instanceof VaultSyncApiError && err.isQuota) {
        setStatus('over-quota', err.message || '同步副本数已达上限', err.businessCode)
      }
      throw err
    }
  }

  async function pushOne(
    vaultId: string,
    file: LocalScanFile,
    entry: SyncFileEntry | undefined,
  ): Promise<SyncFileEntry> {
    // Assets travel as multipart first, then commit a reference (design §4.1). A retry after a
    // failed commit is cheap: the server deduplicates by content hash and returns the same id.
    let asset: { assetId: string; sizeBytes: number } | undefined
    if (file.kind === 'asset' && file.bytes) {
      const uploaded = await api.uploadAsset(vaultId, {
        bytes: file.bytes,
        sha256: file.hash,
        fileName: leafName(file.displayPath),
      })
      asset = { assetId: uploaded.assetId, sizeBytes: uploaded.sizeBytes }
    }

    const meta = await api.putFile(vaultId, {
      path: file.displayPath,
      fileId: entry?.fileId,
      baseRev: entry?.remoteRev ?? 0,
      hash: file.hash,
      type: file.kind,
      body: file.content,
      asset,
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

  /** Hash an untracked on-disk file (text or binary) for bootstrap comparison. */
  async function hashUntrackedFile(path: string): Promise<string> {
    if (prefersTextBody(path, docKinds())) {
      return sha256Hex(await fs.readText(deps.rootPath, path))
    }
    return sha256Hex(await fs.readBytes(deps.rootPath, path))
  }

  /** Find an on-disk file whose identity key matches, for bootstrap conflict copies. */
  async function findOnDiskPathByIdentity(identityKey: string): Promise<string | null> {
    try {
      const tree = await fs.listTree(deps.rootPath, docKinds(), { includeAttachments: true })
      const stack = [...tree]
      while (stack.length > 0) {
        const node = stack.pop()!
        if (node.kind === 'dir') {
          if (node.children) stack.push(...node.children)
          continue
        }
        if (node.identityKey === identityKey) return node.path
      }
    } catch {
      // unreadable tree
    }
    return null
  }

  async function applyRemoteUpsert(
    vaultId: string,
    change: VaultChange,
    state: SyncStateJson,
    occupied: Set<string>,
    replicaId: string | null,
  ): Promise<void> {
    if (!change.path) return
    let content
    try {
      content = await api.getContent(vaultId, change.path, change.remoteRev)
    } catch (err) {
      // Requested rev is no longer current (design §8.2 / §9.2): skip this change
      // without writing stale bytes to disk; the newer rev in this or next cycle lands cleanly.
      if (err instanceof VaultSyncApiError && err.isConflict) {
        return
      }
      throw err
    }
    const identityKey = toIdentityKey(change.path)
    const localEntry = Object.entries(state.files).find(([, e]) => e.identityKey === identityKey
      || (e.fileId && e.fileId === change.fileId))
    const localPath = localEntry?.[0]
    const local = localEntry?.[1]

    const isAsset = Boolean(content.download)
    const remoteHash = change.contentHash
      ? normalizeContentHash(change.contentHash)
      : content.contentHash
        ? normalizeContentHash(content.contentHash)
        : null

    const localDirty = local && (local.status === 'dirty' || local.status === 'conflict')
    const hashMismatch = local?.localHash
      && remoteHash
      && normalizeContentHash(local.localHash) !== remoteHash

    // Bootstrap merge (design §9.3 "两端都有内容"): a local file exists on disk but has
    // no sync-state entry yet (first bind). If its content differs from the remote
    // baseline, the local copy must be preserved as a conflict copy — never silently
    // overwritten by the cloud baseline pull.
    let localExistsUntracked = false
    let untrackedLocalPath: string | null = null
    if (!localPath) {
      try {
        if (await fs.exists(deps.rootPath, change.path)) {
          localExistsUntracked = true
          untrackedLocalPath = change.path
        } else {
          // Case-variant display path may exist on disk for the same identity key.
          const tree = await fs.listTree(deps.rootPath, docKinds())
          const stack = [...tree]
          while (stack.length > 0) {
            const node = stack.pop()!
            if (node.kind === 'dir') {
              if (node.children) stack.push(...node.children)
              continue
            }
            if (node.identityKey === identityKey) {
              localExistsUntracked = true
              untrackedLocalPath = node.path
              break
            }
          }
        }
      } catch {
        // Unreadable tree — treat as no local file; pull proceeds.
      }
    }
    // Same content on both sides is not a conflict: the cloud baseline simply
    // adopts the existing local file without a copy.
    const untrackedMatchesRemote = localExistsUntracked
      && remoteHash != null
      && untrackedLocalPath != null
      && (await hashUntrackedFile(untrackedLocalPath)) === remoteHash
    const bootstrapConflict = localExistsUntracked && !untrackedMatchesRemote && remoteHash != null

    if (bootstrapConflict || (localDirty && hashMismatch && localPath)) {
      // Conflict-copy source: the tracked dirty path, or the on-disk case-variant path
      // when bootstrapping against an untracked local file.
      const sourcePath = localPath
        ?? untrackedLocalPath
        ?? (await findOnDiskPathByIdentity(identityKey)) ?? change.path
      const copyPath = buildConflictCopyPath(sourcePath, replicaId, occupied, toIdentityKey)
      occupied.add(toIdentityKey(copyPath))
      if (prefersTextBody(sourcePath, docKinds())) {
        const localContent = await fs.readText(deps.rootPath, sourcePath)
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
        const localBytes = await fs.readBytes(deps.rootPath, sourcePath)
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

    if (isAsset && content.download) {
      // Follow the descriptor: direct presigned link, or the vault proxy endpoint (design §3.3).
      const auth = deps.getAuth()
      const bytes = await downloadAttachment(content.download, {
        baseUrl: v3UrlPrefix(auth.server),
        token: auth.token,
        clientId: auth.clientId,
        onUnauthorized: deps.onUnauthorized,
        transport: deps.transport,
      })
      const actualHash = normalizeContentHash(await sha256Hex(bytes))
      if (remoteHash && actualHash !== remoteHash) {
        throw new DownloadError('附件下载内容哈希校验失败，已中止写入', true)
      }
      await fs.writeBytes(deps.rootPath, change.path, bytes)
      occupied.add(identityKey)
      state.files[change.path] = {
        fileId: change.fileId,
        identityKey,
        localHash: remoteHash ?? actualHash,
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
    const errorCode = err instanceof VaultSyncApiError ? err.businessCode : null
    const httpStatus = err instanceof VaultSyncApiError ? err.httpStatus : 0
    // Permanent items are never retried, so appending another one only grows
    // the list: a fixed defect that keeps hitting the same file would otherwise
    // pile up one dead entry per cycle.
    if (!isRetryableError(errorCode, httpStatus)) {
      const duplicate = retryQueue.list().some(item =>
        item.kind === kind
        && item.path === path
        && item.lastErrorCode === errorCode)
      if (duplicate) return
    }
    retryQueue.enqueue({
      kind,
      path,
      error: err instanceof Error ? err.message : String(err),
      errorCode,
      httpStatus,
    })
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
      // The server indexes this copy by replica id; a snapshot without one
      // (hand-edited, or written before the field existed) must not sync, or
      // every later bind would create a fresh binding row.
      const replicaId = config.binding.replicaId
      if (!replicaId) {
        setStatus('error', '本地副本标识缺失，请重新绑定', 'vault.replica.missing')
        return getStatusSnapshot(config)
      }

      await refreshQuota()
      const state = await readSyncState()
      const cursor = config.binding.lastCursor

      // Pull — page through manifest until exhausted (design §8.2 pagination).
      const occupied = new Set(
        Object.values(state.files).map(e => e.identityKey).filter(Boolean) as string[],
      )
      let pullCursor: string | null = cursor
      // Conflict-copy paths are local-only records of earlier protections;
      // they must never be treated as a remote change's own state reference.
      const isCopyPath = (path: string) => path.includes('冲突')
      for (;;) {
        const manifest = await api.manifest(vaultId, pullCursor)
        for (const change of manifest.changes) {
          if (change.op === 'upsert') {
            await applyRemoteUpsert(vaultId, change, state, occupied, config.binding.replicaId)
          } else if (change.op === 'delete' && change.path) {
            const identityKey = toIdentityKey(change.path)
            const localEntry = Object.entries(state.files).find(
              ([path, e]) => (e.identityKey === identityKey || toIdentityKey(path) === identityKey) && !isCopyPath(path),
            )
            if (localEntry && (localEntry[1].status === 'dirty' || localEntry[1].status === 'conflict')) {
              // §9.3 删改冲突：改胜于删。Keep the edited content at its original
              // path and drop the sync-state reference to the tombstoned file.
              // The push phase then sees the surviving disk file as untracked and
              // re-uploads it under a NEW fileId (§8.2: recreate after tombstone
              // gets a new identity reference). No rename, no conflict copy —
              // the user keeps editing hot.md without noticing the churn, and
              // version history follows the new fileId per spec.
            } else if (localEntry && !localEntry[1].fileId) {
              // Untracked ghost entry (no fileId): nothing was ever uploaded
              // under this identity, so the cloud tombstone is not ours to
              // apply — keep the local file; the push phase uploads it as new.
            } else {
              try {
                await fs.delete(deps.rootPath, change.path)
              } catch {
                // already gone
              }
              if (localEntry) delete state.files[localEntry[0]]
            }
            // Drop any stray non-copy records still pointing at the tombstoned
            // identity (e.g. case-variant display paths). The protected branch
            // above intentionally keeps the file on disk and lets the push
            // phase re-upload it, so its record is deleted here too.
            for (const [path, e] of Object.entries(state.files)) {
              if (!isCopyPath(path) && e.identityKey === identityKey) delete state.files[path]
            }
          } else if (change.op === 'rename' && change.from && change.path) {
            const fromKey = toIdentityKey(change.from)
            // Conflict-copy paths are local-only records; never treat one as
            // the renamed file's own state entry.
            const entry = Object.entries(state.files).find(
              ([path, e]) => !isCopyPath(path) && (e.identityKey === fromKey || toIdentityKey(path) === fromKey),
            )
            // Preserve local edits BEFORE moving change.from away (§9.3 rename×edit);
            // checking change.from after fs.rename would always see it missing.
            if (entry) {
              const [, meta] = entry
              if ((meta.status === 'dirty' || meta.status === 'conflict') && meta.fileId) {
                try {
                  if (await fs.exists(deps.rootPath, change.from)) {
                    const copyPath = buildConflictCopyPath(change.from, config.binding.replicaId, occupied, toIdentityKey)
                    occupied.add(toIdentityKey(copyPath))
                    if (prefersTextBody(change.from, docKinds())) {
                      const localContent = await fs.readText(deps.rootPath, change.from)
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
                      const localBytes = await fs.readBytes(deps.rootPath, change.from)
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
                } catch {
                  // unreadable source — proceed; nothing is lost from the cloud side
                }
              }
            }
            try {
              await fs.rename(deps.rootPath, change.from, change.path)
            } catch {
              // may already be at target after prior pull
            }
            if (entry) {
              const [, meta] = entry
              delete state.files[entry[0]]
              state.files[change.path] = {
                ...meta,
                identityKey: toIdentityKey(change.path),
                remoteRev: change.remoteRev,
                status: 'dirty',
              }
            }
          }
        }
        if (manifest.hasMore && manifest.changes.length > 0) {
          pullCursor = manifest.cursor
          continue
        }
        // Final page (or stale hasMore with an empty page): commit sync-state before cursor
        // so an interruption during push never advances lastCursor ahead of sync-state.json.
        config.binding.lastCursor = manifest.cursor
        break
      }
      await writeSyncState(state)
      await writeVaultJson(config)

      // Push local
      const localFiles = await listSyncableFiles()
      const remoteIdentity = new Set(
        Object.values(state.files)
          .filter(e => e.fileId && e.status === 'clean')
          .map(e => e.identityKey),
      )

      // Local renames and deletes must propagate as explicit rename/tombstone ops,
      // never as silent delete+create (design §6.2 / §9.4).
      const localIdentity = new Set(localFiles.map(f => f.identityKey))
      const renamedLocally = new Set<string>() // identity keys already claimed by a rename this cycle
      for (const [path, entry] of Object.entries(state.files)) {
        if (!entry.fileId || entry.status !== 'clean') continue
        if (localIdentity.has(entry.identityKey)) continue
        // Tracked clean file vanished from disk since last cycle.
        if (overQuota) break
        // Look for a candidate untracked local file that plausibly is the rename target:
        // same kind (note→.md, asset→non-md), not already in sync-state under any path
        // with a fileId, and not the source of another rename.
        const renameTarget = localFiles.find(candidate => {
          if (candidate.tooLarge) return false
          if (candidate.kind !== classifyFileKind(path, docKinds())) return false
          if (renamedLocally.has(candidate.identityKey)) return false
          // Require matching content hash so delete A + create unrelated B is never
          // misclassified as a rename that silently drops B's body.
          if (entry.localHash && normalizeContentHash(candidate.hash) !== normalizeContentHash(entry.localHash)) {
            return false
          }
          const candidateEntry = state.files[candidate.displayPath]
            || Object.values(state.files).find(e => e.identityKey === candidate.identityKey)
          // Untracked only: a tracked-but-dirty file is an edit, not a rename target.
          return !candidateEntry || (!candidateEntry.fileId && candidateEntry.status !== 'conflict')
        })
        try {
          if (renameTarget) {
            const renamedMeta = await api.rename(vaultId, {
              from: path,
              to: renameTarget.displayPath,
              baseRev: entry.remoteRev ?? 0,
            })
            renamedLocally.add(renameTarget.identityKey)
            delete state.files[path]
            state.files[renameTarget.displayPath] = {
              fileId: entry.fileId,
              identityKey: renameTarget.identityKey,
              localHash: renameTarget.hash,
              remoteRev: renamedMeta?.remoteRev ?? entry.remoteRev,
              status: 'clean',
              size: renameTarget.size,
              mtimeMs: renameTarget.mtimeMs,
            }
          } else {
            await api.deleteFile(vaultId, { path, baseRev: entry.remoteRev ?? 0 })
            delete state.files[path]
          }
        } catch (err) {
          if (err instanceof VaultSyncApiError && err.isConflict) {
            // Remote moved on while we deleted/renamed locally; surface for user review.
            state.files[path] = { ...entry, status: 'conflict' }
            conflictPaths.push(path)
            continue
          }
          if (err instanceof VaultSyncApiError && err.isRetryable) {
            await enqueueTransientFailure(err, 'push', path)
            continue
          }
          if (err instanceof VaultSyncApiError && err.isQuota) {
            overQuota = true
            setStatus('over-quota', err.message || overQuotaPushMessage(), err.businessCode)
            break
          }
          await enqueueTransientFailure(err, 'push', path)
        }
      }

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
          for (const item of retryQueue.list()) {
            if (item.kind === 'push' && item.path === file.displayPath) {
              retryQueue.markSuccess(item.id)
            }
          }
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
      } else if (retryQueue.deadItems().length > 0 && !overQuota) {
        const dead = retryQueue.deadItems()
        setStatus(
          'error',
          dead[0]?.lastError || `部分文件同步失败（${dead.length}）`,
          dead[0]?.lastErrorCode ?? null,
        )
      } else if (!overQuota) {
        setStatus('idle', '同步完成')
      }
      return getStatusSnapshot(config)
    } catch (err) {
      const code = err instanceof VaultSyncApiError ? err.businessCode : null
      const msg = err instanceof Error ? err.message : String(err)
      const retryable = err instanceof VaultSyncApiError
        ? err.isRetryable || err.httpStatus === 0
        : err instanceof DownloadError
          ? err.retryable
          : true
      if (retryable) {
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
    // Run the cycle first; only clear ready items on success so exponential backoff
    // and maxAttempts are preserved across consecutive failures.
    const snap = await pushPull()
    if (snap.status === 'idle' || snap.status === 'conflict') {
      for (const item of ready) {
        retryQueue.markSuccess(item.id)
      }
      await persistRetryQueue()
    } else if (ready.length > 0) {
      for (const item of ready) {
        retryQueue.markFailure(item.id, snap.message || '重试失败')
      }
      await persistRetryQueue()
    }
    return snap
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
        // Only items whose backoff elapsed may drive the timer; dead items are
        // listed in the UI but must not make the engine retry on their own.
        if (retryQueue.ready().length > 0) {
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

  /** Read-only: how this note would be hashed and sent right now. */
  async function describeFileHash(relativePath: string) {
    return describeHash(deps.rootPath, relativePath, fs)
  }

  async function listReplicas(): Promise<VaultReplicaInfo[]> {
    const config = await readVaultJson()
    const vaultId = config.binding.cloudVaultId
    if (!vaultId) return []
    return api.listReplicas(vaultId)
  }

  async function kickReplica(replicaId: string): Promise<void> {
    const config = await readVaultJson()
    const vaultId = config.binding.cloudVaultId
    if (!vaultId) throw new VaultSyncApiError('尚未绑定云端库', 404, 'vault.not.found')
    await api.kickReplica(vaultId, replicaId)
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
    listReplicas,
    kickReplica,
    describeFileHash,
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
