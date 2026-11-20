/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from 'vitest'
import { createThemeHost } from './ThemeHost'
import { saveAppearancePrefs, loadAppearancePrefs, defaultAppearance } from '../appearance/themes'

describe('ThemeHost', () => {
  afterEach(() => {
    saveAppearancePrefs(defaultAppearance())
    document.getElementById('v5-community-theme-style')?.remove()
    document.documentElement.removeAttribute('data-community-theme')
  })

  it('falls back when CSS is invalid', async () => {
    const host = createThemeHost({
      listInstalledThemes: async () => [
        {
          id: 'bad-theme',
          name: 'Bad',
          css: '@import "x.css"; :root { --bg: red; }',
        },
      ],
      isSafeMode: () => false,
    })
    await host.start()
    await host.setActive('bad-theme')
    expect(host.getActive()).toBe('default')
    expect(host.getLastError()).toMatch(/校验失败/)
    expect(document.getElementById('v5-community-theme-style')).toBeNull()
  })

  it('applies bundled forest-ink sample', async () => {
    const host = createThemeHost({ isSafeMode: () => false })
    await host.start()
    await host.setActive('forest-ink')
    expect(host.getActive()).toBe('forest-ink')
    expect(document.documentElement.dataset.communityTheme).toBe('forest-ink')
    expect(document.getElementById('v5-community-theme-style')?.textContent).toContain('--accent')
  })

  it('Safe Mode skips community themes', async () => {
    const host = createThemeHost({ isSafeMode: () => true })
    await host.start()
    await host.setActive('forest-ink')
    // Community CSS is withheld; the shell falls back to 默认.
    expect(document.documentElement.dataset.theme).toBe('default')
    expect(document.getElementById('v5-community-theme-style')).toBeNull()
  })

  it('applies every sample theme in both 明暗 modes', async () => {
    const host = createThemeHost({ isSafeMode: () => false })
    await host.start()
    for (const id of ['forest-ink', 'wanqing']) {
      await host.setActive(id)
      await host.setColorMode('light')
      expect(document.documentElement.dataset.colorMode).toBe('light')
      await host.setColorMode('dark')
      // The attribute the theme's dark rules key on must actually flip.
      expect(document.documentElement.dataset.colorMode).toBe('dark')
      expect(document.documentElement.dataset.communityTheme).toBe(id)
      expect(host.getPrefs().colorMode).toBe('dark')
      expect(host.getActive()).toBe(id)
    }
  })

  it('Safe Mode keeps the chosen builtin theme and colour mode', async () => {
    const host = createThemeHost({ isSafeMode: () => true })
    await host.start()
    await host.setActive('dusk')
    expect(host.getActive()).toBe('dusk')
    expect(document.documentElement.dataset.theme).toBe('dusk')
    await host.setColorMode('light')
    expect(host.getPrefs()).toEqual({ schemaVersion: 1, theme: 'dusk', colorMode: 'light' })
    expect(document.documentElement.dataset.colorMode).toBe('light')
  })

  it('Safe Mode leaves the stored theme intact so it comes back afterwards', async () => {
    saveAppearancePrefs({ schemaVersion: 1, theme: 'forest-ink', colorMode: 'dark' })
    let safe = true
    const host = createThemeHost({ isSafeMode: () => safe })
    await host.start()
    expect(document.getElementById('v5-community-theme-style')).toBeNull()
    expect(loadAppearancePrefs().theme).toBe('forest-ink')
    safe = false
    await host.start()
    expect(document.documentElement.dataset.communityTheme).toBe('forest-ink')
    expect(document.documentElement.dataset.colorMode).toBe('dark')
  })

  it('Safe Mode keeps the builtin theme while the stored value survives', async () => {
    saveAppearancePrefs({ schemaVersion: 1, theme: 'dusk', colorMode: 'dark' })
    const host = createThemeHost({ isSafeMode: () => true })
    await host.start()
    expect(document.documentElement.dataset.theme).toBe('dusk')
    expect(document.documentElement.dataset.colorMode).toBe('dark')
    // A theme toggle while safe must not overwrite what the user stored.
    await host.setColorMode('light')
    expect(loadAppearancePrefs()).toMatchObject({ theme: 'dusk', colorMode: 'dark' })
    expect(document.documentElement.dataset.colorMode).toBe('light')
  })
})
describe('ThemeHost keeps the rest of the vault appearance', () => {
  afterEach(() => saveAppearancePrefs(defaultAppearance()))

  it('writes theme changes as a patch, never replacing the vault colour', async () => {
    const patches: { theme?: string; colorMode?: string }[] = []
    const host = createThemeHost({
      isSafeMode: () => false,
      updateAppearanceFile: async (patch) => {
        patches.push(patch as { theme?: string; colorMode?: string })
      },
    })
    await host.start()
    await host.setActive('dusk')
    expect(patches.at(-1)).toEqual({ theme: 'dusk', colorMode: 'system' })
  })

  it('still applies a theme when the patch cannot be written', async () => {
    const host = createThemeHost({
      isSafeMode: () => false,
      updateAppearanceFile: async () => {
        throw new Error('disk full')
      },
    })
    await host.start()
    await host.setActive('dusk')
    expect(host.getActive()).toBe('dusk')
  })
})
