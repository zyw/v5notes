import { beforeEach, describe, expect, it, vi } from 'vitest'

// The scan only needs readDir/stat; stub the Tauri host with the temp vaults.
const mtimes: Record<string, number> = {
  '/tmp/v5vaulttest/v1/note.md': Date.parse('2026-01-01T00:00:00Z'),
  '/tmp/v5vaulttest/v2/note.md': Date.parse('2026-03-01T00:00:00Z'),
  '/tmp/v5vaulttest/v3/note.md': Date.parse('2026-02-01T00:00:00Z'),
  '/tmp/v5vaulttest/v4/draft.txt': Date.parse('2026-04-01T00:00:00Z'),
  '/tmp/v5vaulttest/v4/cover.png': Date.parse('2026-05-01T00:00:00Z'),
  '/tmp/v5vaulttest/v5/data.csv': Date.parse('2026-06-01T00:00:00Z'),
}

const vaultConfigs: Record<string, { schemaVersion: number; localVaultId: string; name: string; createdAt: string }> = {
  '/tmp/v5vaulttest/v1/.v5notes/vault.json': {
    schemaVersion: 1,
    localVaultId: 'vault-1',
    name: 'New测试2',
    createdAt: '2026-01-01T00:00:00Z',
  },
}

const invokeMock = vi.fn(async () => undefined)
const existsMock = vi.fn(
  async (path: string) =>
    Object.prototype.hasOwnProperty.call(mtimes, path) ||
    Object.prototype.hasOwnProperty.call(vaultConfigs, path) ||
    path.includes('/v'),
)
const readTextFileMock = vi.fn(async (path: string) => {
  const cfg = vaultConfigs[path]
  return cfg ? JSON.stringify(cfg) : ''
})

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: async () => '/tmp/v5vaulttest/appdata',
  join: async (...parts: string[]) => parts.join('/').replace(/\/+/g, '/'),
  basename: async (path: string) => path.split('/').filter(Boolean).pop() ?? '',
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: async (path: string) => {
    if (path.endsWith('/v1')) return [{ name: 'note.md', isFile: true, isDirectory: false, isSymlink: false }, { name: '.v5notes', isFile: false, isDirectory: true, isSymlink: false }]
    if (path.endsWith('/v2')) return [{ name: 'note.md', isFile: true, isDirectory: false, isSymlink: false }, { name: '.v5notes', isFile: false, isDirectory: true, isSymlink: false }]
    if (path.endsWith('/v3')) return [{ name: 'note.md', isFile: true, isDirectory: false, isSymlink: false }, { name: '.v5notes', isFile: false, isDirectory: true, isSymlink: false }]
    if (path.endsWith('/v4')) return [{ name: 'draft.txt', isFile: true, isDirectory: false, isSymlink: false }, { name: 'cover.png', isFile: true, isDirectory: false, isSymlink: false }]
    if (path.endsWith('/v5')) return [{ name: 'data.csv', isFile: true, isDirectory: false, isSymlink: false }]
    throw new Error('not a directory: ' + path)
  },
  stat: async (path: string) => {
    const mtime = mtimes[path]
    if (mtime === undefined) throw new Error('missing ' + path)
    return { size: 1, mtime: new Date(mtime), isFile: true, isDirectory: false }
  },
  readTextFile: readTextFileMock,
  writeTextFile: async () => undefined,
  mkdir: async () => undefined,
  exists: existsMock,
  remove: async () => undefined,
  rename: async () => undefined,
  writeFile: async () => undefined,
}))

beforeEach(() => {
  invokeMock.mockReset()
  invokeMock.mockResolvedValue(undefined)
  existsMock.mockClear()
  readTextFileMock.mockClear()
})

