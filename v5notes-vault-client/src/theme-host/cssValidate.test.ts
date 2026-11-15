import { describe, expect, it } from 'vitest'
import { validateThemeCss } from './cssValidate'
import { FOREST_INK_CSS } from './samples/forestInk'

describe('validateThemeCss', () => {
  it('accepts Forest Ink sample', () => {
    const r = validateThemeCss(FOREST_INK_CSS)
    expect(r.ok).toBe(true)
    expect(r.definedVars).toContain('--bg')
    expect(r.definedVars).toContain('--accent')
  })

  it('rejects position:fixed and @import', () => {
    const r = validateThemeCss(`
      @import url("https://evil.example/x.css");
      :root { --bg: #fff; position: fixed; }
    `)
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => /@import/.test(e))).toBe(true)
    expect(r.errors.some((e) => /fixed/.test(e))).toBe(true)
  })

  it('rejects empty css', () => {
    expect(validateThemeCss('').ok).toBe(false)
  })

  it('rejects remote url()', () => {
    const r = validateThemeCss(`:root { --bg: #fff; background: url(https://x.test/a.png); }`)
    expect(r.ok).toBe(false)
  })
})
