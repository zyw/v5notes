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
  contentHash?: string
}

export interface NoteRevision {
  id: string
  noteId: string
  contentHash: string
  excerpt: string
  size: number
  createTime?: string
  head?: boolean
}

export interface NoteRevisionDetail extends NoteRevision {
  content: string
}

export interface NoteRestoreResult {
  content: string
  contentHash: string
  updateTime?: string
}

export interface NoteTrashItem {
  id: string
  objectType: string
  objectId: string
  name: string
  originalPath: string
  noteCount: number
  dirCount: number
  deletedTime?: string
  expireTime?: string
  daysLeft: number
}

export interface NoteTrashRestoreResult {
  objectType: string
  objectId: string
  parentId: string
  relocated: boolean
}

export interface TreeNode {
  id: string
  pid: string
  label: string
  type: number
  updateTime?: string
  children?: TreeNode[]
}

export interface UserProfile {
  userId: string
  deptId?: string
  userType?: string
  userName: string
  nickName: string
  phoneNumber?: string
  email?: string
  gender?: string
  remark?: string
  /** 头像地址（后端直接存 URL 字符串） */
  avatar?: string
}

/** 与后端 SysUserProfileBo 对齐的可提交字段 */
export interface UserProfileUpdate {
  nickName: string
  phoneNumber?: string
  email?: string
  gender?: string
  avatar: string
}

/** 与后端 ClientQuotaVo 对齐；plan* 预留给后续付费套餐 */
export interface ClientQuota {
  limited: boolean
  expired: boolean
  usedBytes: number
  noteBytes?: number
  fileBytes?: number
  quotaBytes: number
  expireAt?: string | null
  planName?: string | null
  planExpireAt?: string | null
}

