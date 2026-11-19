import { describe, expect, it } from 'vitest'
import { FOREST_INK_CSS } from './forestInk'

describe('Forest Ink sample theme', () => {
  it('scopes every rule to its own theme', () => {
    const selectors = [...FOREST_INK_CSS.matchAll(/([^{}]+)\{/g)].map(m => m[1].trim())
    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) {
      if (selector.startsWith('/*')) continue
      expect(selector).toContain("data-community-theme='forest-ink'")
    }
  })

  it('themes the vault identity colours as well as the shell tokens', () => {
    expect(FOREST_INK_CSS).toContain('--vault: #3d6b54')
    expect(FOREST_INK_CSS).toContain('--vault: #6fad8e')
  })
})
