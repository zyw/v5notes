import { describe, expect, it } from 'vitest'
import { FOREST_INK_CSS } from './forestInk'
import { WANQING_CSS } from './wanqing'
import { validateThemeCss } from '../cssValidate'

const SAMPLES = [
  { id: 'forest-ink', css: FOREST_INK_CSS, lightVault: '#3d6b54', darkVault: '#6fad8e' },
  { id: 'wanqing', css: WANQING_CSS, lightVault: '#4a5a86', darkVault: '#9aa9d4' },
] as const

describe.each(SAMPLES)('sample theme $id', ({ id, css, lightVault, darkVault }) => {
  it('scopes every rule to its own theme', () => {
    const selectors = [...css.matchAll(/([^{}]+)\{/g)]
      .map(m => m[1]!.trim())
      .filter(selector => !selector.startsWith('/*'))
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
