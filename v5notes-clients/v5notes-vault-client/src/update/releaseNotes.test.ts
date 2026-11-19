import { describe, expect, it } from 'vitest'
import { isHttpLink, parseReleaseNotes } from './releaseNotes'

const firstText = (source: string): string => {
  const blocks = parseReleaseNotes(source)
  const first = blocks[0]
  if (first?.kind === 'paragraph' && first.inlines[0]?.kind === 'text') return first.inlines[0].text
  return ''
}

describe('parseReleaseNotes', () => {
  it('keeps headings, paragraphs and lists', () => {
    const blocks = parseReleaseNotes('# 2.1.0\n\n新增附件预览。\n\n- 更快\n- 更稳')
    expect(blocks.map(b => b.kind)).toEqual(['heading', 'paragraph', 'list'])
    expect(blocks[2].kind).toBe('list')
    if (blocks[2].kind !== 'list') return
    expect(blocks[2].items).toEqual([[{ kind: 'text', text: '更快' }], [{ kind: 'text', text: '更稳' }]])
  })

  it('keeps the inline shape of a list item', () => {
    const blocks = parseReleaseNotes('- 先保存\n- 再安装')
    const list = blocks[0]
    expect(list.kind).toBe('list')
    if (list.kind !== 'list') return
    expect(list.items).toHaveLength(2)
    expect(list.items[1][0]).toEqual({ kind: 'text', text: '再安装' })
  })

  it('turns http(s) links into links', () => {
    const blocks = parseReleaseNotes('[说明](https://example.com/a)')
    expect(blocks[0]).toMatchObject({ kind: 'paragraph' })
    const paragraph = blocks[0]
    if (paragraph.kind !== 'paragraph') return
    expect(paragraph.inlines[0]).toEqual({ kind: 'link', text: '说明', href: 'https://example.com/a' })
  })

  it('leaves non-web links as plain text', () => {
    const blocks = parseReleaseNotes('[坏链](javascript:alert(1))')
    const paragraph = blocks[0]
    expect(paragraph.kind).toBe('paragraph')
    if (paragraph.kind !== 'paragraph') return
    expect(paragraph.inlines.some(inline => inline.kind === 'link')).toBe(false)
    expect(paragraph.inlines[0]).toEqual({ kind: 'text', text: '[坏链](javascript:alert(1))' })
  })

  it('renders inline code and never turns markup into structure', () => {
    const blocks = parseReleaseNotes('用 \`app_update_check\` 检查')
    const paragraph = blocks[0]
    expect(paragraph.kind).toBe('paragraph')
    if (paragraph.kind !== 'paragraph') return
    expect(paragraph.inlines[1]).toEqual({ kind: 'code', text: 'app_update_check' })

    const html = parseReleaseNotes('<script>alert(1)</script>')
    expect(html[0]).toEqual({ kind: 'paragraph', inlines: [{ kind: 'text', text: '<script>alert(1)</script>' }] })
  })

  it('merges adjacent text and trims blank lines', () => {
    expect(firstText('第一句 第二句')).toBe('第一句 第二句')
    expect(parseReleaseNotes(' ')).toEqual([])
  })

  it('only accepts web links', () => {
    expect(isHttpLink('https://a.b')).toBe(true)
    expect(isHttpLink('http://a.b')).toBe(true)
    expect(isHttpLink('app://a')).toBe(false)
  })
})
