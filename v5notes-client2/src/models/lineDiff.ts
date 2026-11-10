import { t } from '../i18n'

export interface DiffLine {
  kind: 'same' | 'add' | 'remove'
  text: string
}

/** 行级差异。正文过长时不展开逐行结果。 */
export function diffLines(before: string, after: string): DiffLine[] {
  const older = before.split('\n')
  const newer = after.split('\n')
  if (older.length * newer.length > 250000) {
    return [{ kind: 'same', text: t('history.tooLong') }]
  }
  const width = newer.length + 1
  const score = new Uint32Array((older.length + 1) * width)
  const at = (row: number, column: number) => row * width + column
  for (let row = older.length - 1; row >= 0; row -= 1) {
    for (let column = newer.length - 1; column >= 0; column -= 1) {
      score[at(row, column)] = older[row] === newer[column]
        ? score[at(row + 1, column + 1)] + 1
        : Math.max(score[at(row + 1, column)], score[at(row, column + 1)])
    }
  }
  const lines: DiffLine[] = []
  let row = 0
  let column = 0
  while (row < older.length && column < newer.length) {
    if (older[row] === newer[column]) {
      lines.push({ kind: 'same', text: older[row] })
      row += 1
      column += 1
    } else if (score[at(row + 1, column)] >= score[at(row, column + 1)]) {
      lines.push({ kind: 'remove', text: older[row] })
      row += 1
    } else {
      lines.push({ kind: 'add', text: newer[column] })
      column += 1
    }
  }
  while (row < older.length) lines.push({ kind: 'remove', text: older[row++] })
  while (column < newer.length) lines.push({ kind: 'add', text: newer[column++] })
  return lines
}
