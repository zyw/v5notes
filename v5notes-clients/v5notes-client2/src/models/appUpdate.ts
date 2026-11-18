import { t } from '../i18n'

/** 应用内更新的阶段。网络和安装留在调用方，这里只决定界面该停在哪。 */

export type HostOs = 'macos' | 'windows' | 'linux'

export interface ReleaseOffer {
  version: string
  notes: string
  date?: string
  downloaded: boolean
}

export type UpdatePhase =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'current' }
  | { kind: 'available'; offer: ReleaseOffer }
  | { kind: 'downloading'; offer: ReleaseOffer; received: number; total?: number }
  | { kind: 'ready'; offer: ReleaseOffer }
  | { kind: 'installing'; offer: ReleaseOffer }
  | { kind: 'error'; message: string; retry: 'check' | 'download' }
  | { kind: 'unsupported' }
  | { kind: 'installed-notes'; offer: ReleaseOffer }

export interface UpdateState {
  phase: UpdatePhase
  visible: boolean
  /** 已经发现、用户还未安装的版本。对话框关掉之后设置里仍要能打开。 */
  offer: ReleaseOffer | null
}

export type UpdateEvent =
  | { type: 'manual-check' }
  | { type: 'silent-check' }
  | { type: 'reopen' }
  | { type: 'up-to-date' }
  | { type: 'available'; offer: ReleaseOffer; reveal: boolean }
  | { type: 'reveal' }
  | { type: 'check-failed'; message: string }
  | { type: 'download' }
  | { type: 'progress'; received: number; total?: number }
  | { type: 'downloaded' }
  | { type: 'install-deferred' }
  | { type: 'install' }
  | { type: 'failed'; message: string; retry: 'check' | 'download' }
  | { type: 'cancel-download' }
  | { type: 'unsupported' }
  | { type: 'show-installed'; offer: ReleaseOffer }
  | { type: 'close' }

export interface PendingReleaseNotes {
  version: string
  notes: string
  pubDate?: string
  seen: boolean
}

export const UPDATE_CHECKED_AT_KEY = 'v5notes-update-checked-at'
export const UPDATE_DISMISSED_KEY = 'v5notes-update-dismissed-version'
export const UPDATE_NOTES_KEY = 'v5notes-pending-release-notes'
export const SILENT_CHECK_DELAY_MS = 8_000
export const SILENT_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

export function initialUpdateState(): UpdateState {
  return { phase: { kind: 'idle' }, visible: false, offer: null }
}

function busy(phase: UpdatePhase): boolean {
  return phase.kind === 'checking' || phase.kind === 'downloading' || phase.kind === 'installing'
}

function phaseForOffer(offer: ReleaseOffer): UpdatePhase {
  return offer.downloaded ? { kind: 'ready', offer } : { kind: 'available', offer }
}

