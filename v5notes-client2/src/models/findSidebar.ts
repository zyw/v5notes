import { t } from '../i18n'

export type SidebarView = 'outline' | 'find'
export type FindKind = 'find' | 'replace'

export interface FindSidebarState {
  visible: boolean
  view: SidebarView
  replaceExpanded: boolean
}

export interface FindStatus {
  hit: { index: number, total: number } | null
  error: string | null
}

export function openFindView(state: FindSidebarState, kind: FindKind): FindSidebarState {
  return {
    visible: true,
    view: 'find',
    replaceExpanded: kind === 'replace' || state.replaceExpanded,
  }
}

export function closeFindView(state: FindSidebarState): FindSidebarState {
  return { ...state, view: 'outline' }
}

export function canReplace(editing: boolean): boolean {
  return editing
}

export interface FindMatchPreview {
  from: number
  to: number
  index: number
  before: string
  match: string
  after: string
}

const PREVIEW_LIMIT = 18

export function matchPreview(doc: string, from: number, to: number, index: number): FindMatchPreview {
  const lineStart = doc.lastIndexOf('\n', Math.max(0, from - 1)) + 1
  const nextBreak = doc.indexOf('\n', to)
  const lineEnd = nextBreak < 0 ? doc.length : nextBreak
  return {
    from,
    to,
    index,
    before: trimEdge(doc.slice(lineStart, from), 'start'),
    match: doc.slice(from, to).replace(/\n/g, '↵') || t('find.emptyMatch'),
    after: trimEdge(doc.slice(to, lineEnd), 'end'),
  }
}

function trimEdge(text: string, edge: 'start' | 'end'): string {
  const flat = text.replace(/\s+/g, ' ')
  if (flat.length <= PREVIEW_LIMIT) return flat
  return edge === 'start' ? `…${flat.slice(-PREVIEW_LIMIT)}` : `${flat.slice(0, PREVIEW_LIMIT)}…`
}

export function findStatus(query: string, result: FindStatus): string {
  if (!query) return ''
  if (result.error) return result.error
  if (!result.hit) return t('find.noResults')
  return `${result.hit.index}/${result.hit.total}`
}
