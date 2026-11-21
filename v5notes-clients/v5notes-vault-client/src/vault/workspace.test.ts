import { describe, expect, it, vi } from 'vitest'

// The scan only needs readDir/stat; stub the Tauri host with the temp vaults.
const mtimes: Record<string, number> = {
  '/tmp/v5vaulttest/v1/note.md': Date.parse('2026-01-01T00:00:00Z'),
  '/tmp/v5vaulttest/v2/note.md': Date.parse('2026-03-01T00:00:00Z'),
  '/tmp/v5vaulttest/v3/note.md': Date.parse('2026-02-01T00:00:00Z'),
  '/tmp/v5vaulttest/v4/draft.txt': Date.parse('2026-04-01T00:00:00Z'),
  '/tmp/v5vaulttest/v4/cover.png': Date.parse('2026-05-01T00:00:00Z'),
}

vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: async (path: string) => {
    if (path.endsWith('/v1')) return [{ name: 'note.md', isFile: true, isDirectory: false, isSymlink: false }, { name: '.v5notes', isFile: false, isDirectory: true, isSymlink: false }]
    if (path.endsWith('/v2')) return [{ name: 'note.md', isFile: true, isDirectory: false, isSymlink: false }, { name: '.v5notes', isFile: false, isDirectory: true, isSymlink: false }]
    if (path.endsWith('/v3')) return [{ name: 'note.md', isFile: true, isDirectory: false, isSymlink: false }, { name: '.v5notes', isFile: false, isDirectory: true, isSymlink: false }]
    if (path.endsWith('/v4')) return [{ name: 'draft.txt', isFile: true, isDirectory: false, isSymlink: false }, { name: 'cover.png', isFile: true, isDirectory: false, isSymlink: false }]
    throw new Error('not a directory: ' + path)
  },
  stat: async (path: string) => {
    const mtime = mtimes[path]
    if (mtime === undefined) throw new Error('missing ' + path)
    return { size: 1, mtime: new Date(mtime), isFile: true, isDirectory: false }
  },
  readTextFile: async () => '',
  writeTextFile: async () => undefined,
  mkdir: async () => undefined,
  exists: async (path: string) => Object.prototype.hasOwnProperty.call(mtimes, path) || path.includes('/v'),
  remove: async () => undefined,
  rename: async () => undefined,
  writeFile: async () => undefined,
}))

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
})