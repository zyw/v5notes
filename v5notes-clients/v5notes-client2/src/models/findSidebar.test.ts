import { describe, expect, it } from 'vitest'
import { canReplace, closeFindView, findStatus, matchPreview, openFindView, type FindSidebarState } from './findSidebar'

const outline: FindSidebarState = { visible: false, view: 'outline', replaceExpanded: false }

describe('find sidebar', () => {
  it('opens the sidebar on the find view and can expand replace', () => {
    expect(openFindView(outline, 'find')).toEqual({ visible: true, view: 'find', replaceExpanded: false })
    const opened = openFindView(outline, 'replace')
    expect(opened).toEqual({ visible: true, view: 'find', replaceExpanded: true })
    expect(openFindView(opened, 'find').replaceExpanded).toBe(true)
  })

  it('returns to the outline and keeps the sidebar open', () => {
    const finding = openFindView(outline, 'find')
    expect(closeFindView(finding)).toEqual({ visible: true, view: 'outline', replaceExpanded: false })
  })

  it('shows the matching line and trims a long neighbor', () => {
    const doc = `${'甲'.repeat(30)}目标${'乙'.repeat(30)}`
    const from = doc.indexOf('目标')
    expect(matchPreview(doc, from, from + 2, 1)).toEqual({
      from,
      to: from + 2,
      index: 1,
      before: `…${'甲'.repeat(18)}`,
      match: '目标',
      after: `${'乙'.repeat(18)}…`,
    })
    expect(matchPreview('一行', 1, 1, 2).match).toBe('空匹配')
  })

  it('allows replace only while editing', () => {
    expect(canReplace(false)).toBe(false)
    expect(canReplace(true)).toBe(true)
    expect(findStatus('', { hit: null, error: null })).toBe('')
    expect(findStatus('a', { hit: null, error: '正则无效' })).toBe('正则无效')
    expect(findStatus('a', { hit: null, error: null })).toBe('无结果')
    expect(findStatus('a', { hit: { index: 2, total: 5 }, error: null })).toBe('2/5')
  })
})