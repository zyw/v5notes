import { VaultErrorCode } from '../models/errors'
import type {
  VaultBindResult,
  VaultReplicaInfo,
  VaultFileContent,
  VaultFileMeta,
  VaultFileVersion,
  VaultManifest,
  VaultQuota,
  VaultSpaceSummary,
} from './types'

export class VaultSyncApiError extends Error {
  readonly httpStatus: number
  readonly businessCode: string | null
  readonly data: unknown

  constructor(message: string, httpStatus: number, businessCode: string | null, data?: unknown) {
    super(message)
    this.name = 'VaultSyncApiError'
    this.httpStatus = httpStatus
    this.businessCode = businessCode
    this.data = data
  }

  get isConflict(): boolean {
    return this.httpStatus === 409
      || this.businessCode === VaultErrorCode.CONFLICT_REV
      || this.businessCode === VaultErrorCode.CONFLICT_PATH_EXISTS
  }

  get isQuota(): boolean {
    return this.httpStatus === 402 || this.httpStatus === 403
      || this.businessCode === VaultErrorCode.QUOTA_EXCEEDED
      || this.businessCode === VaultErrorCode.QUOTA_DEVICES_EXCEEDED
  }

  get isTooLarge(): boolean {
    return this.httpStatus === 413 || this.businessCode === VaultErrorCode.FILE_TOO_LARGE
  }

  /**
   * A declared hash that does not match the uploaded bytes is deterministic:
   * re-sending the same body can never succeed, so retrying only grows the queue.
   */
  get isHashMismatch(): boolean {
    return this.businessCode === VaultErrorCode.HASH_MISMATCH
  }

  get isRetryable(): boolean {
    if (this.isQuota || this.isTooLarge || this.isConflict || this.isHashMismatch) return false
    if (this.businessCode === VaultErrorCode.PATH_INVALID) return false
    if (this.httpStatus === 401) return false
    return this.httpStatus === 0 || this.httpStatus === 429 || this.httpStatus >= 500
  }
}

export type NumericByteSize = number | string

/**
 * `normalizeIds` stringifies numbers above 2^53 (snowflake-safe IDs). Byte-size
 * fields must stay numeric for comparisons; coerce back so a future server that
 * returns a >2^53 limit cannot poison the guard into NaN (silent pass-through).
 */
export function toNumericBytes(value: NumericByteSize | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

interface Envelope<T> {
  code: number
  msg?: string
  data: T
}

function normalizeIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeIds)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (typeof item === 'number' && Number.isSafeInteger(item) === false) {
        out[key] = String(item)
      } else {
        out[key] = normalizeIds(item)
      }
    }
    return out
  }
  return value
}

export interface SyncApiConnection {
  server: string
  clientId: string
  token: string
}

export function createVaultSyncApi(
  config: () => SyncApiConnection,
  onUnauthorized: () => void,
  transport: typeof fetch = fetch,
) {
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const { server, clientId, token } = config()
    if (!token) {
      throw new VaultSyncApiError('未登录', 401, VaultErrorCode.AUTH_UNAUTHORIZED)
    }
    const headers: Record<string, string> = {
      'Content-Language': 'zh_CN',
      clientid: clientId,
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    }
    const response = await transport(`${server.replace(/\/+$/, '')}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    })
    const result = normalizeIds(await response.json()) as Envelope<T> & {
      data?: { code?: string } | null
    }
    if (response.status === 401 || result.code === 401) {
      onUnauthorized()
      throw new VaultSyncApiError(result.msg || '登录已过期', 401, VaultErrorCode.AUTH_UNAUTHORIZED)
    }
    if (!response.ok || result.code !== 200) {
      const nested = result.data && typeof result.data === 'object'
        ? (result.data as { code?: string }).code ?? null
        : null
      const business =
        nested
        || (result.code === 409 ? VaultErrorCode.CONFLICT_REV : null)
        || (result.code === 402 || result.code === 403 ? VaultErrorCode.QUOTA_EXCEEDED : null)
        || (result.code === 413 ? VaultErrorCode.FILE_TOO_LARGE : null)
      throw new VaultSyncApiError(
        result.msg || `请求失败（${response.status || result.code}）`,
        typeof result.code === 'number' ? result.code : response.status,
        business,
        result.data,
      )
    }
    return result.data as T
  }

  return {
    createVault: (name: string) =>
      call<VaultSpaceSummary>('/vault/v1/vaults', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    listVaults: () => call<VaultSpaceSummary[]>('/vault/v1/vaults'),
    bind: (vaultId: string, body: { replicaId: string; deviceId: string; clientInfo?: string }) =>
      call<VaultBindResult>(`/vault/v1/vaults/${encodeURIComponent(vaultId)}/bind`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    listReplicas: (vaultId: string) =>
      call<VaultReplicaInfo[]>(`/vault/v1/vaults/${encodeURIComponent(vaultId)}/replicas`),
    kickReplica: (vaultId: string, replicaId: string) =>
      call<null>(
        `/vault/v1/vaults/${encodeURIComponent(vaultId)}/replicas/${encodeURIComponent(replicaId)}`,
        { method: 'DELETE' },
      ),
    manifest: (vaultId: string, since?: string | null) => {
      const q = since ? `?since=${encodeURIComponent(since)}` : ''
      return call<VaultManifest>(`/vault/v1/vaults/${encodeURIComponent(vaultId)}/manifest${q}`)
    },
    putFile: (
      vaultId: string,
      body: {
        path: string
        fileId?: string | null
        baseRev?: number | null
        hash: string
        type?: string
        body?: string
        base64Body?: string
      },
    ) =>
      call<VaultFileMeta>(`/vault/v1/vaults/${encodeURIComponent(vaultId)}/files`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    /**
     * Sequential transactional batch (design §8.2): all items apply or none do.
     * Not yet wired into SyncEngine's per-file retry/conflict loop; bootstrap
     * upload may adopt it once item-level rollback semantics are proven safe.
     */
    putBatch: (
      vaultId: string,
      files: Array<{
        path: string
        fileId?: string | null
        baseRev?: number | null
        hash: string
        type?: string
        body?: string
        base64Body?: string
      }>,
    ) =>
      call<VaultFileMeta[]>(`/vault/v1/vaults/${encodeURIComponent(vaultId)}/files/batch`, {
        method: 'POST',
        body: JSON.stringify({ files }),
      }),
    getContent: (vaultId: string, path: string, rev?: number | null) => {
      const params = new URLSearchParams({ path })
      if (rev != null) params.set('rev', String(rev))
      return call<VaultFileContent>(
        `/vault/v1/vaults/${encodeURIComponent(vaultId)}/files/content?${params}`,
      )
    },
    listVersions: (vaultId: string, path: string) => {
      const params = new URLSearchParams({ path })
      return call<VaultFileVersion[]>(
        `/vault/v1/vaults/${encodeURIComponent(vaultId)}/files/versions?${params}`,
      )
    },
    deleteFile: (vaultId: string, body: { path: string; baseRev: number }) =>
      call<VaultFileMeta>(`/vault/v1/vaults/${encodeURIComponent(vaultId)}/files`, {
        method: 'DELETE',
        body: JSON.stringify(body),
      }),
    rename: (vaultId: string, body: { from: string; to: string; baseRev: number }) =>
      call<VaultFileMeta>(`/vault/v1/vaults/${encodeURIComponent(vaultId)}/renames`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    quota: () => call<VaultQuota>('/vault/v1/quota'),
  }
}

export type VaultSyncApi = ReturnType<typeof createVaultSyncApi>
