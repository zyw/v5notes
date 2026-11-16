import { describe, expect, it } from 'vitest'
import { dragDistance, shouldStartNoteDrag } from './noteDrag'

describe('note drag helpers', () => {
  it('starts dragging after a small pointer movement while held', () => {
    expect(shouldStartNoteDrag(dragDistance(0, 0, 2, 2))).toBe(false)
    expect(shouldStartNoteDrag(dragDistance(0, 0, 4, 4))).toBe(true)
  })
})
