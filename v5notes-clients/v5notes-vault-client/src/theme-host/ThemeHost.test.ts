/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from 'vitest'
import { createThemeHost } from './ThemeHost'
import { BUNDLED_THEMES } from './samples/bundled'
import { saveAppearancePrefs, loadAppearancePrefs, defaultAppearance, BUILTIN_THEMES } from '../appearance/themes'
import TOKENS_CSS from '../styles/tokens.css?raw'

/** Catalog Moss 的真实种子 CSS：校验需要完整的设计 token。 */
const MOSS_CSS = BUNDLED_THEMES.find((theme) => theme.id === 'catalog-moss')!.css

/**
 * Collect every tokens.css declaration block whose selector list mentions
 * `selector`, as a flat var map (later blocks win, like the cascade).
 */
function tokenBlock(selector: string): Record<string, string> {
  const css = TOKENS_CSS.replace(/\/\*[\s\S]*?\*\//g, '')
  const re = /([^{}]+)\{([^{}]*)\}/g
  const out: Record<string, string> = {}
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    if (!m[1].split(',').some((part) => part.trim() === selector)) continue
    for (const decl of m[2].split(';')) {
      const pair = decl.trim().match(/^(--[\w-]+)\s*:\s*(.+)$/)
      if (pair) out[pair[1]] = pair[2].trim()
    }
  }
  return out
}

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

  it('lists installed themes after the builtins', async () => {
    const host = createThemeHost({
      isSafeMode: () => false,
      listInstalledThemes: async () => [
        { id: 'catalog-moss', name: 'Catalog Moss', css: MOSS_CSS },
        { id: 'user-theme', name: 'User', css: ":root[data-community-theme='user-theme'] { --bg: #fff; }" },
      ],
    })
    await host.start()
    const list = host.list()
    expect(list.map((t) => t.id)).toEqual([
      'default',
      'dusk',
      'forest-ink',
      'wanqing',
      'catalog-moss',
      'user-theme',
    ])
    expect(list.filter((t) => t.source === 'builtin').map((t) => t.id)).toEqual([
      'default',
      'dusk',
      'forest-ink',
      'wanqing',
    ])
    // Catalog Moss 是普通的目录主题：装了才出现，出现即属用户安装。
    expect(list.find((t) => t.id === 'catalog-moss')?.source).toBe('vault')
    expect(list.find((t) => t.id === 'user-theme')?.source).toBe('vault')
  })

  it('applies the CSS of an installed theme package', async () => {
    const host = createThemeHost({
      isSafeMode: () => false,
      listInstalledThemes: async () => [
        {
          id: 'catalog-moss',
          name: 'Catalog Moss',
          css: MOSS_CSS,
        },
      ],
    })
    await host.start()
    await host.setActive('catalog-moss')
    expect(host.getActive()).toBe('catalog-moss')
    expect(host.getLastError()).toBeNull()
    expect(document.getElementById('v5-community-theme-style')?.textContent).toContain(
      "data-community-theme='catalog-moss'",
    )
  })

  it('applies the builtin forest-ink theme through the shell tokens', async () => {
    const host = createThemeHost({ isSafeMode: () => false })
    await host.start()
    await host.setActive('forest-ink')
    expect(host.getActive()).toBe('forest-ink')
    expect(document.documentElement.dataset.theme).toBe('forest-ink')
    // 内置主题不再注入社区 CSS 覆盖层。
    expect(document.getElementById('v5-community-theme-style')).toBeNull()
  })

  it('Safe Mode skips community themes', async () => {
    const host = createThemeHost({ isSafeMode: () => true })
    await host.start()
    await host.setActive('catalog-moss')
    // Community CSS is withheld; the shell falls back to 默认.
    expect(document.documentElement.dataset.theme).toBe('default')
    expect(document.getElementById('v5-community-theme-style')).toBeNull()
  })

  it('Safe Mode keeps the builtin forest-ink theme', async () => {
    const host = createThemeHost({ isSafeMode: () => true })
    await host.start()
    await host.setActive('forest-ink')
    expect(document.documentElement.dataset.theme).toBe('forest-ink')
    expect(document.getElementById('v5-community-theme-style')).toBeNull()
  })

  it('applies the catalog theme package in both 明暗 modes', async () => {
    const host = createThemeHost({
      isSafeMode: () => false,
      listInstalledThemes: async () =>
        BUNDLED_THEMES.map((t) => ({
          id: t.id,
          name: t.name,
          version: t.version,
          description: t.description,
          author: t.author,
          css: t.css,
        })),
    })
    await host.start()
    for (const id of ['catalog-moss']) {
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

  it('switches every builtin theme palette in both 明暗 modes', async () => {
    const host = createThemeHost({ isSafeMode: () => false })
    await host.start()
    for (const id of ['default', 'dusk', 'forest-ink', 'wanqing']) {
      await host.setActive(id)
      expect(document.documentElement.dataset.theme).toBe(id)
      await host.setColorMode('light')
      expect(document.documentElement.dataset.colorMode).toBe('light')
      // 内置主题靠 data-theme 选调色板，不需要社区 CSS 覆盖层。
      expect(document.getElementById('v5-community-theme-style')).toBeNull()
      await host.setColorMode('dark')
      expect(document.documentElement.dataset.colorMode).toBe('dark')
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
    saveAppearancePrefs({ schemaVersion: 1, theme: 'catalog-moss', colorMode: 'dark' })
    let safe = true
    const host = createThemeHost({
      isSafeMode: () => safe,
      listInstalledThemes: async () => [
        {
          id: 'catalog-moss',
          name: 'Catalog Moss',
          css: MOSS_CSS,
        },
      ],
    })
    await host.start()
    expect(document.getElementById('v5-community-theme-style')).toBeNull()
    expect(loadAppearancePrefs().theme).toBe('catalog-moss')
    safe = false
    await host.start()
    expect(document.documentElement.dataset.communityTheme).toBe('catalog-moss')
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

  // 林墨 / 晚晴 从主题包改成内置主题后，调色板必须一起搬进 tokens.css，
  // 否则点过去只是换个名字、颜色没变（明暗还要各自成块）。
  it('ships a distinct light and dark palette in tokens.css for every builtin theme', () => {
    for (const theme of BUILTIN_THEMES) {
      const light = tokenBlock(`:root[data-theme='${theme.id}'][data-color-mode='light']`)
      const dark = tokenBlock(`:root[data-theme='${theme.id}'][data-color-mode='dark']`)
      expect(Object.keys(light), theme.id + ' light').toContain('--bg')
      expect(Object.keys(dark), theme.id + ' dark').toContain('--bg')
      expect(light['--bg'], theme.id).not.toBe(dark['--bg'])
      expect(light['--accent'], theme.id).toBeTruthy()
    }
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
