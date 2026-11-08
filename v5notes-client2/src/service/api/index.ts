import { asId } from '../../utils/identity'
import { encryptLogin } from '../../utils/loginCrypto'
import { createRequest } from '../request'

const defaultLoginKey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu0QumTTAkPSiGQ75RZqpCvpJDWDspRoacrIHdWUbj5SGRcPfHh3QcGh7cQ1nm40sWwfb3jdO1g7yP/smEx4vXn4mjqpztrt5RbYoZlZ2AAAxI6Uxj522NUEWYVBpWqzqxnGw/w2wtfKTd/HSyZi/zXeRONF4G4aH4zCLxsFYKjeemz1y0eLKg8Cfx2dqUffU3yxNf4N7tilthgxw6XSKABjB488CpJMYelDWrtw6W+5c6HaBAYMQfJM2PJqjTnndGokJDS3mGp33Laba+lZeZtf8vt0bYW6rKuLtoqY0pQ0yLvmgty7JvhacInYUQzI7RleMXSGXhVKmK/MFA2dpvwIDAQAB'

export interface Connection {
  server: string
  clientId: string
  token: string
  refreshToken?: string
}

export interface Note {
  id: string
  dirId: string
  name: string
  content: string
  updateTime?: string
}

export interface TreeNode {
  id: string
  pid: string
  label: string
  type: number
  children?: TreeNode[]
}

export interface UserProfile {
  userId: string
  deptId?: string
  userType?: string
  userName: string
  nickName: string
  phonenumber?: string
  email?: string
  sex?: string
  remark?: string
  /** 头像地址（后端直接存 URL 字符串） */
  avatar?: string
}

export interface UserProfileUpdate extends Omit<UserProfile, 'avatar'> {
  avatar: string
}

export interface Page<T> {
  rows: T[]
  total: number
}

export interface LibraryImage {
  id: string
  name: string
  url: string
  type?: string
  size?: number
  createTime?: string
}

export function createApi(
  config: () => Connection,
  onUnauthorized: () => void,
  transport: typeof fetch = fetch,
  onTokensRefreshed?: (accessToken: string, refreshToken: string) => void,
) {
  // 不带刷新逻辑的底层调用，供刷新令牌接口使用，避免递归
  const rawCall = createRequest(config, onUnauthorized, transport)

  const performRefresh = async (): Promise<boolean> => {
    const refreshToken = config().refreshToken
    if (!refreshToken) return false
    try {
      const encrypted = encryptLogin(
        JSON.stringify({ refreshToken }),
        import.meta.env.VITE_API_PUBLIC_KEY || defaultLoginKey,
      )
      const pair = await rawCall<{ access_token: string; refresh_token?: string }>(
        '/auth/refresh',
        { method: 'POST', body: encrypted.body, headers: { 'encrypt-key': encrypted.key } },
        false,
      )
      if (!pair?.access_token || !pair.refresh_token) return false
      onTokensRefreshed?.(pair.access_token, pair.refresh_token)
      return true
    } catch {
      return false
    }
  }

  const call = createRequest(config, onUnauthorized, transport, performRefresh)

  return {
    ping: () => call<unknown>('/client/ping', {}, false),
    userInfo: async () => (await call<{ user: UserProfile }>('/system/user/getInfo')).user,
    updateUserProfile: (profile: UserProfileUpdate) =>
      call<void>('/system/user', { method: 'PUT', body: JSON.stringify(profile) }),
    login: (username: string, password: string) => {
      const encrypted = encryptLogin(JSON.stringify({
        tenantId: '000000', username, password, clientId: config().clientId,
        grantType: 'clientPassword', deviceType: 'pc_client',
      }), import.meta.env.VITE_API_PUBLIC_KEY || defaultLoginKey)
      return call<{ access_token: string; refresh_token?: string; expire_in?: number }>(
        '/auth/login', { method: 'POST', body: encrypted.body, headers: { 'encrypt-key': encrypted.key } }, false)
    },
    tree: () => call<TreeNode[]>('/client/notes/dir/tree'),
    list: (dirId: string, pageNum = 1) =>
      call<Page<Note>>(`/client/notes/list?${new URLSearchParams({ dirId, pageNum: String(pageNum), pageSize: '30' })}`),
    recent: () => call<Page<Note>>('/client/notes/new-notes?pageNum=1&pageSize=30'),
    search: (query: string) =>
      call<Note[]>(`/client/notes/search?${new URLSearchParams({ searchValue: query })}`),
    read: (id: string) => call<Note>(`/client/notes/${encodeURIComponent(id)}`),
    create: async (note: Pick<Note, 'name' | 'dirId' | 'content'>) =>
      asId(await call<unknown>('/client/notes', { method: 'POST', body: JSON.stringify(note) })),
    update: (note: Note) =>
      call<void>('/client/notes', { method: 'PUT', body: JSON.stringify(note) }),
    remove: (id: string) => call<void>(`/client/notes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    addDirectory: (name: string, pid: string) =>
      call<void>('/client/notes/dir', { method: 'POST', body: JSON.stringify({ name, pid }) }),
    renameDirectory: (id: string, name: string, pid: string) =>
      call<void>('/client/notes/dir', { method: 'PUT', body: JSON.stringify({ id, name, pid }) }),
    removeDirectory: (id: string) =>
      call<void>(`/client/notes/dir/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    upload: async (file: File) => {
      const body = new FormData()
      body.append('file', file)
      const data = await call<{ url: string }>('/basics/base/file', { method: 'POST', body })
      return data.url
    },
    listMyImages: async (pageNum = 1, name = '') => {
      const params = new URLSearchParams({ pageNum: String(pageNum), pageSize: '24' })
      const keyword = name.trim()
      if (keyword) params.set('name', keyword)
      const page = await call<Page<LibraryImage>>(`/basics/base/file/images?${params}`)
      return { rows: page?.rows ?? [], total: page?.total ?? 0 }
    },
    uploadProfileImage: async (file: File) => {
      const body = new FormData()
      body.append('file', file)
      return call<{ id: string; path: string; url: string }>('/basics/base/file', { method: 'POST', body })
    },
  }
}