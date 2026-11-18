import { describe, expect, it } from 'vitest'
import { planBootstrap } from './bootstrap'

describe('bootstrap authority §9.3', () => {
  it('uploads when cloud empty', () => {
    expect(planBootstrap({ cloudHasContent: false, localSyncableFileCount: 3 }).mode).toBe('upload-local')
  })

  it('pulls when local empty and cloud has content', () => {
    expect(planBootstrap({ cloudHasContent: true, localSyncableFileCount: 0 }).mode).toBe('pull-cloud')
  })

  it('merges with cloud baseline when both have files', () => {
    expect(planBootstrap({ cloudHasContent: true, localSyncableFileCount: 2 }).mode).toBe(
      'merge-cloud-baseline',
    )
  })
})
