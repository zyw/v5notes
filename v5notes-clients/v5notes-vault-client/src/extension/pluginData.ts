/**
 * Plugin settings, in two tiers.
 *
 * - Global data   <app config>/extensions/plugins/<id>/data.json
 *   What the add-on itself is configured like: preferences, tokens, layout.
 *   One copy, shared by every vault.
 *
 * - Vault data    <vault>/.v5notes/plugins/<id>/data.json
 *   What is configured *for this vault's notes*: last opened note, per-vault
 *   templates, anything that names content which only exists here.
 *
 * Both are JSON documents. A plugin asks for either tier explicitly, so it can
 * never mistake one for the other.
 */

import { join } from '@tauri-apps/api/path'
import { readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs'
import { V5NOTES_DIR } from '../vault/skeleton'
import { extensionPath, getAppStore } from './appStorage'

import type { PluginDataScope } from '@v5notes/vault-plugin-api'

export type { PluginDataScope }

const DATA_FILE = 'data.json'

/** Vault tier path; null when no vault is open, so writes cannot land in a random folder. */
async function vaultDataPath(rootPath: string, pluginId: string): Promise<string> {
  return join(rootPath, V5NOTES_DIR, 'plugins', pluginId, DATA_FILE)
}

function parse(raw: string | null): unknown {
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function readPluginData(
  scope: PluginDataScope,
  vaultRoot: string | null,
  pluginId: string,
): Promise<unknown> {
  if (scope === 'global') {
    const dir = await extensionPath(['plugins', pluginId])
    return parse(await getAppStore().readText(dir + '/' + DATA_FILE))
  }
  if (!vaultRoot) return null
  try {
    return parse(await readTextFile(await vaultDataPath(vaultRoot, pluginId)))
  } catch {
    return null
  }
}

export async function writePluginData(
  scope: PluginDataScope,
  vaultRoot: string | null,
  pluginId: string,
  data: unknown,
): Promise<void> {
  const body = JSON.stringify(data, null, 2) + '\n'
  if (scope === 'global') {
    const dir = await extensionPath(['plugins', pluginId])
    await getAppStore().mkdir(dir)
    await getAppStore().writeText(dir + '/' + DATA_FILE, body)
    return
  }
  if (!vaultRoot) throw new Error('打开库后可保存库内设置')
  const dir = await join(vaultRoot, V5NOTES_DIR, 'plugins', pluginId)
  await mkdir(dir, { recursive: true })
  await writeTextFile(await join(dir, DATA_FILE), body)
}
