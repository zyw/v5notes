/** Pure search scoring (no Tauri) — unit-tested. */

export interface ScoredHit {
  path: string
  title: string
  snippet: string
  score: number
}

function titleOf(path: string): string {
  const leaf = path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path
  return leaf.replace(/\.md$/i, '')
}

/** Pure helper: score + snippet for one note. */
export function scoreNoteHit(path: string, body: string, query: string): ScoredHit | null {
  const q = query.trim().toLowerCase()
  if (!q) return null

  const title = titleOf(path)
  const titleLower = title.toLowerCase()
  const pathLower = path.toLowerCase()
  const bodyLower = body.toLowerCase()

  let score = 0
  if (titleLower === q) score += 100
  else if (titleLower.startsWith(q)) score += 60
  else if (titleLower.includes(q)) score += 40
  if (pathLower.includes(q)) score += 10

  const bodyIndex = bodyLower.indexOf(q)
  if (bodyIndex >= 0) score += 20

  if (score === 0) return null

  let snippet = ''
  if (bodyIndex >= 0) {
    const start = Math.max(0, bodyIndex - 24)
    const end = Math.min(body.length, bodyIndex + q.length + 48)
    snippet = `${start > 0 ? '…' : ''}${body.slice(start, end).replace(/\s+/g, ' ')}${end < body.length ? '…' : ''}`
  } else {
    snippet = body.slice(0, 80).replace(/\s+/g, ' ')
  }

  return { path, title, snippet, score }
}