/** 与后端 SysSocialVo 对齐；id 保持字符串 */
export interface SocialBinding {
  id: string
  userId?: string
  authId?: string
  source: string
  userName?: string
  nickName?: string
  email?: string
  avatar?: string
  createTime?: string
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
    /** 个人中心详情（不脱敏），供资料弹窗编辑使用 */
    userProfile: async () => (await call<{ user: UserProfile }>('/system/user/profile')).user,
    updateUserProfile: (profile: UserProfileUpdate) =>
      call<void>('/system/user/profile', { method: 'PUT', body: JSON.stringify(profile) }),
    login: (username: string, password: string) => {
      const encrypted = encryptLogin(JSON.stringify({
        tenantId: '000000', username, password, clientId: config().clientId,
        grantType: 'clientPassword', deviceType: 'client',
      }), import.meta.env.VITE_API_PUBLIC_KEY || defaultLoginKey)
      return call<{ access_token: string; refresh_token?: string; expire_in?: number }>(
        '/auth/login', { method: 'POST', body: encrypted.body, headers: { 'encrypt-key': encrypted.key } }, false)
    },
    /** 获取第三方授权跳转 URL（JustAuth authorizeUrl）；app=client 使用客户端回调地址 */
    socialAuthUrl: (source: string, app: 'client' | 'admin' = 'client') =>
      call<string>(`/auth/binding/${encodeURIComponent(source)}?${new URLSearchParams({ app })}`, {}, false),
    /** 当前用户已绑定的第三方账号 */
    listSocial: () => call<SocialBinding[]>('/system/social/list'),
    /** 已登录用户绑定第三方（OAuth 回调后） */
    bindSocial: (body: { source: string; socialCode: string; socialState: string }) =>
      call<void>('/auth/social/callback', {
        method: 'POST',
        body: JSON.stringify({
          source: body.source,
          socialCode: body.socialCode,
          socialState: body.socialState,
          clientId: config().clientId,
          grantType: 'social',
        }),
      }),
    /** 解绑第三方；socialId 为绑定记录主键，保持字符串 */
    unbindSocial: (socialId: string) =>
      call<void>(`/auth/unlock/${encodeURIComponent(socialId)}`, { method: 'DELETE' }),
    /** 第三方登录 / 自动开户（grantType=social） */
    loginSocial: (body: { source: string; socialCode: string; socialState: string }) => {
      const encrypted = encryptLogin(JSON.stringify({
        tenantId: '000000',
        clientId: config().clientId,
        grantType: 'social',
        deviceType: 'client',
        source: body.source,
        socialCode: body.socialCode,
        socialState: body.socialState,
      }), import.meta.env.VITE_API_PUBLIC_KEY || defaultLoginKey)
      return call<{ access_token: string; refresh_token?: string; expire_in?: number }>(
        '/auth/login', { method: 'POST', body: encrypted.body, headers: { 'encrypt-key': encrypted.key } }, false)
    },
    registerEnabled: async () => Boolean(await call<boolean>('/auth/client/register-enabled', {}, false)),
    thirdPartyLoginEnabled: async () => Boolean(await call<boolean>('/auth/client/third-party-login-enabled', {}, false)),
    sendRegisterCode: (email: string) =>
      call<void>(`/resource/email/code?${new URLSearchParams({ email, scene: 'register' })}`, {}, false),
    register: (body: { password: string; email: string; emailCode: string }) => {
      const encrypted = encryptLogin(JSON.stringify(body), import.meta.env.VITE_API_PUBLIC_KEY || defaultLoginKey)
      return call<void>('/auth/client/register', {
        method: 'POST', body: encrypted.body, headers: { 'encrypt-key': encrypted.key },
      }, false)
    },
    quota: () => call<ClientQuota>('/client/account/quota'),
    tree: () => call<TreeNode[]>('/client/notes/dir/tree'),
    list: (dirId: string, pageNum = 1) =>
      call<Page<Note>>(`/client/notes/list?${new URLSearchParams({ dirId, pageNum: String(pageNum), pageSize: '30' })}`),
    recent: () => call<Page<Note>>('/client/notes/new-notes?pageNum=1&pageSize=30'),
    search: (query: string) =>
      call<Note[]>(`/client/notes/search?${new URLSearchParams({ searchValue: query })}`),
    read: (id: string) => call<Note>(`/client/notes/${encodeURIComponent(id)}`),
    create: async (note: Pick<Note, 'name' | 'dirId' | 'content'>) => {
      const data = await call<unknown>('/client/notes', { method: 'POST', body: JSON.stringify(note) })
      if (data !== null && typeof data === 'object' && 'id' in data) return asId(data.id)
      return asId(data)
    },
    update: (note: Note, force = false, skipHistory = false) =>
      call<{ contentHash: string }>('/client/notes', {
        method: 'PUT',
        body: JSON.stringify({
          id: note.id,
          dirId: note.dirId,
          name: note.name,
          content: note.content,
          baseHash: note.contentHash ?? '',
          force,
          skipHistory,
        }),
      }),
    revisions: (noteId: string, pageNum = 1) =>
      call<Page<NoteRevision>>(`/client/notes/${encodeURIComponent(noteId)}/revisions?${new URLSearchParams({ pageNum: String(pageNum), pageSize: '20' })}`),
    revision: (noteId: string, revisionId: string) =>
      call<NoteRevisionDetail>(`/client/notes/${encodeURIComponent(noteId)}/revisions/${encodeURIComponent(revisionId)}`),
    restoreRevision: (noteId: string, revisionId: string, baseHash: string, force = false) =>
      call<NoteRestoreResult>(`/client/notes/${encodeURIComponent(noteId)}/revisions/${encodeURIComponent(revisionId)}/restore`, {
        method: 'POST',
        body: JSON.stringify({ baseHash, force }),
      }),
    remove: (id: string) => call<void>(`/client/notes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    trash: (pageNum = 1) =>
      call<Page<NoteTrashItem>>(`/client/notes/trash?${new URLSearchParams({ pageNum: String(pageNum), pageSize: '20' })}`),
    restoreTrash: (id: string) =>
      call<NoteTrashRestoreResult>(`/client/notes/trash/${encodeURIComponent(id)}/restore`, { method: 'POST' }),
    purgeTrash: (id: string) =>
      call<void>(`/client/notes/trash/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    emptyTrash: () => call<{ failed: number }>('/client/notes/trash', { method: 'DELETE' }),
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