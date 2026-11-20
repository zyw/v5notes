import { describe, expect, it } from 'vitest'
import {
  applySyncIgnore,
  classifySyncPath,
  matchSyncIgnore,
  parseSyncIgnore,
  shouldSyncPath,
} from './exclude'

describe('§6.4 hard exclude table', () => {
  it('never syncs sync-state / retry-queue / trash / index / vault.json', () => {
    expect(classifySyncPath('.v5notes/sync-state.json')).toEqual({ sync: false, reason: 'never' })
    expect(classifySyncPath('.v5notes/retry-queue.json')).toEqual({ sync: false, reason: 'never' })
    expect(classifySyncPath('.v5notes/trash/a.md')).toEqual({ sync: false, reason: 'never' })
    expect(classifySyncPath('.v5notes/index.sqlite')).toEqual({ sync: false, reason: 'never' })
    expect(classifySyncPath('.v5notes/vault.json')).toEqual({ sync: false, reason: 'never' })
  })

  it('syncs intent configs and user markdown', () => {
    expect(shouldSyncPath('.v5notes/appearance.json')).toBe(true)
    expect(shouldSyncPath('工作/周报.md')).toBe(true)
  })

  it('syncs vault-tier plugin settings with the vault that owns them', () => {
    expect(classifySyncPath('.v5notes/plugins/templates/data.json')).toEqual({
      sync: true,
      reason: 'intent-config',
    })
  })

  it('never syncs plugin code or install lists: extensions are app-level', () => {
    expect(classifySyncPath('.v5notes/plugins/hello-world/main.js').sync).toBe(false)
    expect(classifySyncPath('.v5notes/plugins/community-plugins.json').sync).toBe(false)
    expect(classifySyncPath('.v5notes/themes/ink/theme.css').reason).toBe('unlisted-v5notes')
  })

  it('unlisted .v5notes stays local', () => {
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