describe('vault last note change', () => {
  it('reports the newest note mtime and ignores .v5notes', async () => {
    const { vaultWorkspace } = await import('./workspace')
    const v1 = await vaultWorkspace.lastNoteChange('/tmp/v5vaulttest/v1')
    const v2 = await vaultWorkspace.lastNoteChange('/tmp/v5vaulttest/v2')
    const v3 = await vaultWorkspace.lastNoteChange('/tmp/v5vaulttest/v3')
    expect(v1).toBe(Date.parse('2026-01-01T00:00:00Z'))
    expect(v2).toBe(Date.parse('2026-03-01T00:00:00Z'))
    expect(v3).toBe(Date.parse('2026-02-01T00:00:00Z'))
    // newest first is exactly the intended settings order
    const order = [
      { name: 'v1', at: v1 },
      { name: 'v2', at: v2 },
      { name: 'v3', at: v3 },
    ].sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
    expect(order.map((o) => o.name)).toEqual(['v2', 'v3', 'v1'])
  })

  it('counts a plain-text note and ignores attachments', async () => {
    const { vaultWorkspace } = await import('./workspace')
    // draft.txt is newer than nothing else in v4; the later cover.png must not win.
    expect(await vaultWorkspace.lastNoteChange('/tmp/v5vaulttest/v4')).toBe(
      Date.parse('2026-04-01T00:00:00Z'),
    )
  })

  it('counts a plugin-declared kind when the table includes it', async () => {
    const { vaultWorkspace } = await import('./workspace')
    const { DOC_KINDS } = await import('./docKinds')
    const csv = { id: 'csv', label: 'CSV', newLabel: '新建 CSV', extension: '.csv', initialContent: '' }
    // A `.csv` is an asset by default and a note once the plugin declares it.
    expect(await vaultWorkspace.lastNoteChange('/tmp/v5vaulttest/v5')).toBeNull()
    expect(await vaultWorkspace.lastNoteChange('/tmp/v5vaulttest/v5', [...DOC_KINDS, csv])).toBe(
      Date.parse('2026-06-01T00:00:00Z'),
    )
  })

  it('scopes the vault directory before calling exists and tolerates soft scope failure', async () => {
    const { vaultWorkspace } = await import('./workspace')
    const rootPath = '/tmp/v5vaulttest/v1'
    expect(await vaultWorkspace.lastNoteChange(rootPath)).toBe(Date.parse('2026-01-01T00:00:00Z'))
    expect(invokeMock).toHaveBeenCalledWith('allow_vault_directory', { path: rootPath })
    expect(invokeMock.mock.invocationCallOrder[0]).toBeLessThan(existsMock.mock.invocationCallOrder[0])

    invokeMock.mockRejectedValueOnce(new Error('non-tauri preview'))
    expect(await vaultWorkspace.lastNoteChange(rootPath)).toBe(Date.parse('2026-01-01T00:00:00Z'))
  })
})

describe('vault openForSettings', () => {
  it('authorizes the vault directory before checking existence and reading config', async () => {
    const { vaultWorkspace } = await import('./workspace')
    const rootPath = '/tmp/v5vaulttest/v1'
    const opened = await vaultWorkspace.openForSettings(rootPath)

    expect(invokeMock).toHaveBeenCalledWith('allow_vault_directory', { path: rootPath })
    expect(invokeMock.mock.invocationCallOrder[0]).toBeLessThan(existsMock.mock.invocationCallOrder[0])
    expect(opened).toEqual({
      rootPath,
      name: 'New测试2',
      config: vaultConfigs['/tmp/v5vaulttest/v1/.v5notes/vault.json'],
    })
  })

  it('throws VaultPathError and skips exists when directory authorization fails', async () => {
    const { vaultWorkspace } = await import('./workspace')
    const { VaultPathError } = await import('../path/identity')
    invokeMock.mockRejectedValueOnce(new Error('permission denied'))

    await expect(vaultWorkspace.openForSettings('/tmp/v5vaulttest/v1')).rejects.toThrow(VaultPathError)
    invokeMock.mockRejectedValueOnce(new Error('permission denied'))
    await expect(vaultWorkspace.openForSettings('/tmp/v5vaulttest/v1')).rejects.toThrow('无法授权访问该目录')
    expect(existsMock).not.toHaveBeenCalled()
  })
})