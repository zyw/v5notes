import {
  CORE_REGISTRY,
  V5_EDITOR_ID,
  type PluginRuntimeInfo,
} from '../plugin-host'

/**
 * Core plugins the settings list shows before a vault is open.
 *
 * The list normally comes from a running host, and a host is bound to one vault.
 * Without a vault there is nothing to start one for — plugins are enabled per
 * vault through `.v5notes/plugins/community-plugins.json` — so the registry
 * itself is the honest answer: these extensions ship with the app, and their
 * state is decided once a vault is open.
 */
export function listCorePluginsWithoutVault(): PluginRuntimeInfo[] {
  return CORE_REGISTRY.map(({ manifest }) => ({
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    core: true,
    status: manifest.id === V5_EDITOR_ID ? 'loaded' : 'disabled',
    permissions: [...(manifest.permissions ?? [])],
  }))
}
