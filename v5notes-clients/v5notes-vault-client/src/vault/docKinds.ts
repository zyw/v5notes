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
  /** Core provider that paints this kind when it is loaded; absent for plugin kinds. */
  builtinProviderId?: string
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
  return displayNameOfIn(DOC_KINDS, path)
}

/** `displayNameOf` against a caller-supplied kind table (core + plugin kinds). */
export function displayNameOfIn(paths: readonly DocKindSpec[], path: string): string {
  const leaf = leafOf(path)
  const kind = docKindOfPathIn(paths, leaf)
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

export interface DocKindDeclaration {
  id: string
  label: string
  newLabel: string
  extension: string
  initialContent?: string
}

/**
 * Turns a plugin declaration into a usable kind, or returns the reason it is
 * unusable. Core ids and suffixes stay reserved so plugin kinds can never take
 * over `.md`/`.txt` files.
 */
export function toCustomKind(
  declaration: DocKindDeclaration,
): { kind: DocKindSpec } | { error: string } {
  const id = declaration.id.trim()
  const extension = declaration.extension.trim().toLowerCase()
  if (!id) return { error: '文档类型 id 不能为空' }
  if (docKindById(id)) return { error: `文档类型 ${id} 与内置类型冲突` }
  if (!isSafeExtension(extension)) {
    return { error: `文档类型 ${id} 的后缀不合法：${declaration.extension}` }
  }
  if (DOC_KINDS.some((kind) => kind.extension === extension)) {
    return { error: `后缀 ${extension} 已被内置类型占用` }
  }
  const label = declaration.label.trim() || id
  return {
    kind: {
      id,
      label,
      newLabel: declaration.newLabel.trim() || `新建${label}`,
      extension,
      initialContent: declaration.initialContent ?? '',
    },
  }
}

/** Case-insensitive suffix lookup across core kinds plus plugin-declared kinds. */
export function docKindOfPathIn(
  paths: readonly DocKindSpec[],
  path: string | null | undefined,
): DocKindSpec | null {
  if (!path) return null
  const leaf = leafOf(path).toLowerCase()
  // Longest suffix wins, so a future `.tar.gz` never loses to a `.gz` kind.
  let match: DocKindSpec | null = null
  for (const kind of paths) {
    if (!leaf.endsWith(kind.extension)) continue
    if (!match || kind.extension.length > match.extension.length) match = kind
  }
  return match
}

/**
 * Menu/lookup order: core kinds in their declared order (Markdown first), then
 * plugin kinds by id. Suffix matching itself is done by `docKindOfPathIn`.
 */
export function sortKinds(kinds: readonly DocKindSpec[]): DocKindSpec[] {
  const coreIndex = (id: string) => DOC_KINDS.findIndex((kind) => kind.id === id)
  return [...kinds].sort((a, b) => {
    const ai = coreIndex(a.id)
    const bi = coreIndex(b.id)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.id.localeCompare(b.id)
  })
}
