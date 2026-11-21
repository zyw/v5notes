import { describe, expect, it } from 'vitest'
import { FOREST_INK_CSS, FOREST_INK_MANIFEST } from './forestInk'
import forestInkManifest from './forest-ink/manifest.json'

describe('Forest Ink sample theme', () => {
  it('keeps the importable manifest identical to the installable folder', () => {
    expect(FOREST_INK_MANIFEST).toEqual(forestInkManifest)
  })

  it('themes the vault identity colours as well as the shell tokens', () => {
    expect(FOREST_INK_CSS).toContain('--vault: #3d6b54 !important')
    expect(FOREST_INK_CSS).toContain('--vault: #6fad8e !important')
  })
})
