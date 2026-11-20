/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from 'vitest'
import { createThemeHost } from './ThemeHost'
import { saveAppearancePrefs, defaultAppearance } from '../appearance/themes'

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

  it('Safe Mode forces builtin default', async () => {
    const host = createThemeHost({ isSafeMode: () => true })
    await host.start()
    await host.setActive('forest-ink')
    expect(host.getActive()).toBe('default')
    expect(document.getElementById('v5-community-theme-style')).toBeNull()
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
