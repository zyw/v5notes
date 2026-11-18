import { describe, expect, it } from 'vitest'
import {
  formatReleaseDate,
  initialUpdateState,
  messageForCheckFailure,
  messageForTransferFailure,
  notesToShowOnLaunch,
  parsePendingNotes,
  progressLabel,
  reduceUpdate,
  settingsActionLabel,
  shouldAutoPrompt,
  shouldCheckSilently,
  SILENT_CHECK_INTERVAL_MS,
  type ReleaseOffer,
} from './appUpdate'

const offer: ReleaseOffer = { version: '0.2.0', notes: '说明', date: '2026-11-10T00:00:00Z', downloaded: false }

describe('reduceUpdate', () => {
  it('opens a manual check and ignores a second one while it is running', () => {
    const checking = reduceUpdate(initialUpdateState(), { type: 'manual-check' })
    expect(checking).toMatchObject({ visible: true, phase: { kind: 'checking' } })
    expect(reduceUpdate(checking, { type: 'manual-check' })).toBe(checking)
  })

  it('keeps a silent miss invisible and shows a manual miss', () => {
    const silent = reduceUpdate(initialUpdateState(), { type: 'silent-check' })
    expect(reduceUpdate(silent, { type: 'up-to-date' }).phase.kind).toBe('idle')
    const manual = reduceUpdate(initialUpdateState(), { type: 'manual-check' })
    expect(reduceUpdate(manual, { type: 'up-to-date' }).phase.kind).toBe('current')
  })

  it('hides a silent failure and shows a manual failure', () => {
    const silent = reduceUpdate(initialUpdateState(), { type: 'silent-check' })
    expect(reduceUpdate(silent, { type: 'check-failed', message: '离线' }).visible).toBe(false)
    const manual = reduceUpdate(initialUpdateState(), { type: 'manual-check' })
    const failed = reduceUpdate(manual, { type: 'check-failed', message: '离线' })
    expect(failed.phase).toMatchObject({ kind: 'error', message: '离线', retry: 'check' })
  })

  it('reveals an available update only when asked, and can reopen it after dismissal', () => {
    const found = reduceUpdate(initialUpdateState(), { type: 'available', offer, reveal: false })
    expect(found.visible).toBe(false)
    expect(found.offer?.version).toBe('0.2.0')
    const opened = reduceUpdate(found, { type: 'reopen' })
    expect(opened.visible).toBe(true)
    expect(opened.phase.kind).toBe('available')
    const closed = reduceUpdate(opened, { type: 'close' })
    expect(closed.visible).toBe(false)
    expect(closed.offer?.version).toBe('0.2.0')
  })

  it('moves through download, a blocked install, and install', () => {
    const available = reduceUpdate(initialUpdateState(), { type: 'available', offer, reveal: true })
    const downloading = reduceUpdate(available, { type: 'download' })
    const progressed = reduceUpdate(downloading, { type: 'progress', received: 50, total: 100 })
    expect(progressed.phase).toMatchObject({ kind: 'downloading', received: 50, total: 100 })
    const ready = reduceUpdate(progressed, { type: 'install-deferred' })
    expect(ready.phase.kind).toBe('ready')
    expect(ready.offer?.downloaded).toBe(true)
    expect(reduceUpdate(ready, { type: 'install' }).phase.kind).toBe('installing')
  })

  it('does not close while installing or downloading', () => {
    const available = reduceUpdate(initialUpdateState(), { type: 'available', offer, reveal: true })
    const downloading = reduceUpdate(available, { type: 'download' })
    expect(reduceUpdate(downloading, { type: 'close' })).toBe(downloading)
    const installing = reduceUpdate(reduceUpdate(downloading, { type: 'downloaded' }), { type: 'install' })
    expect(reduceUpdate(installing, { type: 'close' })).toBe(installing)
  })

  it('returns to the offer when a download is cancelled', () => {
    const available = reduceUpdate(initialUpdateState(), { type: 'available', offer, reveal: true })
    const cancelled = reduceUpdate(reduceUpdate(available, { type: 'download' }), { type: 'cancel-download' })
    expect(cancelled.phase.kind).toBe('available')
    expect(cancelled.offer?.downloaded).toBe(false)
  })
})

describe('update reminders', () => {
  it('checks again after six hours', () => {
    const now = Date.parse('2026-11-10T12:00:00Z')
    expect(shouldCheckSilently(null, now)).toBe(true)
    expect(shouldCheckSilently('not-a-date', now)).toBe(true)
    expect(shouldCheckSilently(new Date(now - SILENT_CHECK_INTERVAL_MS + 1000).toISOString(), now)).toBe(false)
    expect(shouldCheckSilently(new Date(now - SILENT_CHECK_INTERVAL_MS).toISOString(), now)).toBe(true)
  })

  it('suppresses the same dismissed version and shows a different one', () => {
    expect(shouldAutoPrompt('0.2.0', '0.2.0')).toBe(false)
    expect(shouldAutoPrompt('0.2.0', '0.3.0')).toBe(true)
    expect(shouldAutoPrompt(null, '0.2.0')).toBe(true)
  })

  it('shows stored notes once for the version that just launched', () => {
    const pending = { version: '0.2.0', notes: '新功能', seen: false }
    expect(notesToShowOnLaunch(pending, '0.2.0')).toEqual(pending)
    expect(notesToShowOnLaunch({ ...pending, seen: true }, '0.2.0')).toBeNull()
    expect(notesToShowOnLaunch(pending, '0.1.0')).toBeNull()
    expect(parsePendingNotes('{')).toBeNull()
    expect(parsePendingNotes(JSON.stringify(pending))?.notes).toBe('新功能')
  })
})

describe('update copy', () => {
  it('formats progress and dates', () => {
    expect(progressLabel(18.6 * 1024 * 1024, 44.2 * 1024 * 1024)).toBe('42% · 18.6 MB / 44.2 MB')
    expect(progressLabel(1024 * 1024)).toBe('1.0 MB')
    expect(formatReleaseDate('2026-11-10T00:00:00Z')).toBe('2026-11-10')
  })

  it('separates a failed check from a missing platform and a bad signature', () => {
    expect(messageForCheckFailure('404', 'macos')).toBe('暂时无法检查更新，请稍后重试')
    expect(messageForCheckFailure('unsupported platform darwin-x86_64', 'macos')).toBe('当前没有适用于这台 Mac 的更新包')
    expect(messageForCheckFailure('target windows-x86_64 not found', 'windows')).toBe('当前没有适用于这台 Windows 的更新包')
    expect(messageForTransferFailure('signature mismatch')).toBe('更新包校验失败，已取消安装')
    expect(messageForTransferFailure('No space left on device')).toBe('No space left on device')
    expect(messageForTransferFailure('  ')).toBe('下载中断，请重试')
  })

  it('names the settings action from the current check', () => {
    expect(settingsActionLabel(true, '0.2.0')).toBe('正在检查…')
    expect(settingsActionLabel(false, '0.2.0')).toBe('可更新至 0.2.0')
    expect(settingsActionLabel(false, null)).toBe('检查更新')
  })
})
