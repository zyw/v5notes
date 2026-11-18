import { describe, expect, it } from 'vitest'
import { isAppleHost, modKeyLabel, modShortcut } from './platform'

describe('platform shortcuts', () => {
  it('detects Apple hosts from platform or user agent', () => {
    expect(isAppleHost('Mozilla/5.0', 'MacIntel')).toBe(true)
    expect(isAppleHost('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'Win32')).toBe(true)
    expect(isAppleHost('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', '')).toBe(true)
    expect(isAppleHost('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32')).toBe(false)
    expect(isAppleHost('Mozilla/5.0 (X11; Linux x86_64)', 'Linux x86_64')).toBe(false)
  })

  it('formats the modifier chord for Apple and other hosts', () => {
    expect(modKeyLabel(true)).toBe('⌘')
    expect(modKeyLabel(false)).toBe('Ctrl')
    expect(modShortcut('K', true)).toBe('⌘K')
    expect(modShortcut('K', false)).toBe('Ctrl+K')
    expect(modShortcut('/', false)).toBe('Ctrl+/')
    expect(modShortcut('−', false)).toBe('Ctrl+−')
  })
})
