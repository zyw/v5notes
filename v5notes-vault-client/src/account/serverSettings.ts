import { OFFICIAL_SERVER, STORAGE_KEYS } from './constants'

export interface ServerSettings {
  server: string
  official: boolean
}

export function normalizeServer(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) throw new Error('请填写服务器地址')
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('请输入合法地址，例如 https://example.com')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('服务器地址须以 http:// 或 https:// 开头')
  }
  return trimmed
}

export function resolveServerSettings(saved: string | null, officialFlag: string | null): ServerSettings {
  const address = (saved ?? '').trim().replace(/\/+$/, '')
  if (officialFlag === 'true') return { server: OFFICIAL_SERVER, official: true }
  if (officialFlag === 'false') {
    return address
      ? { server: address, official: false }
      : { server: OFFICIAL_SERVER, official: true }
  }
  if (!address) return { server: OFFICIAL_SERVER, official: true }
  return { server: address, official: address === OFFICIAL_SERVER }
}

export function readServerSettings(store: Storage = localStorage): ServerSettings {
  return resolveServerSettings(store.getItem(STORAGE_KEYS.server), store.getItem(STORAGE_KEYS.serverOfficial))
}

export function writeServerSettings(settings: ServerSettings, store: Storage = localStorage): void {
  store.setItem(STORAGE_KEYS.server, settings.server)
  store.setItem(STORAGE_KEYS.serverOfficial, String(settings.official))
}
