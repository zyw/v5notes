import { t } from '../i18n'

/**
 * 服务器连接的配置。官方地址只以代码常量的形式存在，
 * 页面上只显示「官方服务器」，不渲染 URL 明文。
 */
export const OFFICIAL_SERVER = 'https://v5notes2.v5ai.xin'

export const SERVER_STORAGE_KEY = 'v5notes-server'
export const OFFICIAL_STORAGE_KEY = 'v5notes-server-official'

export interface ServerSettings {
  server: string
  official: boolean
}

/** 去掉首尾空白与末尾斜杠并校验协议；无效时抛出可直接展示给用户的错误。 */
export function normalizeServer(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) throw new Error(t('settings.serverRequired'))
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error(t('settings.serverExample'))
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(t('settings.serverProtocol'))
  }
  return trimmed
}

/**
 * 启动时该连哪台服务器：
 * - 存了官方标记就按标记走；
 * - 旧版本只存了地址、没有标记时，有地址视为自定义（正好是官方地址则算官方）；
 * - 什么都没存过默认用官方地址。
 */
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

export function readServerSettings(storage: Storage = localStorage): ServerSettings {
  return resolveServerSettings(storage.getItem(SERVER_STORAGE_KEY), storage.getItem(OFFICIAL_STORAGE_KEY))
}

export function writeServerSettings(settings: ServerSettings, storage: Storage = localStorage): void {
  storage.setItem(SERVER_STORAGE_KEY, settings.server)
  storage.setItem(OFFICIAL_STORAGE_KEY, String(settings.official))
}
