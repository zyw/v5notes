import { join } from '@tauri-apps/api/path'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import type { AppearancePrefs } from '../appearance/themes'
import { APPEARANCE_REL } from '../vault/skeleton'

/**
 * Per-vault appearance. The theme id, colour mode and vault colour live with the
 * vault (so another machine shows the same face); theme packages themselves are
 * installed app-wide (see extension/globalThemes).
 */
export interface VaultAppearance extends Partial<AppearancePrefs> {
  /** Palette swatch id (see appearance/vaultColors). */
  vaultColor?: string
}

/** Fields this file owns; an in-memory write merges into them. */
export type VaultAppearancePatch = Partial<AppearancePrefs> & { vaultColor?: string }

async function readRaw(rootPath: string): Promise<Record<string, unknown> | null> {
  try {
    const abs = await join(rootPath, ...APPEARANCE_REL.split('/'))
    const parsed = JSON.parse(await readTextFile(abs)) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

async function writeRaw(rootPath: string, value: Record<string, unknown>): Promise<void> {
  const abs = await join(rootPath, ...APPEARANCE_REL.split('/'))
  await writeTextFile(abs, JSON.stringify({ schemaVersion: 1, ...value }, null, 2) + '\n')
}

export async function readAppearanceFile(rootPath: string): Promise<VaultAppearance | null> {
  const raw = await readRaw(rootPath)
  if (!raw) return null
  return raw as VaultAppearance
}

/** Replace the whole record (theme + colour mode). */
export async function writeAppearanceFile(rootPath: string, prefs: AppearancePrefs): Promise<void> {
  const raw = (await readRaw(rootPath)) ?? {}
  await writeRaw(rootPath, {
    ...raw,
    schemaVersion: 1,
    theme: prefs.theme,
    colorMode: prefs.colorMode,
  })
}

/**
 * Change one field and keep the rest. The theme host writes the file too, so a
 * plain overwrite here would erase whichever side changed last.
 */
export async function updateAppearanceFile(
  rootPath: string,
  patch: VaultAppearancePatch,
): Promise<void> {
  const raw = (await readRaw(rootPath)) ?? {}
  const next: Record<string, unknown> = { ...raw, ...patch }
  delete next.schemaVersion
  await writeRaw(rootPath, next)
}
