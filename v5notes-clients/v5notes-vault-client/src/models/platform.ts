export type ShortcutPlatform = 'mac' | 'win'

/** True on macOS / iOS hosts where ⌘ is the primary modifier. */
export function isAppleHost(
  userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  platform = typeof navigator === 'undefined' ? '' : navigator.platform,
): boolean {
  return /Mac|iPhone|iPod|iPad/i.test(platform) || /Mac OS|iPhone|iPad|iPod/i.test(userAgent)
}

/** Shortcut platform bucket used for modifier matching and keycap formatting. */
export function detectShortcutPlatform(
  userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  platform = typeof navigator === 'undefined' ? '' : navigator.platform,
): ShortcutPlatform {
  return isAppleHost(userAgent, platform) ? 'mac' : 'win'
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
  if (apple) return `⌘${key}`
  let normalized = key
  if (normalized.startsWith('⇧')) {
    normalized = `Shift+${normalized.slice(1)}`
  }
  if (normalized === '−') normalized = '-'
  return `Ctrl+${normalized}`
}
