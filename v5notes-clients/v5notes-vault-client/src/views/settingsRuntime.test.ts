import { describe, expect, it } from 'vitest'
import { decideRuntimeBoot } from './settingsRuntime'

describe('settings runtime boot', () => {
  it('starts the plugin host when none exists yet (welcome -> settings)', () => {
    expect(decideRuntimeBoot({ rootPath: '/vault', hostPresent: false })).toBe('start')
  })

  it('reuses a host the workspace already started', () => {
    expect(decideRuntimeBoot({ rootPath: '/vault', hostPresent: true })).toBe('reuse')
  })

  it('cannot start a host without an open vault', () => {
    expect(decideRuntimeBoot({ rootPath: null, hostPresent: false })).toBe('unavailable')
    expect(decideRuntimeBoot({ rootPath: '', hostPresent: true })).toBe('unavailable')
  })
})
