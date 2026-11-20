import { join } from '@tauri-apps/api/path'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import type { AppearancePrefs } from '../appearance/themes'
import { APPEARANCE_REL } from '../vault/skeleton'

/**
 * Per-vault appearance. The theme id and colour mode live with the vault, but
 * the theme packages themselves are installed app-wide (see extension/globalThemes).
 */
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
    JSON.stringify({ schemaVersion: 1, theme: prefs.theme, colorMode: prefs.colorMode }, null, 2) + '\n',
  )
}
