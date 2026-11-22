/**
 * Tells an editor's own re-serialisation apart from a user's edit.
 *
 * The Markdown editor normalises what it loads (line endings, collapsing runs
 * of spaces, where trailing spaces go, the block-quote markers it regenerates)
 * and reports the normalised text through `onChange`. That copy differs from
 * the file on disk even when nobody typed anything; writing it back changed the
 * file's bytes, so the next sync compared a new hash against the old one and
 * rejected the upload (`vault.hash.mismatch`) — the file could never sync again.
 *
 * The decision is narrowly about whitespace and quote markers: everything else
 * must match character for character. Adding, removing or reordering any other
 * character is an edit, however small.
 */

/** Text with line breaks, blanks and blank-quote lines set aside. */
function streamOf(text: string, keepQuoteMarkers: boolean): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    // A line that only carries a quote marker is the quote's blank line.
    .filter(line => keepQuoteMarkers || !/^\s*>+\s*$/.test(line))
    .map(line => (keepQuoteMarkers ? line : line.replace(/^\s*(?:>\s?)+/, '')))
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isEditorReserialization(next: string, previous: string): boolean {
  if (next === previous) return false
  if (!previous.trim()) return false
  // The quote allowance is only for a quoted copy: when the source had no quote
  // lines, quote markers on the new side would be content the editor invented.
  if (!previous.includes('>') && next.includes('>')) return false
  // Blanks reflowed, or a quoted copy of the same text: quote markers are the
  // only non-blank characters the editor adds on its own.
  return streamOf(next, false) === streamOf(previous, false)
}
