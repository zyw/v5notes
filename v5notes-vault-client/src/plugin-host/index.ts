export {
  createPluginHost,
  CORE_REGISTRY,
  parseCommunityPlugins,
  emptyCommunityPlugins,
  type PluginHost,
  type PluginHostDeps,
  type PluginRuntimeInfo,
  type HostCommand,
  type VaultPluginPackage,
} from './PluginHost'
export { createPluginApi, assertNoTokenLeak } from './createPluginApi'
export { parseManifestJson, assertThemePermissions } from './manifest'
export {
  FORBIDDEN_PERMISSIONS,
  PHASE6_GRANTABLE,
  validateRequestedPermissions,
  assertPermission,
} from './permissions'
export { loadSafeMode, saveSafeMode, SAFE_MODE_STORAGE_KEY } from './safeMode'
export {
  createVaultAdapter,
  createWorkspaceApi,
  readCommunityPluginsFile,
  writeCommunityPluginsFile,
  loadPluginDataFile,
  savePluginDataFile,
  listVaultPluginPackages,
  writeSamplePlugin,
} from './vaultBridge'
export { DAILY_NOTES_MANIFEST } from './core/dailyNotes'
export { TEMPLATES_MANIFEST } from './core/templates'
