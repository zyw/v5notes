import { VaultErrorCode } from '../models/errors'
import type {
  VaultBindResult,
  VaultFileContent,
  VaultFileMeta,
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
    return this.httpStatus === 409 || this.businessCode === VaultErrorCode.CONFLICT_REV
  }

  get isQuota(): boolean {
    return this.httpStatus === 402 || this.httpStatus === 403
      || this.businessCode === VaultErrorCode.QUOTA_EXCEEDED
  }
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
    bind: (vaultId: string, body: { deviceId: string; clientInfo?: string }) =>
      call<VaultBindResult>(`/vault/v1/vaults/${encodeURIComponent(vaultId)}/bind`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
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
        body: string
      },
    ) =>
      call<VaultFileMeta>(`/vault/v1/vaults/${encodeURIComponent(vaultId)}/files`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    getContent: (vaultId: string, path: string, rev?: number | null) => {
      const params = new URLSearchParams({ path })
      if (rev != null) params.set('rev', String(rev))
      return call<VaultFileContent>(
        `/vault/v1/vaults/${encodeURIComponent(vaultId)}/files/content?${params}`,
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
