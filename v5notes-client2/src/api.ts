import { asId, normalizeIds } from './identity'
import { encryptLogin } from './loginCrypto'

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

export interface Page<T> {
  rows: T[]
  total: number
}

interface Envelope<T> { code: number; msg?: string; data: T }

export function createApi(config: () => Connection, onUnauthorized: () => void, transport: typeof fetch = fetch) {
  async function call<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
    const { server, clientId, token } = config()
    const headers: Record<string, string> = {
      'Content-Language': 'zh_CN',
      clientid: clientId,
      ...(authenticated && token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    }
    const response = await transport(`${server.replace(/\/+$/, '')}${path}`, {
      ...init, headers: { ...headers, ...init.headers },
    })
    const result = normalizeIds(await response.json()) as Envelope<T> & Partial<Page<T>>
    if (response.status === 401 || result.code === 401) {
      onUnauthorized()
      throw new Error(result.msg || '登录已过期，请重新登录')
    }
    if (!response.ok || result.code !== 200) throw new Error(result.msg || `请求失败 (${response.status})`)
    return ('rows' in result ? result : result.data) as T
  }

  return {
    ping: () => call<unknown>('/client/ping', {}, false),
    login: (username: string, password: string) => {
      const encrypted = encryptLogin(JSON.stringify({
        tenantId: '000000', username, password, clientId: config().clientId,
        grantType: 'clientPassword', deviceType: 'pc_client',
      }), import.meta.env.VITE_API_PUBLIC_KEY || defaultLoginKey)
      return call<{ access_token: string }>(
        '/auth/login', { method: 'POST', body: encrypted.body, headers: { 'encrypt-key': encrypted.key } }, false)
    },
    tree: () => call<TreeNode[]>('/client/notes/dir/tree-dir'),
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
  }
}
