import { describe, expect, it, vi } from 'vitest'
import { assertNoTokenLeak, createPluginApi } from './createPluginApi'
import type { PluginHostHooks } from './createPluginApi'

function hooks(overrides: Partial<PluginHostHooks> = {}): PluginHostHooks {
  return {
    vault: {
      list: vi.fn(async () => []),
      read: vi.fn(async () => 'ok'),
      write: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
      rename: vi.fn(async () => undefined),
      exists: vi.fn(async () => true),
    },
    workspace: {
      openNotice: vi.fn(),
      getActiveFile: () => null,
    },
    theme: {
      list: () => [],
      getActive: () => 'default',
      setActive: vi.fn(async () => undefined),
      getCssVariables: () => ({}),
    },
    getEnabledIds: () => [],
    isSafeMode: () => false,
    loadData: vi.fn(async () => null),
    saveData: vi.fn(async () => undefined),
    registerCommand: vi.fn(),
    ...overrides,
  }
}

describe('createPluginApi', () => {
  it('denies vault:write without permission', async () => {
    const app = createPluginApi(hooks(), {
      id: 'x',
      name: 'X',
      version: '1.0.0',
      permissions: ['vault:read'],
    })
    await expect(app.vault.write('a.md', 'x')).rejects.toThrow(/vault:write/)
    await expect(app.vault.read('a.md')).resolves.toBe('ok')
  })

  it('never exposes token-shaped fields', () => {
    const app = createPluginApi(hooks(), {
      id: 'x',
      name: 'X',
      version: '1.0.0',
      permissions: ['vault:read'],
    })
    expect(() => assertNoTokenLeak(app)).not.toThrow()
    expect(JSON.stringify(app)).not.toMatch(/token/i)
  })

  it('exposes network only with network:safe', () => {
    const without = createPluginApi(hooks(), {
      id: 'a',
      name: 'A',
      version: '1.0.0',
      permissions: ['ui:commands'],
    })
    expect(without.network).toBeUndefined()

    const withNet = createPluginApi(hooks(), {
      id: 'b',
      name: 'B',
      version: '1.0.0',
      permissions: ['network:safe'],
      networkAllowlist: ['api.example.com'],
    })
    expect(withNet.network).toBeDefined()
  })
})
