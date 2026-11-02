import { asId } from '../../utils/identity'
import { encryptLogin } from '../../utils/loginCrypto'
import { createRequest } from '../request'

const defaultLoginKey = 'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKoR8mX0rGKLqzcWmOzbfj64K8ZIgOdHnzkXSOVOZbFu/TJhZ7rFAN+eaGkl3C4buccQd/EjEsj9ir7ijT7h96MCAwEAAQ=='

export interface Connection {
  server: string
  clientId: string
  token: string
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
  avatarId?: string
  avatarUrl?: string
}

export interface UserProfileUpdate extends Omit<UserProfile, 'avatarId' | 'avatarUrl'> {
  avatar: string
}

export interface Page<T> {
  rows: T[]
  total: number
}

export function createApi(config: () => Connection, onUnauthorized: () => void, transport: typeof fetch = fetch) {
  const call = createRequest(config, onUnauthorized, transport)

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
      return call<{ access_token: string }>(
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
    uploadProfileImage: async (file: File) => {
      const body = new FormData()
      body.append('file', file)
      return call<{ id: string; path: string; url: string }>('/basics/base/file', { method: 'POST', body })
    },
  }
}
