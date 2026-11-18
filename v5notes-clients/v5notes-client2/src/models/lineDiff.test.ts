import { describe, expect, it } from 'vitest'
import { diffLines } from './lineDiff'

describe('line diff', () => {
  it('marks added and removed lines against the current text', () => {
    expect(diffLines('第一行\n旧行', '第一行\n新行')).toEqual([
      { kind: 'same', text: '第一行' },
      { kind: 'remove', text: '旧行' },
      { kind: 'add', text: '新行' },
    ])
  })
})