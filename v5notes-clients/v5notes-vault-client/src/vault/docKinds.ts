/** Document kinds (Markdown / plain text / plugin-declared). Pure, unit-tested. */

export interface DocKindSpec {
  /** Stable id shared with editor providers via `EditorProviderSpec.docKind`. */
  id: string
  /** Row label, e.g. `Markdown 笔记`. */
  label: string
  /** Create-action label, e.g. `新建 Markdown 笔记`. */
  newLabel: string
  /** Path suffix including the dot, lower-case. */
  extension: string
  /** Core provider that paints this kind when it is loaded. */
  builtinProviderId: string
  /** Initial body for a freshly created note. `{title}` is replaced with the note leaf. */
  initialContent: string
}

export const MARKDOWN_KIND = 'markdown'
export const TEXT_KIND = 'text'

export const DOC_KINDS: readonly DocKindSpec[] = [
  {
    id: MARKDOWN_KIND,
    label: 'Markdown 笔记',
    newLabel: '新建 Markdown 笔记',
    extension: '.md',
    builtinProviderId: 'v5-editor',
    initialContent: '# {title}\n\n',
  },
  {
    id: TEXT_KIND,
    label: '纯文本笔记',
    newLabel: '新建纯文本笔记',
    extension: '.txt',
    builtinProviderId: 'plain-text',
    initialContent: '',
  },
]

/** Suffixes every note may use; sync/trash/search share this list. */
export function noteSuffixes(): string[] {
  return DOC_KINDS.map(kind => kind.extension)
}

export function docKindById(id: string): DocKindSpec | null {
  return DOC_KINDS.find(kind => kind.id === id) ?? null
}

function leafOf(path: string): string {
  return path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path
}

/** The document kind a path belongs to, or null for assets. */
export function docKindOfPath(path: string | null | undefined): DocKindSpec | null {
  if (!path) return null
  const leaf = leafOf(path).toLowerCase()
  return DOC_KINDS.find(kind => leaf.endsWith(kind.extension)) ?? null
}

export function isNotePath(path: string | null | undefined): boolean {
  return docKindOfPath(path) !== null
}

/** Note name without its document suffix, for titles and rename inputs. */
export function displayNameOf(path: string): string {
  const leaf = leafOf(path)
  const kind = docKindOfPath(leaf)
  return kind ? leaf.slice(0, leaf.length - kind.extension.length) : leaf
}

/** `title` with `{title}` substituted, e.g. `# Untitled` for Markdown and '' for text. */
export function initialContentFor(kind: DocKindSpec, title: string): string {
  return kind.initialContent.split('{title}').join(title)
}

/** True when a provider-declared extension is a single safe suffix such as `.csv`. */
export function isSafeExtension(extension: string): boolean {
  return /^\.[a-z0-9]{1,16}$/.test(extension)
}
