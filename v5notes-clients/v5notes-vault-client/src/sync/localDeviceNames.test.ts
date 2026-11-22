// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { localDeviceNames, rememberLocalDeviceName } from './localDeviceNames'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)'
const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'

beforeEach(() => {
  localStorage.clear()
})

describe('remembering the labels this machine sent', () => {
  it('starts from the label a fresh build would send', () => {
    expect(localDeviceNames('http://localhost:8080', '9', UA)).toEqual(['V5Notes Vault · macOS'])
  })

  it('remembers a bind label so a new vault directory still claims its row', () => {
    rememberLocalDeviceName('http://localhost:8080', '9', '测试4 · macOS')
    const names = localDeviceNames('http://localhost:8080', '9', UA)
    expect(names).toContain('测试4 · macOS')
    expect(names).toContain('V5Notes Vault · macOS')
  })

  it('keeps servers and libraries apart', () => {
    rememberLocalDeviceName('http://localhost:8080', '9', '测试4 · macOS')
    expect(localDeviceNames('http://other:8080', '9', UA)).not.toContain('测试4 · macOS')
    expect(localDeviceNames('http://localhost:8080', '10', UA)).not.toContain('测试4 · macOS')
  })

  it('ignores a trailing slash and letter case in the server address', () => {
    rememberLocalDeviceName('http://LocalHost:8080/', '9', '测试4 · macOS')
    expect(localDeviceNames('http://localhost:8080', '9', UA)).toContain('测试4 · macOS')
  })

  it('dedupes repeated binds and keeps the newest label', () => {
    rememberLocalDeviceName('http://localhost:8080', '9', '旧名 · macOS')
    rememberLocalDeviceName('http://localhost:8080', '9', '新名 · macOS')
    rememberLocalDeviceName('http://localhost:8080', '9', '新名 · macOS')
    const names = localDeviceNames('http://localhost:8080', '9', WIN)
    expect(names.filter(n => n === '新名 · macOS')).toHaveLength(1)
    expect(names).toContain('旧名 · macOS')
  })

  it('survives corrupted storage', () => {
    localStorage.setItem('v5notes.vault.device-names.v1', '{not json')
    expect(localDeviceNames('http://localhost:8080', '9', UA)).toEqual(['V5Notes Vault · macOS'])
  })
})
