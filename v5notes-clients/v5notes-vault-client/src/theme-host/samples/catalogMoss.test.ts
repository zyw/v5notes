import { describe, expect, it } from 'vitest'
import catalogMossManifest from './catalog-moss/manifest.json'
import catalogMossMeta from './catalog-moss/theme.json'
import { CATALOG_MOSS_CSS, CATALOG_MOSS_MANIFEST, CATALOG_MOSS_META } from './catalogMoss'

describe('Catalog Moss sample theme', () => {
  it('keeps the importable manifest and meta identical to the installable folder', () => {
    expect(JSON.parse(JSON.stringify(CATALOG_MOSS_MANIFEST))).toEqual(catalogMossManifest)
    expect(JSON.parse(JSON.stringify(CATALOG_MOSS_META))).toEqual(catalogMossMeta)
  })

  it('themes the vault identity colours as well as the shell tokens', () => {
    expect(CATALOG_MOSS_CSS).toContain('--vault: #3d6b4f !important')
    expect(CATALOG_MOSS_CSS).toContain('--vault: #7cb08c !important')
  })
})
