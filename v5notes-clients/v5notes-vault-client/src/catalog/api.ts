import { readServerSettings } from '../account/serverSettings'
import { bundledCatalogList, bundledCatalogPackage } from './bundled'
import { assertCatalogItemInstallable } from './rejectPublishing'
import type { CatalogItem, CatalogListResponse, CatalogPackage } from './types'
import {
  CATALOG_HEADER_KIND,
  CATALOG_HEADER_VERSION,
  CATALOG_PROTOCOL_VERSION,
  CATALOG_RESOURCE_KIND,
} from './types'

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

/**
 * Fetch catalog list. Prefer server `/vault/v1/catalog/...` (non-file-sync);
 * fall back to bundled seeds when unreachable.
 */
export async function fetchCatalogList(
  kind?: 'plugin' | 'theme',
  options?: { server?: string; transport?: typeof fetch; allowBundledFallback?: boolean },
): Promise<{ list: CatalogListResponse; source: 'server' | 'bundled' }> {
  const allowFallback = options?.allowBundledFallback !== false
  const server = (options?.server ?? readServerSettings().server).replace(/\/+$/, '')
  const transport = options?.transport ?? fetch
  const q = kind ? `?kind=${encodeURIComponent(kind)}` : ''
  try {
    const res = await transport(`${server}/vault/v1/catalog/plugins${q}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`catalog HTTP ${res.status}`)
    assertCatalogHeaders(res)
    const envelope = (await res.json()) as Envelope<CatalogListResponse>
    if (envelope.code !== 200 && envelope.code !== 0) {
      throw new Error(envelope.msg || `catalog code ${envelope.code}`)
    }
    const data = normalizeIds(envelope.data) as CatalogListResponse
    assertCatalogShape(data)
    data.items = data.items.filter((item) => {
      try {
        assertCatalogItemInstallable(item)
        return true
      } catch {
        return false
      }
    })
    return { list: data, source: 'server' }
  } catch (error) {
    if (!allowFallback) throw error
    return { list: bundledCatalogList(kind), source: 'bundled' }
  }
}

export async function fetchCatalogPackage(
  id: string,
  options?: { server?: string; transport?: typeof fetch; allowBundledFallback?: boolean },
): Promise<{ pkg: CatalogPackage; source: 'server' | 'bundled' }> {
  const allowFallback = options?.allowBundledFallback !== false
  const server = (options?.server ?? readServerSettings().server).replace(/\/+$/, '')
  const transport = options?.transport ?? fetch
  try {
    const res = await transport(`${server}/vault/v1/catalog/plugins/${encodeURIComponent(id)}/package`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`catalog package HTTP ${res.status}`)
    assertCatalogHeaders(res)
    const envelope = (await res.json()) as Envelope<CatalogPackage>
    if (envelope.code !== 200 && envelope.code !== 0) {
      throw new Error(envelope.msg || `catalog code ${envelope.code}`)
    }
    const data = normalizeIds(envelope.data) as CatalogPackage
    if (data.fileSyncResource) {
      throw new Error('非法 catalog 包：标记为 file-sync 资源')
    }
    return { pkg: data, source: 'server' }
  } catch (error) {
    if (!allowFallback) throw error
    return { pkg: bundledCatalogPackage(id), source: 'bundled' }
  }
}

function assertCatalogHeaders(res: Response): void {
  const kind = res.headers.get(CATALOG_HEADER_KIND)
  const ver = res.headers.get(CATALOG_HEADER_VERSION)
  // Soft check: some proxies strip custom headers; body fields remain authoritative.
  if (kind && kind !== CATALOG_RESOURCE_KIND) {
    throw new Error(`非 catalog 资源: ${kind}`)
  }
  if (ver && ver !== CATALOG_PROTOCOL_VERSION) {
    // Independent versioning: client may soft-accept newer later; Phase 7 only knows v1.
    if (Number(ver) < 1) throw new Error(`不支持的 catalog 协议版本: ${ver}`)
  }
}

function assertCatalogShape(data: CatalogListResponse): void {
  if (data.fileSyncResource) {
    throw new Error('非法 catalog 响应：标记为 file-sync 资源')
  }
  if (!data.catalogProtocolVersion) {
    throw new Error('catalog 响应缺少 catalogProtocolVersion')
  }
  if (!Array.isArray(data.items)) {
    throw new Error('catalog 响应缺少 items')
  }
}

export type { CatalogItem, CatalogListResponse, CatalogPackage }
