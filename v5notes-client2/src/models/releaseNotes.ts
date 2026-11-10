/** 更新说明只保留标题、段落、列表、行内代码和 http(s) 链接。其余内容按文本显示。 */

export type NoteInline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string }

export type NoteBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; inlines: NoteInline[] }
  | { kind: 'paragraph'; inlines: NoteInline[] }
  | { kind: 'list'; items: NoteInline[][] }

const INLINE_PATTERN = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g

export function parseReleaseNotes(source: string): NoteBlock[] {
  const blocks: NoteBlock[] = []
  let paragraph: string[] = []
  let list: string[] | null = null

  const flushParagraph = () => {
    const text = paragraph.join(' ').trim()
    paragraph = []
    if (text) blocks.push({ kind: 'paragraph', inlines: parseInlines(text) })
  }
  const flushList = () => {
    if (!list?.length) {
      list = null
      return
    }
    blocks.push({ kind: 'list', items: list.map(item => parseInlines(item)) })
    list = null
  }

  for (const line of source.replace(/\r\n/g, '\n').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushParagraph()
      flushList()
      continue
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed)
    if (heading) {
      flushParagraph()
      flushList()
      const level = heading[1].length as 1 | 2 | 3
      blocks.push({ kind: 'heading', level, inlines: parseInlines(heading[2]) })
      continue
    }
    const item = /^[-*]\s+(.+)$/.exec(trimmed)
    if (item) {
      flushParagraph()
      list ??= []
      list.push(item[1])
      continue
    }
    flushList()
    paragraph.push(trimmed)
  }
  flushParagraph()
  flushList()
  return blocks
}

export function isHttpLink(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

function parseInlines(input: string): NoteInline[] {
  const inlines: NoteInline[] = []
  let cursor = 0
  for (const match of input.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0
    if (index > cursor) pushText(inlines, input.slice(cursor, index))
    if (match[1] !== undefined) {
      inlines.push({ kind: 'code', text: match[1] })
    } else if (match[2] !== undefined && match[3] !== undefined && isHttpLink(match[3])) {
      inlines.push({ kind: 'link', text: match[2], href: match[3] })
    } else {
      pushText(inlines, match[0])
    }
    cursor = index + match[0].length
  }
  if (cursor < input.length) pushText(inlines, input.slice(cursor))
  return inlines
}

function pushText(inlines: NoteInline[], text: string): void {
  if (!text) return
  const last = inlines.at(-1)
  if (last?.kind === 'text') last.text += text
  else inlines.push({ kind: 'text', text })
}
