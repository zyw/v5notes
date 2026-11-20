import { describe, expect, it } from 'vitest'
import { decideRuntimeBoot } from './settingsRuntime'

describe('settings runtime boot', () => {
  it('starts the extension host even before a vault is open', () => {
    expect(decideRuntimeBoot({ hostPresent: false })).toBe('start')
    expect(decideRuntimeBoot({ hostPresent: false, rootPath: null })).toBe('start')
  })

  it('reuses a running host', () => {
    expect(decideRuntimeBoot({ hostPresent: true })).toBe('reuse')
  })

  it('reuses the host when switching vaults: extensions are app-level', () => {
    expect(decideRuntimeBoot({ hostPresent: true, hostRoot: '/vault-a', rootPath: '/vault-b' })).toBe(
      'reuse',
    )
  })
})
