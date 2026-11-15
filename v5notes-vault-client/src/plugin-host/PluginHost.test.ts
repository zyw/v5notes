import { describe, expect, it, vi } from 'vitest'
import { createPluginHost } from './PluginHost'
import type { CommunityPluginsFile } from './communityPlugins'
import { saveSafeMode } from './safeMode'
import type { VaultAdapter, WorkspaceApi, ThemeApi } from '@v5notes/vault-plugin-api'

const memory = new Map<string, string>()

function vault(): VaultAdapter {
  return {
    async list() {
      return []
    },
    async read(path) {
      return memory.get(path) || ''
    },
    async write(path, data) {
      memory.set(path, data)
    },
    async delete(path) {
      memory.delete(path)
    },
    async rename(from, to) {
      const v = memory.get(from)
      if (v != null) {
        memory.set(to, v)
        memory.delete(from)
      }
    },
    async exists(path) {
      return memory.has(path)
    },
  }
}

function workspace(): WorkspaceApi {
  return { openNotice: vi.fn(), getActiveFile: () => null }
}

function theme(): ThemeApi {
  return {
    list: () => [{ id: 'default', name: '默认', builtin: true, source: 'builtin' }],
    getActive: () => 'default',
    setActive: vi.fn(async () => undefined),
    getCssVariables: () => ({}),
  }
}

describe('PluginHost', () => {
  it('loads core plugins when enabled and skips community in Safe Mode', async () => {
    saveSafeMode(false)
    let community: CommunityPluginsFile = {
      schemaVersion: 1,
      enabled: ['daily-notes', 'templates', 'hello-world'],
      versions: {},
      userEnableSeen: {},
    }

    const host = createPluginHost({
      vault: vault(),
      workspace: workspace(),
      theme: theme(),
      readCommunityPlugins: async () => community,
      writeCommunityPlugins: async (file) => {
        community = file
      },
      loadPluginData: async () => null,
      savePluginData: async () => undefined,
      listVaultPlugins: async () => [
        {
          id: 'hello-world',
          manifest: {
            id: 'hello-world',
            name: 'Hello World',
            version: '1.0.0',
            permissions: ['ui:commands'],
            main: 'main.js',
          },
          mainSource: `
            module.exports = class extends Plugin {
              async onload() {
                this.addCommand({ id: 'say-hello', name: 'Say hello', callback: () => {} })
              }
            }
          `,
        },
      ],
    })

    await host.start()
    expect(host.list().find((p) => p.id === 'daily-notes')?.status).toBe('loaded')
    expect(host.list().find((p) => p.id === 'hello-world')?.status).toBe('loaded')
    expect(host.listCommands().some((c) => c.pluginId === 'hello-world')).toBe(true)

    await host.setSafeMode(true)
    expect(host.list().find((p) => p.id === 'hello-world')?.status).toBe('skipped-safe-mode')
    expect(host.list().find((p) => p.id === 'daily-notes')?.status).toBe('loaded')
    expect(host.listCommands().some((c) => c.pluginId === 'hello-world')).toBe(false)

    await host.setSafeMode(false)
    await host.stop()
  })

  it('refuses plugin that requests fs:arbitrary', async () => {
    saveSafeMode(false)
    const host = createPluginHost({
      vault: vault(),
      workspace: workspace(),
      theme: theme(),
      readCommunityPlugins: async () => ({
        schemaVersion: 1,
        enabled: ['evil'],
        versions: {},
        userEnableSeen: {},
      }),
      writeCommunityPlugins: async () => undefined,
      loadPluginData: async () => null,
      savePluginData: async () => undefined,
      listVaultPlugins: async () => [
        {
          id: 'evil',
          manifest: {
            id: 'evil',
            name: 'Evil',
            version: '1.0.0',
            permissions: ['fs:arbitrary' as never],
            main: 'main.js',
          },
          mainSource: `module.exports = class extends Plugin { async onload() {} }`,
        },
      ],
    })
    await host.start()
    const info = host.list().find((p) => p.id === 'evil')
    expect(info?.status).toBe('failed')
    expect(info?.error).toMatch(/fs:arbitrary|拒绝权限/)
    await host.stop()
  })
})
