import { describe, expect, it, vi } from 'vitest'
import { writePluginData, readPluginData } from './pluginData'
import { createMemoryAppStore, setAppStore } from './appStorage'

vi.mock('@tauri-apps/api/path', () => ({
  join: async (...parts: string[]) => parts.join('/'),
}))

const written = new Map<string, string>()

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: async (path: string) => {
    const text = written.get(path)
    if (text === undefined) throw new Error('missing')
    return text
  },
  writeTextFile: async (path: string, data: string) => {
    written.set(path, data)
  },
  mkdir: async () => undefined,
}))

const ROOT = '/app/extensions'

describe('plugin settings tiers', () => {
  it('keeps global settings in the app, not in any vault', async () => {
    setAppStore(createMemoryAppStore(), ROOT)
    await writePluginData('global', '/vault-a', 'templates', { theme: 'compact' })
    expect(await readPluginData('global', '/vault-a', 'templates')).toEqual({ theme: 'compact' })
    // A different vault sees the same global settings.
    expect(await readPluginData('global', '/vault-b', 'templates')).toEqual({ theme: 'compact' })
  })

  it('keeps vault settings in the vault and separates them per vault', async () => {
    setAppStore(createMemoryAppStore(), ROOT)
    written.clear()
    await writePluginData('vault', '/vault-a', 'templates', { lastNote: 'a.md' })
    await writePluginData('vault', '/vault-b', 'templates', { lastNote: 'b.md' })
    expect(written.has('/vault-a/.v5notes/plugins/templates/data.json')).toBe(true)
    expect(written.has('/vault-b/.v5notes/plugins/templates/data.json')).toBe(true)
    expect(await readPluginData('vault', '/vault-a', 'templates')).toEqual({ lastNote: 'a.md' })
    expect(await readPluginData('vault', '/vault-b', 'templates')).toEqual({ lastNote: 'b.md' })
  })

  it('refuses to save vault settings with no vault open', async () => {
    setAppStore(createMemoryAppStore(), ROOT)
    await expect(writePluginData('vault', null, 'templates', {})).rejects.toThrow('打开库后可保存库内设置')
  })

  it('a scope never leaks into the other tier', async () => {
    setAppStore(createMemoryAppStore(), ROOT)
    written.clear()
    await writePluginData('global', '/vault-a', 'templates', { global: true })
    expect(await readPluginData('vault', '/vault-a', 'templates')).toBeNull()
  })

  it('reads back null when nothing was saved', async () => {
    setAppStore(createMemoryAppStore(), ROOT)
    expect(await readPluginData('global', '/vault-a', 'nobody')).toBeNull()
    expect(await readPluginData('vault', null, 'templates')).toBeNull()
  })
})
