import { join } from '@tauri-apps/api/path'
import { mkdir, readDir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import type { AppearancePrefs } from '../appearance/themes'
import { APPEARANCE_REL, THEMES_DIR_REL } from '../vault/skeleton'
import { parseManifestJson } from '../plugin-host/manifest'
import type { VaultThemePackage } from './ThemeHost'
import { FOREST_INK_CSS, FOREST_INK_MANIFEST } from './samples/forestInk'

export async function readAppearanceFile(rootPath: string): Promise<Partial<AppearancePrefs> | null> {
  try {
    const abs = await join(rootPath, ...APPEARANCE_REL.split('/'))
    const raw = JSON.parse(await readTextFile(abs)) as Partial<AppearancePrefs>
    return raw
  } catch {
    return null
  }
}

export async function writeAppearanceFile(rootPath: string, prefs: AppearancePrefs): Promise<void> {
  const abs = await join(rootPath, ...APPEARANCE_REL.split('/'))
  await writeTextFile(
    abs,
    `${JSON.stringify({ schemaVersion: 1, theme: prefs.theme, colorMode: prefs.colorMode }, null, 2)}\n`,
  )
}

export async function listVaultThemes(rootPath: string): Promise<VaultThemePackage[]> {
  const themesRoot = await join(rootPath, THEMES_DIR_REL)
  let entries: Awaited<ReturnType<typeof readDir>>
  try {
    entries = await readDir(themesRoot)
  } catch {
    return []
  }
  const out: VaultThemePackage[] = []
  for (const entry of entries) {
    if (!entry.isDirectory || !entry.name || entry.name.startsWith('.')) continue
    try {
      const manifestRaw = await readTextFile(await join(themesRoot, entry.name, 'manifest.json'))
      const manifest = parseManifestJson(manifestRaw)
      if (manifest.kind !== 'theme') continue
      if (manifest.id !== entry.name) continue
      const cssName = manifest.theme || 'theme.css'
      const css = await readTextFile(await join(themesRoot, entry.name, cssName))
      out.push({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        css,
      })
    } catch {
      /* skip */
    }
  }
  return out
}

/** Copy bundled Forest Ink sample into the vault themes folder. */
export async function installForestInkSample(rootPath: string): Promise<void> {
  const dir = await join(rootPath, THEMES_DIR_REL, FOREST_INK_MANIFEST.id)
  await mkdir(dir, { recursive: true })
  await writeTextFile(
    await join(dir, 'manifest.json'),
    `${JSON.stringify(FOREST_INK_MANIFEST, null, 2)}\n`,
  )
  await writeTextFile(
    await join(dir, 'theme.css'),
    FOREST_INK_CSS.endsWith('\n') ? FOREST_INK_CSS : `${FOREST_INK_CSS}\n`,
  )
  await writeTextFile(
    await join(dir, 'theme.json'),
    `${JSON.stringify({ modes: ['light', 'dark'], accent: '#3d6b54' }, null, 2)}\n`,
  )
}
