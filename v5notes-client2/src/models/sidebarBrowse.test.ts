import { describe, expect, it } from 'vitest'
import type { TreeNode } from '../service/api'
import { flattenNotes, readNoteGroup, readNoteSort, sortTree } from './sidebarBrowse'

function note(id: string, label: string, updateTime?: string): TreeNode {
  return { id, pid: '0', label, type: 2, updateTime }
}

function directory(id: string, label: string, children: TreeNode[], updateTime?: string): TreeNode {
  return { id, pid: '0', label, type: 1, updateTime, children }
}

const tree: TreeNode[] = [
  directory('dir-project', '项目', [
    note('note-10', '第10章', '2026-11-02 09:00:00'),
    note('note-2', '第2章', '2026-11-09 08:00:00'),
    directory('dir-archive', '资料', [
      note('note-old', '旧稿', '2026-10-02 08:00:00'),
    ], '2026-10-01 08:00:00'),
  ], '2026-11-01 08:00:00'),
  directory('dir-daily', '日报', [
    note('note-today', '今天', '2026-11-10 08:00:00'),
  ], '2026-11-08 08:00:00'),
  note('note-loose', '随手', '2026-11-03 08:00:00'),
]

describe('sidebar browse', () => {
  it('keeps directories before notes and sorts names with numeric order', () => {
    const sorted = sortTree(tree, 'name')
    expect(sorted.map(node => node.label)).toEqual(['日报', '项目', '随手'])
    const project = sorted[1]
    expect(project.children?.map(node => node.label)).toEqual(['资料', '第2章', '第10章'])
    expect(project.children?.[0].children?.map(node => node.label)).toEqual(['旧稿'])
  })

  it('sorts each level by the newest update in that subtree', () => {
    const sorted = sortTree(tree, 'updated')
    expect(sorted.map(node => node.id)).toEqual(['dir-daily', 'dir-project', 'note-loose'])
    const project = sorted[1]
    expect(project.children?.map(node => node.id)).toEqual(['note-2', 'note-10', 'dir-archive'])
  })

  it('does not mutate the source tree', () => {
    const snapshot = JSON.stringify(tree)
    sortTree(tree, 'updated')
    flattenNotes(tree, 'name')
    expect(JSON.stringify(tree)).toBe(snapshot)
  })

  it('flattens notes with their directory path', () => {
    expect(flattenNotes(tree, 'updated').map(item => [item.note.label, item.path])).toEqual([
      ['今天', '日报'],
      ['第2章', '项目'],
      ['随手', ''],
      ['第10章', '项目'],
      ['旧稿', '项目 / 资料'],
    ])
    expect(flattenNotes(tree, 'name').map(item => item.note.label)).toEqual(['第2章', '第10章', '今天', '旧稿', '随手'])
  })

  it('sends notes without an update time to the end', () => {
    const items = flattenNotes([note('undated', '没有时间'), note('dated', '有时间', '2026-01-01 00:00:00')], 'updated')
    expect(items.map(item => item.note.id)).toEqual(['dated', 'undated'])
  })

  it('falls back to the tree and name when stored preferences are unknown', () => {
    expect(readNoteGroup(null)).toBe('tree')
    expect(readNoteGroup('list')).toBe('list')
    expect(readNoteGroup('directory')).toBe('tree')
    expect(readNoteGroup('archive')).toBe('tree')
    expect(readNoteSort(null)).toBe('name')
    expect(readNoteSort('updated')).toBe('updated')
    expect(readNoteSort('manual')).toBe('name')
  })
})