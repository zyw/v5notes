import { describe, expect, it } from 'vitest'
import {
  applySyncIgnore,
  classifySyncPath,
  matchSyncIgnore,
  parseSyncIgnore,
  shouldSyncPath,
} from './exclude'

describe('§6.4 hard exclude table', () => {
  it('never syncs sync-state / trash / index / vault.json', () => {
    expect(classifySyncPath('.v5notes/sync-state.json')).toEqual({ sync: false, reason: 'never' })
    expect(classifySyncPath('.v5notes/trash/a.md')).toEqual({ sync: false, reason: 'never' })
    expect(classifySyncPath('.v5notes/index.sqlite')).toEqual({ sync: false, reason: 'never' })
    expect(classifySyncPath('.v5notes/vault.json')).toEqual({ sync: false, reason: 'never' })
  })

  it('syncs intent configs and user markdown', () => {
    expect(shouldSyncPath('.v5notes/appearance.json')).toBe(true)
    expect(shouldSyncPath('.v5notes/plugins/community-plugins.json')).toBe(true)
    expect(shouldSyncPath('.v5notes/plugins/diary/data.json')).toBe(true)
    expect(shouldSyncPath('工作/周报.md')).toBe(true)
  })

  it('defaults plugin binaries off and unlisted .v5notes off', () => {
    expect(classifySyncPath('.v5notes/plugins/diary/main.js').reason).toBe('code-binary-default-off')
    expect(classifySyncPath('.v5notes/cache/x').reason).toBe('unlisted-v5notes')
  })

  it('applies syncignore after hard table', () => {
    const patterns = parseSyncIgnore('.git/\n.DS_Store\n*.tmp\n')
    expect(matchSyncIgnore('.DS_Store', patterns)).toBe(true)
    expect(applySyncIgnore('导出/a.tmp', patterns).reason).toBe('syncignore')
    // hard never still wins
    expect(applySyncIgnore('.v5notes/sync-state.json', patterns).reason).toBe('never')
  })
})
