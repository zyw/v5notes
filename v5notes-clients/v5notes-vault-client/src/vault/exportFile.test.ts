import { describe, expect, it } from 'vitest'
import {
  EXPORT_HTML_THEME,
  buildImagePdf,
  buildMarkdownDocument,
  buildRenderedDocument,
  exportFileName,
  resolveImageSource,
  rewriteImageSources,
  safeFileStem,
} from './exportFile'

describe('export helpers', () => {
  it('strips characters that break desktop file names', () => {
    expect(safeFileStem('春分/编辑器的呼吸感: v2')).toBe('春分-编辑器的呼吸感- v2')
    expect(safeFileStem('  前后空格  ')).toBe('前后空格')
    expect(safeFileStem('')).toBe('未命名笔记')
    expect(safeFileStem('...')).toBe('未命名笔记')
  })

  it('builds an export file name with the requested extension', () => {
    expect(exportFileName('春分 · 编辑器的呼吸感', 'md')).toBe('春分 · 编辑器的呼吸感.md')
  })

  it('keeps markdown verbatim and guarantees a trailing newline', () => {
    expect(buildMarkdownDocument({ name: 'a', markdown: '# 标题', html: '' })).toBe('# 标题\n')
    expect(buildMarkdownDocument({ name: 'a', markdown: '# 标题\n', html: '' })).toBe('# 标题\n')
  })

  it('resolves vault-relative image sources through the host resolver', () => {
    const resolve = (source: string) =>
      source.startsWith('attachments/') ? `asset://localhost/${source}` : source
    expect(resolveImageSource('attachments/a.png', resolve)).toBe('asset://localhost/attachments/a.png')
    expect(resolveImageSource('  attachments/a.png  ', resolve)).toBe('asset://localhost/attachments/a.png')
    expect(resolveImageSource('data:image/png;base64,AAA', resolve)).toBe('data:image/png;base64,AAA')
    expect(resolveImageSource('https://cdn.example.com/a.png', resolve)).toBe('https://cdn.example.com/a.png')
    expect(resolveImageSource('attachment.png')).toBe('attachment.png')
  })

  it('rewrites img sources inside the exported fragment', () => {
    const resolve = (source: string) => (source === 'attachments/a.png' ? 'https://asset/a.png' : source)
    expect(rewriteImageSources('<p><img src="attachments/a.png" alt="a"></p>', resolve))
      .toBe('<p><img src="https://asset/a.png" alt="a"></p>')
    const untouched = '<p><img src="attachments/a.png" alt="a"></p>'
    expect(rewriteImageSources(untouched)).toBe(untouched)
  })

  it('builds a valid image PDF with one page per slice', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    const blob = buildImagePdf([
      { jpeg, width: 100, height: 141 },
      { jpeg, width: 100, height: 141 },
    ])
    expect(blob.type).toBe('application/pdf')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const text = new TextDecoder('latin1').decode(bytes)
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text).toContain('/Count 2')
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
    // every xref offset must point at its own object header
    const xref = text.slice(text.indexOf('xref\n0 '))
    const entries = [...xref.matchAll(/^(\d{10}) 00000 n\r?$/gm)].map(match => Number(match[1]))
    expect(entries).toHaveLength(8)
    entries.forEach((offset, index) => {
      expect(text.slice(offset, offset + 8)).toContain(`${index + 1} 0 obj`)
    })
  })

  it('rejects an empty PDF instead of writing a broken file', () => {
    expect(() => buildImagePdf([])).toThrow('没有可导出的页面')
  })

  it('wraps the rendered body in a standalone document with inlined styles', () => {
    const html = buildRenderedDocument('春分 <草稿>', '<section>正文</section>')
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<title>春分 &lt;草稿&gt;</title>')
    expect(html).toContain('<section>正文</section>')
    expect(html).toContain('.v5md')
  })

  it('pins the export to the fixed Paper theme regardless of the editor theme', () => {
    // Editor themes are a reading preference; exports stay on one palette until
    // theme-aware export ships (EXPORT_HTML_THEME).
    expect(EXPORT_HTML_THEME).toBe('paper')
    expect(buildRenderedDocument('a', '<p>b</p>')).toContain('data-theme="paper"')
    expect(buildRenderedDocument('a', '<p>b</p>', 'one-dark')).toContain('data-theme="one-dark"')
  })
})
