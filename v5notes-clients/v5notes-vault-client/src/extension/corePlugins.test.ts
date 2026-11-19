import { describe, expect, it } from 'vitest'
import { listCorePluginsWithoutVault } from './corePlugins'
import { CORE_REGISTRY, V5_EDITOR_ID } from '../plugin-host'

describe('core plugin list without a vault', () => {
  it('lists every core plugin, so settings is never empty before a vault opens', () => {
    const list = listCorePluginsWithoutVault()
    expect(list.map((p) => p.id)).toEqual(CORE_REGISTRY.map((c) => c.manifest.id))
    expect(list.every((p) => p.core)).toBe(true)
  })

  it('has names and permissions to render, not just ids', () => {
    for (const plugin of listCorePluginsWithoutVault()) {
      expect(plugin.name).not.toBe('')
      expect(Array.isArray(plugin.permissions)).toBe(true)
    }
  })

  it('only claims the default editor is loaded; the rest wait for a vault', () => {
    for (const plugin of listCorePluginsWithoutVault()) {
      expect(plugin.status).toBe(plugin.id === V5_EDITOR_ID ? 'loaded' : 'disabled')
    }
  })

  it('returns a fresh list so a caller cannot edit the registry', () => {
    const first = listCorePluginsWithoutVault()
    first[0].permissions.push('vault:write')
    expect(listCorePluginsWithoutVault()[0].permissions).not.toContain('vault:write')
  })
})
