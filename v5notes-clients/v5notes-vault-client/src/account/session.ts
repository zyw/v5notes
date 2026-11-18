import { getSessionStore, type CredentialStore, type SessionSecrets } from './credentialStore'
import { STORAGE_KEYS } from './constants'

export interface AccountSession extends SessionSecrets {
  username: string
}

const EMPTY: AccountSession = { token: '', refreshToken: '', username: '' }

function storage(): Storage | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

/** Username is not a secret — it stays in localStorage for re-login convenience. */
function readUsername(): string {
  return storage()?.getItem(STORAGE_KEYS.username) || ''
}

/**
 * 读取已保存会话。tokens 来自系统钥匙串（Tauri）或 localStorage 回退（浏览器预览）。
 * 从不持久化密码。异步：钥匙串访问走 Rust IPC。
 */
export async function readSession(store: CredentialStore = getSessionStore()): Promise<AccountSession> {
  const secrets = await store.load()
  return { ...secrets, username: readUsername() }
}

export async function writeSession(
  session: { token: string; refreshToken?: string; username?: string },
  store: CredentialStore = getSessionStore(),
): Promise<void> {
  await store.save({ token: session.token, refreshToken: session.refreshToken || '' })
  if (session.username !== undefined) {
    const name = session.username.trim()
    const st = storage()
    if (st && name) st.setItem(STORAGE_KEYS.username, name)
  }
}

/** 登出或 401：只清 tokens，保留用户名便于再登录；密码从不写入存储。 */
export async function clearTokens(store: CredentialStore = getSessionStore()): Promise<void> {
  await store.clear()
}

export async function clearSession(store: CredentialStore = getSessionStore()): Promise<void> {
  await clearTokens(store)
  storage()?.removeItem(STORAGE_KEYS.username)
}
