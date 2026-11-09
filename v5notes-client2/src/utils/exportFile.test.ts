import { describe, expect, it } from 'vitest'
import { buildExportDocument, buildImagePdf, buildMarkdownDocument, exportFileName, resolveImageSource, rewriteImageSources, safeFileStem } from './exportFile'

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


  it('points relative and webview-local image URLs at the notes server', () => {
    const server = 'http://192.168.1.9:8080'
    expect(resolveImageSource('/basics/base/file/1/get/a.png', server, 'http://localhost:1420')).toBe('http://192.168.1.9:8080/basics/base/file/1/get/a.png')
    expect(resolveImageSource('http://localhost:1420/basics/base/file/1/get/a.png', server, 'http://localhost:1420')).toBe('http://192.168.1.9:8080/basics/base/file/1/get/a.png')
    expect(resolveImageSource('tauri://localhost/basics/base/file/1/get/a.png', server, 'tauri://localhost')).toBe('http://192.168.1.9:8080/basics/base/file/1/get/a.png')
  })

  it('leaves data URLs and third-party images alone', () => {
    const server = 'http://192.168.1.9:8080'
    expect(resolveImageSource('data:image/png;base64,AAA', server)).toBe('data:image/png;base64,AAA')
    expect(resolveImageSource('https://cdn.example.com/a.png', server, 'http://localhost:1420')).toBe('https://cdn.example.com/a.png')
  })

  it('resolves relative sources and rewrites webview-local sources for the export host', () => {
    const server = 'http://192.168.1.9:8080'
    expect(resolveImageSource('images/a.png', server)).toBe('http://192.168.1.9:8080/images/a.png')
    // v5md's baseUrl only handles relative paths, so tauri:// URLs must still be
    // rewritten by the client before images can be rasterised.
    expect(rewriteImageSources('<img src="tauri://localhost/images/a.png">', server))
      .toBe('<img src="http://192.168.1.9:8080/images/a.png">')
  })

  it('rewrites img sources inside the exported fragment', () => {
    const html = '<p><img src="/upload/a.png" alt="a"></p>'
    expect(rewriteImageSources(html, 'http://192.168.1.9:8080', 'http://localhost:1420')).toBe('<p><img src="http://192.168.1.9:8080/upload/a.png" alt="a"></p>')
    expect(rewriteImageSources(html, '')).toBe(html)
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

  it('wraps the rendered body in a standalone printable document', () => {
    const document = buildExportDocument({ name: '春分 <草稿>', markdown: '', html: '<section>正文</section>' })
    expect(document).toContain('<title>春分 &lt;草稿&gt;</title>')
    expect(document).toContain('<section>正文</section>')
    expect(document).toContain('@page')
    expect(document.startsWith('<!doctype html>')).toBe(true)
  })
})
