import { describe, expect, it } from 'vitest'
import { describeFileHash, formatHashReport } from './diagnostics'
import type { VaultFs } from '../vault/vaultFs'

const ROOT = '/vault'

function fsWith(bytes: Uint8Array): VaultFs {
  return {
    async listTree() { return [] },
    async readText() { return new TextDecoder().decode(bytes) },
    async writeText() {},
    async readBytes() { return bytes },
    async writeBytes() {},
    async mkdir() {},
    async rename() {},
    async delete() {},
    async exists() { return true },
    async absolute() { return ROOT },
  }
}

describe('文件哈希诊断', () => {
  it('reports a clean UTF-8 note as round-tripping', async () => {
    const bytes = new TextEncoder().encode('# 标题\n正文\n')
    const report = await describeFileHash(ROOT, 'a.md', fsWith(bytes))
    expect(report.utf8Valid).toBe(true)
    expect(report.replacementChars).toBe(0)
    expect(report.textRoundTrips).toBe(true)
    expect(report.rawHash).toBe(report.textHash)
    expect(report.looksLikeFallback).toBe(false)
  })

  it('shows a note whose bytes are not valid UTF-8', async () => {
    // GBK-encoded 中文: invalid as UTF-8, so the text sent cannot match the bytes.
    const bytes = new Uint8Array([0xd6, 0xd0, 0xce, 0xc4])
    const report = await describeFileHash(ROOT, 'b.md', fsWith(bytes))
    expect(report.utf8Valid).toBe(false)
    expect(report.replacementChars).toBeGreaterThan(0)
    expect(report.textRoundTrips).toBe(false)
  })

  it('renders a copyable report', async () => {
    const report = await describeFileHash(ROOT, 'a.md', fsWith(new TextEncoder().encode('x')))
    const text = formatHashReport(report)
    expect(text).toContain('a.md')
    expect(text).toContain(report.rawHash)
    expect(text).toContain('WebCrypto')
  })
})
