/** True on macOS / iOS hosts where ⌘ is the primary modifier. */
export function isAppleHost(
  userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  platform = typeof navigator === 'undefined' ? '' : navigator.platform,
): boolean {
  return /Mac|iPhone|iPod|iPad/i.test(platform) || /Mac OS|iPhone|iPad|iPod/i.test(userAgent)
}

/** Primary modifier shown in shortcut hints: ⌘ on Apple, Ctrl elsewhere. */
export function modKeyLabel(apple = isAppleHost()): string {
  return apple ? '⌘' : 'Ctrl'
}

/**
 * Format a chord that uses the primary modifier.
 * Apple: ⌘K · Windows/Linux: Ctrl+K
 */
export function modShortcut(key: string, apple = isAppleHost()): string {
  return apple ? `⌘${key}` : `Ctrl+${key}`
}
