import type { CommunityPluginsFile } from '../plugin-host/communityPlugins'
import { parseCommunityPlugins } from '../plugin-host/communityPlugins'
import { parseManifestJson } from '../plugin-host/manifest'
import type { VaultPluginPackage } from '../plugin-host/PluginHost'
import { extensionPath, getAppStore } from './appStorage'

const PLUGINS_DIR = 'plugins'
const COMMUNITY_FILE = 'community-plugins.json'

/** Where plugin state lives now that it is one set for the whole app. */
export function communityPluginsPath(): Promise<string> {
  return extensionPath([COMMUNITY_FILE])
}

export async function readGlobalCommunityPlugins(): Promise<CommunityPluginsFile> {
  const raw = await getAppStore().readText(await communityPluginsPath())
  return parseCommunityPlugins(raw ?? {})
}

export async function writeGlobalCommunityPlugins(file: CommunityPluginsFile): Promise<void> {
  await getAppStore().writeText(await communityPluginsPath(), JSON.stringify(file, null, 2) + '\n')
}

/** Scan the installed plugin folders; broken packages are skipped, not fatal. */
export async function listGlobalPluginPackages(): Promise<VaultPluginPackage[]> {
  const store = getAppStore()
  const root = await extensionPath([PLUGINS_DIR])
  const entries = await store.readDir(root)
  const out: VaultPluginPackage[] = []
  for (const entry of entries) {
    if (!entry.isDirectory || entry.name.startsWith('.')) continue
    try {
      const dir = await extensionPath([PLUGINS_DIR, entry.name])
      const manifestRaw = await store.readText(dir + '/manifest.json')
      if (!manifestRaw) continue
      const manifest = parseManifestJson(manifestRaw)
      if (manifest.id !== entry.name) {
        throw new Error('目录名 ' + entry.name + ' 与 manifest.id ' + manifest.id + ' 不一致')
      }
      if (manifest.kind === 'theme') continue
      let mainSource: string | undefined
      if (manifest.main && manifest.main !== 'core') {
        mainSource = (await store.readText(dir + '/' + manifest.main)) ?? undefined
      }
      out.push({ id: manifest.id, manifest, mainSource })
    } catch {
      /* skip broken packages */
    }
  }
  return out
}

export async function writeGlobalPluginPackage(sample: {
  id: string
  manifestJson: string
  mainJs: string
}): Promise<void> {
  const store = getAppStore()
  const dir = await extensionPath([PLUGINS_DIR, sample.id])
  await store.mkdir(dir)
  const manifest = sample.manifestJson.endsWith('\n')
    ? sample.manifestJson
    : sample.manifestJson + '\n'
  const main = sample.mainJs.endsWith('\n') ? sample.mainJs : sample.mainJs + '\n'
  await store.writeText(dir + '/manifest.json', manifest)
  await store.writeText(dir + '/main.js', main)
}
