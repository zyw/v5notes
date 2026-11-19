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

  it('rejects a theme whose :root rules are not scoped to the theme id', () => {
    // An unscoped :root palette stays applied after switching away, so every
    // theme looks the same (the bug behind "点默认/Forest Ink 没变化").
    const r = validateThemeCss(":root,\n:root[data-community-theme='forest-ink'] { --bg: #fff; --panel: #fff; --ink: #000; --muted: #777; --line: #ddd; --accent: #3d6b54; --accent-hover: #2f5441; --surface: #eee; --danger: #a00; --danger-bg: #fee; }")
    expect(r.ok).toBe(false)
    expect(r.errors.some(e => e.includes(':root'))).toBe(true)
    expect(validateThemeCss(FOREST_INK_CSS).ok).toBe(true)
  })

  it('rejects empty css', () => {
    expect(validateThemeCss('').ok).toBe(false)
  })

  it('rejects remote url()', () => {
    const r = validateThemeCss(`:root { --bg: #fff; background: url(https://x.test/a.png); }`)
    expect(r.ok).toBe(false)
  })
})
