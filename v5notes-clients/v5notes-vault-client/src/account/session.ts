import { STORAGE_KEYS } from './constants'

export interface AccountSession {
  token: string
  refreshToken: string
  username: string
}

function storage(): Storage | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

/** 读取已保存会话。从不持久化密码。 */
export function readSession(store: Storage | null = storage()): AccountSession {
  if (!store) return { token: '', refreshToken: '', username: '' }
  return {
    token: store.getItem(STORAGE_KEYS.token) || '',
    refreshToken: store.getItem(STORAGE_KEYS.refreshToken) || '',
    username: store.getItem(STORAGE_KEYS.username) || '',
  }
}

export function writeSession(
  session: { token: string; refreshToken?: string; username?: string },
  store: Storage | null = storage(),
): void {
  if (!store) return
  store.setItem(STORAGE_KEYS.token, session.token)
  if (session.refreshToken) store.setItem(STORAGE_KEYS.refreshToken, session.refreshToken)
  else store.removeItem(STORAGE_KEYS.refreshToken)
  if (session.username !== undefined) {
    const name = session.username.trim()
    if (name) store.setItem(STORAGE_KEYS.username, name)
  }
}

/** 登出或 401：只清 token，保留用户名便于再登录；密码从不写入存储。 */
export function clearTokens(store: Storage | null = storage()): void {
  if (!store) return
  store.removeItem(STORAGE_KEYS.token)
  store.removeItem(STORAGE_KEYS.refreshToken)
}

export function clearSession(store: Storage | null = storage()): void {
  clearTokens(store)
  if (!store) return
  store.removeItem(STORAGE_KEYS.username)
}
