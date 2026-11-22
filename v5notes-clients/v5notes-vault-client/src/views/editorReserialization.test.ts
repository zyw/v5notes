// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isEditorReserialization } from './editorReserialization'

describe('editor re-serialisation vs a real edit', () => {
  it('treats line-ending and blank-line changes as the editor\'s own', () => {
    expect(isEditorReserialization('# A\r\nBody\r\n', '# A\nBody\n')).toBe(true)
    expect(isEditorReserialization('# A\nBody\n\n', '# A\nBody\n')).toBe(true)
    expect(isEditorReserialization('第一行\n第二行', '第一行   第二行')).toBe(true)
  })

  it('keeps a bare code fence without calling it an edit', () => {
    const disk = '# 5. Jpom\n\n```\ncode\n```\n'
    const refence = '# 5. Jpom\n\n```\n  code  \n```\n'
    expect(isEditorReserialization(refence, disk)).toBe(true)
  })

  it('follows a block-quoted copy without treating it as a rewrite', () => {
    // A quoted copy of a source that is already quoted (a callout around a quote).
    expect(isEditorReserialization('> > 第一行\n>\n> > 第二段', '> 第一行\n\n> 第二段')).toBe(true)
  })

  it('does not accept quote markers the source never had', () => {
    expect(isEditorReserialization('> 引用\n> 第二行', '引用\n第二行')).toBe(false)
  })

  it('treats any change in visible characters as an edit', () => {
    expect(isEditorReserialization('# A\nBody changed\n', '# A\nBody\n')).toBe(false)
    expect(isEditorReserialization('# A\n', '# A\nBody\n')).toBe(false)
    // A language tag on a fence is a wording change.
    expect(isEditorReserialization('```text\ncode\n```\n', '```\ncode\n```\n')).toBe(false)
    expect(isEditorReserialization('a _b_ c', 'a _b_ c')).toBe(false)
    expect(isEditorReserialization('', '# A\n')).toBe(false)
  })
})
