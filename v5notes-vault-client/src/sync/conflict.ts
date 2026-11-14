/**
 * Conflict copy naming (design §9.3).
 * Template: `{stem} (冲突 {yyyy-mm-dd} {HHmm} {deviceShort}).{ext}`
 */

export function deviceShort(deviceId: string | null | undefined, hostFallback = 'dev'): string {
  const raw = (deviceId || hostFallback).replace(/[^a-zA-Z0-9]/g, '')
  if (!raw) return 'dev'
  return raw.slice(0, 6).toLowerCase()
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export function formatConflictStamp(date: Date = new Date()): { day: string; time: string } {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}`
  return { day, time }
}

export function splitStemExt(fileName: string): { stem: string; ext: string } {
  const idx = fileName.lastIndexOf('.')
  if (idx <= 0) return { stem: fileName, ext: '' }
  return { stem: fileName.slice(0, idx), ext: fileName.slice(idx) }
}

/**
 * Build a conflict copy relative path under the same directory as `displayPath`.
 * If `occupied` contains the candidate (by identity-key equality via provided set of identity keys
 * or display paths), appends `-2`, `-3`, …
 */
export function buildConflictCopyPath(
  displayPath: string,
  deviceId: string | null | undefined,
  occupiedIdentityKeys: Set<string>,
  toIdentityKey: (path: string) => string,
  now: Date = new Date(),
): string {
  const parts = displayPath.replace(/\\/g, '/').split('/')
  const fileName = parts.pop() || 'note.md'
  const dir = parts.join('/')
  const { stem, ext } = splitStemExt(fileName)
  const { day, time } = formatConflictStamp(now)
  const short = deviceShort(deviceId)
  const baseName = `${stem} (冲突 ${day} ${time} ${short})${ext}`

  let candidate = dir ? `${dir}/${baseName}` : baseName
  let n = 2
  while (occupiedIdentityKeys.has(toIdentityKey(candidate))) {
    const alt = `${stem} (冲突 ${day} ${time} ${short})-${n}${ext}`
    candidate = dir ? `${dir}/${alt}` : alt
    n += 1
  }
  return candidate
}
