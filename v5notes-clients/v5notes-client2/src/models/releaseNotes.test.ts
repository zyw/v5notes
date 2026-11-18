import { describe, expect, it } from 'vitest'
import { parseReleaseNotes } from './releaseNotes'

describe('parseReleaseNotes', () => {
  it('keeps headings, lists, inline code and http links', () => {
    const blocks = parseReleaseNotes([
      '# 0.2.0',
      '',
      '可以[检查更新](https://github.com/zyw/v5notes/releases)。',
      '',
      '- 修复 `保存` 失败',
      '- 下一行',
    ].join('\n'))
    expect(blocks.map(block => block.kind)).toEqual(['heading', 'paragraph', 'list'])
    expect(blocks[0]).toMatchObject({ level: 1 })
    expect(blocks[1]).toMatchObject({
      inlines: [
        { kind: 'text', text: '可以' },
        { kind: 'link', text: '检查更新', href: 'https://github.com/zyw/v5notes/releases' },
        { kind: 'text', text: '。' },
      ],
    })
    expect(blocks[2]).toMatchObject({
      items: [
        [{ kind: 'text', text: '修复 ' }, { kind: 'code', text: '保存' }, { kind: 'text', text: ' 失败' }],
        [{ kind: 'text', text: '下一行' }],
      ],
    })
  })

  it('leaves html and non-http links as text', () => {
    const blocks = parseReleaseNotes('<script>alert(1)</script> [点我](javascript:alert(1))')
    expect(blocks).toEqual([{
      kind: 'paragraph',
      inlines: [{ kind: 'text', text: '<script>alert(1)</script> [点我](javascript:alert(1))' }],
    }])
  })
})