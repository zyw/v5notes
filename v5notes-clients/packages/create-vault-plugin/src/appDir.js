import { homedir, platform } from 'node:os';
import { join } from 'node:path';

/**
 * Where the Vault Client keeps installed extensions.
 *
 * Mirrors Tauri's app_config_dir for identifier xin.v5ai.v5notes.vault
 * (src-tauri/tauri.conf.json). A shell env var wins, because a developer may
 * run the app under a different profile.
 *
 *   V5NOTES_APP_CONFIG_DIR=<dir>   override the whole app config dir
 *   --app-dir <dir>                same, passed to the installer
 */
const BUNDLE_ID = 'xin.v5ai.v5notes.vault';

export function appConfigDir(options = {}) {
  if (options.appDir) return options.appDir;
  if (process.env.V5NOTES_APP_CONFIG_DIR) return process.env.V5NOTES_APP_CONFIG_DIR;

  const home = homedir();
  switch (platform()) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', BUNDLE_ID);
    case 'win32':
      return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), BUNDLE_ID);
    default:
      return join(process.env.XDG_CONFIG_HOME || join(home, '.config'), BUNDLE_ID);
  }
}

export function extensionsDir(options = {}) {
  return join(appConfigDir(options), 'extensions');
}

/** Functional plugins live here; themes use <extensions>/themes. */
export function pluginDir(id, options = {}) {
  return join(extensionsDir(options), 'plugins', id);
}

export function communityPluginsFile(options = {}) {
  return join(extensionsDir(options), 'community-plugins.json');
}

/**
 * Root the Vault Client source is checked out at, used as the esbuild alias
 * for @v5notes/vault-plugin-api. Looked up by walking up from a starting dir.
 */
export async function findRepoRoot(start) {
  const { pathExists } = await import('./files.js');
  let dir = start;
  for (;;) {
    if (await pathExists(join(dir, 'packages', 'vault-plugin-api', 'src', 'index.ts'))) return dir;
    const parent = join(dir, '..');
    if (parent === dir) return null;
    dir = parent;
  }
}
