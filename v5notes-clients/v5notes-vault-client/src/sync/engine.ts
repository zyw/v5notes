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
import { DOC_KINDS, type DocKindSpec } from '../vault/docKinds'
import { SYNC_STATE_REL, SYNCIGNORE_REL, VAULT_JSON_REL } from '../vault/skeleton'
import type { VaultFs } from '../vault/vaultFs'
import { vaultFs as defaultVaultFs } from '../vault/vaultFs'
import { createVaultSyncApi, toNumericBytes, VaultSyncApiError, type VaultSyncApi } from './api'
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
  /**
   * Core plus plugin-declared document kinds. Notes sync and conflict-copy as
   * text; everything else is an asset. Defaults to the core kinds.
   */
  docKinds?: () => readonly DocKindSpec[]
}

const DEFAULT_BG_INTERVAL_MS = 60_000

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
    const tree = await fs.listTree(deps.rootPath, docKinds())
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
        const useText = prefersTextBody(node.path, docKinds())

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
      const bindMaxFile = toNumericBytes(bindResult.quota?.maxFileBytes)
      if (bindMaxFile > 0) maxFileBytes = bindMaxFile
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
      const tree = await fs.listTree(deps.rootPath, docKinds())
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
      const copyPath = buildConflictCopyPath(sourcePath, deviceId, occupied, toIdentityKey)
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
            await applyRemoteUpsert(vaultId, change, state, occupied, config.binding.deviceId)
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
            try {
              await fs.rename(deps.rootPath, change.from, change.path)
            } catch {
              // may already be at target after prior pull
            }
            const fromKey = toIdentityKey(change.from)
            // Conflict-copy paths are local-only records; never treat one as
            // the renamed file's own state entry.
            const entry = Object.entries(state.files).find(
              ([path, e]) => !isCopyPath(path) && (e.identityKey === fromKey || toIdentityKey(path) === fromKey),
            )
            if (entry) {
              const [, meta] = entry
              delete state.files[entry[0]]
              // Local edits at the source survive as a conflict copy (§9.3
              // rename×edit); never push them over the renamed cloud body.
              let copyPath: string | null = null
              if ((meta.status === 'dirty' || meta.status === 'conflict') && meta.fileId) {
                try {
                  if (await fs.exists(deps.rootPath, change.from)) {
                    copyPath = buildConflictCopyPath(change.from, config.binding.deviceId, occupied, toIdentityKey)
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
              // Body at the target is stale until the rename's follow-up upsert
              // change refetches it (backend logs rename as metadata-only). The
              // disk content moved with the path, so keep meta.localHash — the
              // pull's clean-vs-remote hash check detects staleness there.
              // Marking dirty (not clean) prevents this cycle's push from
              // mistaking the renamed file for a vanished local rename/tombstone
              // while its body is still pending; the upsert rewrites the entry
              // clean when the new rev's content lands. Local edits were
              // preserved above as a conflict copy (§9.3 rename×edit).
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
        // Final page (or stale hasMore with an empty page): commit the cursor.
        config.binding.lastCursor = manifest.cursor
        break
      }
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
          const candidateEntry = state.files[candidate.displayPath]
            || Object.values(state.files).find(e => e.identityKey === candidate.identityKey)
          // Untracked only: a tracked-but-dirty file is an edit, not a rename target.
          return !candidateEntry || (!candidateEntry.fileId && candidateEntry.status !== 'conflict')
        })
        try {
          if (renameTarget) {
            await api.rename(vaultId, {
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
              remoteRev: entry.remoteRev,
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
