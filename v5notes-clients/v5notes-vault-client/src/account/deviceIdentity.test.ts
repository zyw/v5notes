// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { DEVICE_ID_KEY, deviceShort, getDeviceId, resetDeviceId } from './deviceIdentity'

beforeEach(() => {
  localStorage.clear()
})

describe('this machine\'s device id', () => {
  it('creates an id on first use and keeps it', () => {
    const first = getDeviceId()
    expect(first).toMatch(/^[0-9a-f-]{36}$/)
    expect(getDeviceId()).toBe(first)
    expect(localStorage.getItem(DEVICE_ID_KEY)).toBe(first)
  })

  it('survives reloads by reading what is already stored', () => {
    localStorage.setItem(DEVICE_ID_KEY, 'stored-device-id')
    expect(getDeviceId()).toBe('stored-device-id')
  })

  it('replaces a blank entry instead of sending an empty id', () => {
    localStorage.setItem(DEVICE_ID_KEY, '   ')
    expect(getDeviceId().trim()).not.toBe('')
  })

  it('mints a new id when app data is wiped', () => {
    const first = getDeviceId()
    resetDeviceId()
    expect(getDeviceId()).not.toBe(first)
  })
})

describe('short form used in labels', () => {
  it('takes the first six alphanumerics, lowercased', () => {
    expect(deviceShort('3FA2C1D4-0b7e-4a55')).toBe('3fa2c1')
  })

  it('falls back when there is nothing to shorten', () => {
    expect(deviceShort(null)).toBe('dev')
    expect(deviceShort('---')).toBe('dev')
  })
})