export function reduceUpdate(state: UpdateState, event: UpdateEvent): UpdateState {
  switch (event.type) {
    case 'manual-check':
    case 'silent-check':
      if (busy(state.phase)) return state
      return { ...state, visible: event.type === 'manual-check' ? true : state.visible, phase: { kind: 'checking' } }
    case 'reopen':
      if (!state.offer || busy(state.phase)) return state
      return { ...state, visible: true, phase: phaseForOffer(state.offer) }
    case 'up-to-date':
      return { ...state, offer: null, phase: state.visible ? { kind: 'current' } : { kind: 'idle' } }
    case 'available':
      return { offer: event.offer, visible: state.visible || event.reveal, phase: { kind: 'available', offer: event.offer } }
    case 'reveal':
      if (state.phase.kind !== 'available' || state.visible) return state
      return { ...state, visible: true }
    case 'check-failed':
      if (!state.visible) return { ...state, phase: state.offer ? phaseForOffer(state.offer) : { kind: 'idle' } }
      return { ...state, phase: { kind: 'error', message: event.message, retry: 'check' } }
    case 'unsupported':
      return { ...state, visible: true, phase: { kind: 'unsupported' } }
    case 'download':
      if (state.phase.kind !== 'available') return state
      return { ...state, visible: true, phase: { kind: 'downloading', offer: state.phase.offer, received: 0 } }
    case 'progress':
      if (state.phase.kind !== 'downloading') return state
      return { ...state, phase: { ...state.phase, received: event.received, total: event.total } }
    case 'downloaded':
      if (state.phase.kind !== 'downloading') return state
      return { ...state, offer: { ...state.phase.offer, downloaded: true }, phase: { kind: 'ready', offer: { ...state.phase.offer, downloaded: true } } }
    case 'install-deferred':
      if (state.phase.kind !== 'downloading' && state.phase.kind !== 'ready') return state
      return { ...state, offer: { ...state.phase.offer, downloaded: true }, visible: true, phase: { kind: 'ready', offer: { ...state.phase.offer, downloaded: true } } }
    case 'install':
      if (state.phase.kind !== 'ready' && state.phase.kind !== 'downloading') return state
      return { ...state, visible: true, phase: { kind: 'installing', offer: { ...state.phase.offer, downloaded: true } } }
    case 'failed':
      return { ...state, visible: true, phase: { kind: 'error', message: event.message, retry: event.retry } }
    case 'cancel-download':
      if (!state.offer) return { ...state, phase: { kind: 'idle' }, visible: state.visible }
      return { ...state, offer: { ...state.offer, downloaded: false }, visible: true, phase: { kind: 'available', offer: { ...state.offer, downloaded: false } } }
    case 'show-installed':
      return { ...state, visible: true, phase: { kind: 'installed-notes', offer: event.offer } }
    case 'close':
      if (state.phase.kind === 'installing' || state.phase.kind === 'downloading') return state
      return { ...state, visible: false, phase: { kind: 'idle' } }
  }
}

export function shouldCheckSilently(checkedAt: string | null, now: number): boolean {
  if (!checkedAt) return true
  const then = Date.parse(checkedAt)
  if (Number.isNaN(then)) return true
  return now - then >= SILENT_CHECK_INTERVAL_MS
}

/** 同一个版本点过「稍后」之后，静默检查不再弹出。手动打开不受影响。 */
export function shouldAutoPrompt(dismissedVersion: string | null, availableVersion: string): boolean {
  return dismissedVersion !== availableVersion
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0.0 MB'
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function progressLabel(received: number, total?: number): string {
  const done = formatBytes(received)
  if (!total || total <= 0) return done
  const percent = Math.min(100, Math.floor((received / total) * 100))
  return `${percent}% · ${done} / ${formatBytes(total)}`
}

export function formatReleaseDate(value?: string): string {
  if (!value) return ''
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim())
  return match ? match[1] : value.trim()
}

export function parsePendingNotes(raw: string | null): PendingReleaseNotes | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PendingReleaseNotes>
    if (!parsed || typeof parsed.version !== 'string' || typeof parsed.notes !== 'string') return null
    return {
      version: parsed.version,
      notes: parsed.notes,
      pubDate: typeof parsed.pubDate === 'string' ? parsed.pubDate : undefined,
      seen: parsed.seen === true,
    }
  } catch {
    return null
  }
}

export function notesToShowOnLaunch(notes: PendingReleaseNotes | null, currentVersion: string): PendingReleaseNotes | null {
  if (!notes || notes.seen || notes.version !== currentVersion) return null
  return notes
}

export function messageForCheckFailure(raw: string, os: HostOs): string {
  if (isSignatureFailure(raw)) return t('update.signature')
  if (isMissingPlatform(raw)) {
    return os === 'windows' ? t('update.missingWindows') : t('update.missingMac')
  }
  return t('update.checkLater')
}

export function messageForTransferFailure(raw: string): string {
  if (isSignatureFailure(raw)) return t('update.signature')
  const trimmed = raw.trim()
  return trimmed || t('update.downloadInterrupted')
}

function isSignatureFailure(raw: string): boolean {
  return /signature|minisign|checksum|校验/i.test(raw)
}

function isMissingPlatform(raw: string): boolean {
  return /platform|target|unsupported|not supported|架构/i.test(raw)
}

export function settingsActionLabel(checking: boolean, offeredVersion: string | null): string {
  if (checking) return t('settings.checking')
  if (offeredVersion) return t('settings.updateTo', { version: offeredVersion })
  return t('settings.checkUpdate')
}
