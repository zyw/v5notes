import { describe, expect, it } from 'vitest'
import {
  OFFICIAL_SERVER,
  OFFICIAL_STORAGE_KEY,
  SERVER_STORAGE_KEY,
  normalizeServer,
  readServerSettings,
  resolveServerSettings,
  writeServerSettings,
} from './serverSettings'

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial))
  return {
    get length() { return data.size },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => { data.delete(key) },
    setItem: (key: string, value: string) => { data.set(key, value) },
  }
}

describe('normalizeServer', () => {
  it('trims whitespace and trailing slashes', () => {
    expect(normalizeServer('  https://notes.example.com///  ')).toBe('https://notes.example.com')
    expect(normalizeServer('http://192.168.1.9:8080/')).toBe('http://192.168.1.9:8080')
  })

  it('keeps a path when one is given', () => {
    expect(normalizeServer('https://example.com/notes/')).toBe('https://example.com/notes')
  })

  it('rejects empty, malformed and non-http addresses', () => {
    expect(() => normalizeServer('   ')).toThrow('请输入服务器地址')
    expect(() => normalizeServer('notes.example.com')).toThrow('请输入完整的服务器地址')
    expect(() => normalizeServer('ftp://notes.example.com')).toThrow('http:// 或 https://')
  })
})

describe('resolveServerSettings', () => {
  it('defaults to the official server when nothing was saved', () => {
    expect(resolveServerSettings(null, null)).toEqual({ server: OFFICIAL_SERVER, official: true })
    expect(resolveServerSettings('   ', null)).toEqual({ server: OFFICIAL_SERVER, official: true })
  })

  it('trusts the official flag', () => {
    expect(resolveServerSettings('https://notes.example.com', 'true')).toEqual({ server: OFFICIAL_SERVER, official: true })
    expect(resolveServerSettings('https://notes.example.com/', 'false')).toEqual({ server: 'https://notes.example.com', official: false })
  })

  it('falls back to the official server when the custom address is missing', () => {
    expect(resolveServerSettings(null, 'false')).toEqual({ server: OFFICIAL_SERVER, official: true })
  })

  it('treats a legacy saved address as custom, unless it is the official one', () => {
    expect(resolveServerSettings('http://192.168.1.9:8080/', null)).toEqual({ server: 'http://192.168.1.9:8080', official: false })
    expect(resolveServerSettings(OFFICIAL_SERVER + '/', null)).toEqual({ server: OFFICIAL_SERVER, official: true })
  })
})

describe('readServerSettings / writeServerSettings', () => {
  it('round-trips both settings keys', () => {
    const storage = memoryStorage()
    writeServerSettings({ server: 'http://192.168.1.9:8080', official: false }, storage)
    expect(storage.getItem(SERVER_STORAGE_KEY)).toBe('http://192.168.1.9:8080')
    expect(storage.getItem(OFFICIAL_STORAGE_KEY)).toBe('false')
    expect(readServerSettings(storage)).toEqual({ server: 'http://192.168.1.9:8080', official: false })
  })

  it('never renders the official URL on the page but still stores it', () => {
    const storage = memoryStorage()
    writeServerSettings({ server: OFFICIAL_SERVER, official: true }, storage)
    expect(readServerSettings(storage)).toEqual({ server: OFFICIAL_SERVER, official: true })
  })
})
