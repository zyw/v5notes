import { currentLocale } from '../i18n'
import type { TreeNode } from '../service/api'

export type NoteGroupMode = 'tree' | 'list'
export type NoteSortMode = 'name' | 'updated'

export interface FlatNote {
  note: TreeNode
  path: string
}

function isDirectory(node: TreeNode): boolean {
  return node.type === 1
}

export function compareName(left: string, right: string): number {
  return left.localeCompare(right, currentLocale(), { numeric: true, sensitivity: 'base' })
}

function timestamp(value?: string): string {
  return value ?? ''
}

/** 目录的排序时间取其自身和全部后代里最新的一次更新。 */
export function latestTime(node: TreeNode): string {
  let best = timestamp(node.updateTime)
  for (const child of node.children ?? []) {
    const childTime = latestTime(child)
    if (childTime > best) best = childTime
  }
  return best
}

function compareNodes(left: TreeNode, right: TreeNode, sort: NoteSortMode): number {
  if (sort === 'name') {
    const typeDelta = Number(!isDirectory(left)) - Number(!isDirectory(right))
    if (typeDelta) return typeDelta
  } else {
    const timeDelta = latestTime(right).localeCompare(latestTime(left))
    if (timeDelta) return timeDelta
  }
  return compareName(left.label, right.label) || left.id.localeCompare(right.id)
}

export function sortTree(nodes: TreeNode[], sort: NoteSortMode): TreeNode[] {
  return [...nodes].sort((left, right) => compareNodes(left, right, sort)).map(node => (
    node.children ? { ...node, children: sortTree(node.children, sort) } : { ...node }
  ))
}

export function flattenNotes(nodes: TreeNode[], sort: NoteSortMode): FlatNote[] {
  const items: FlatNote[] = []
  function walk(list: TreeNode[], ancestors: string[]): void {
    for (const node of list) {
      if (isDirectory(node)) walk(node.children ?? [], [...ancestors, node.label])
      else items.push({ note: node, path: ancestors.join(' / ') })
    }
  }
  walk(nodes, [])
  return items.sort((left, right) => {
    if (sort === 'updated') {
      const timeDelta = timestamp(right.note.updateTime).localeCompare(timestamp(left.note.updateTime))
      if (timeDelta) return timeDelta
    }
    return compareName(left.note.label, right.note.label) || left.path.localeCompare(right.path, currentLocale()) || left.note.id.localeCompare(right.note.id)
  })
}

export function readNoteGroup(value: string | null): NoteGroupMode {
  return value === 'list' ? value : 'tree'
}

export function readNoteSort(value: string | null): NoteSortMode {
  return value === 'updated' ? value : 'name'
}
