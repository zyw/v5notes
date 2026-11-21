import { describe, expect, it } from 'vitest'
import { BUNDLED_THEMES } from './bundled'
import { validateThemeCss } from '../cssValidate'

const SAMPLES = [
  { id: 'catalog-moss', lightVault: '#3d6b4f', darkVault: '#7cb08c' },
  { id: 'forest-ink', lightVault: '#3d6b54', darkVault: '#6fad8e' },
  { id: 'wanqing', lightVault: '#4a5a86', darkVault: '#9aa9d4' },
] as const

describe('bundled themes', () => {
  it('ships exactly the preset themes, each once', () => {
    expect(BUNDLED_THEMES.map((theme) => theme.id)).toEqual(SAMPLES.map((s) => s.id))
  })

  it('gives every theme the same package shape as the catalog seeds', () => {
    for (const theme of BUNDLED_THEMES) {
      expect(theme.manifest.kind).toBe('theme')
      expect(theme.manifest.theme).toBe('theme.css')
      expect(theme.manifest.themeMeta).toBe('theme.json')
      expect(theme.meta.modes).toEqual(['light', 'dark'])
      expect(theme.manifest.id).toBe(theme.id)
      expect(theme.name).toBe(theme.manifest.name)
      expect(theme.version).toBe(theme.manifest.version)
    }
  })
})

describe.each(
  SAMPLES.map((sample) => ({
    ...sample,
    css: BUNDLED_THEMES.find((theme) => theme.id === sample.id)?.css ?? '',
  })),
)('bundled theme $id', ({ id, css, lightVault, darkVault }) => {
  it('scopes every rule to its own theme', () => {
    const selectors = [...css.matchAll(/([^{}]+)\{/g)]
      .map((m) => m[1]!.trim())
      .filter((selector) => !selector.startsWith('/*'))
    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) {
      expect(selector).toContain(`data-community-theme='${id}'`)
    }
  })

  it('passes CSS validation', () => {
    const result = validateThemeCss(css)
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('defines a dark palette so 深色 visibly changes', () => {
    expect(css).toContain(`[data-color-mode='dark']`)
    expect(css).toContain(`[data-color-preference='dark']`)
  })

  it('wins the vault colour over the inline --vault the shell writes', () => {
    // Inline styles on <html> beat stylesheets, so theme colours need !important.
    expect(css).toContain(`--vault: ${lightVault} !important`)
    expect(css).toContain(`--vault: ${darkVault} !important`)
  })
})
