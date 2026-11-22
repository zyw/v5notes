/**
 * How a sync device introduces itself, and how that introduction is shown.
 *
 * `bind` used to send the fixed string `v5notes-vault-client/phase5` — a build
 * stage, not a machine name — so every device read the same in the list. The
 * label now names this library and platform (`V5Notes Vault · macOS`), and a
 * label of that shape is rendered as such. Recognising the old literal keeps
 * already-bound rows readable without a migration: the next bind overwrites it.
 */

import { PRODUCT_DISPLAY_NAME } from '../account/constants'
import { deviceShort } from '../account/deviceIdentity'

/** Labels every client sent before this module existed. */
const LEGACY_LABELS = new Set(['v5notes-vault-client/phase5'])

export type DevicePlatform = 'macos' | 'windows' | 'linux' | 'android' | 'ios'

const PLATFORM_NAMES: Record<DevicePlatform, string> = {
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
  android: 'Android',
  ios: 'iOS',
}

/** Platform of the running app, from the WebView's user agent. */
export function detectPlatform(userAgent?: string | null): DevicePlatform | null {
  if (!userAgent) return null
  if (/Android/i.test(userAgent)) return 'android'
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios'
  if (/Macintosh|Mac OS X/i.test(userAgent)) return 'macos'
  if (/Windows/i.test(userAgent)) return 'windows'
  if (/Linux/i.test(userAgent)) return 'linux'
  return null
}

/** What `bind` reports as `clientInfo`. */
export function buildDeviceLabel(userAgent?: string | null): string {
  const platform = detectPlatform(userAgent)
  return platform ? `${PRODUCT_DISPLAY_NAME} · ${PLATFORM_NAMES[platform]}` : PRODUCT_DISPLAY_NAME
}

/** Separator between vault name and platform in a vault-derived label. */
export const LABEL_SEPARATOR = ' · '

/**
 * A label every machine can answer for itself: the vault it has open, its
 * platform, and a short form of this machine's device id. The name alone
 * separates libraries; the device short tells two machines with an identically
 * named library apart, without the server knowing any network address.
 */
export function buildVaultDeviceLabel(
  vaultName: string,
  deviceId: string | null | undefined,
  userAgent?: string | null,
): string {
  const platform = detectPlatform(userAgent)
  const name = vaultName.trim() || PRODUCT_DISPLAY_NAME
  const parts = [name]
  if (platform) parts.push(PLATFORM_NAMES[platform])
  parts.push(deviceShort(deviceId))
  return parts.join(LABEL_SEPARATOR)
}

export interface DeviceLabelParts {
  /** Name line. */
  name: string
  /** Platform carried by the label, when it names one. */
  platform: string | null
  /** Short device id carried by the label, when it names one. */
  deviceShort: string | null
  /** False when the server only holds a free-form label. */
  recognised: boolean
  /** Label written by a build before this module (shows a placeholder name). */
  legacy?: boolean
}

const KNOWN_PLATFORMS = new Set<string>(Object.values(PLATFORM_NAMES))

/** Trailing device segment written by this build: six lowercase alphanumerics. */
const DEVICE_SHORT_RE = /^[a-z0-9]{6}$/

/**
 * Splits only when the second half is a platform this app can send. Vault names
 * may contain " · " themselves, so a plain split would truncate them.
 */
export function describeDeviceLabel(clientInfo: string | null | undefined): DeviceLabelParts {
  const raw = clientInfo?.trim()
  if (!raw) return { name: '', platform: null, deviceShort: null, recognised: false }
  if (LEGACY_LABELS.has(raw)) {
    return { name: raw, platform: null, deviceShort: null, recognised: false, legacy: true }
  }
  const segments = raw.split(LABEL_SEPARATOR).map(part => part.trim()).filter(Boolean)
  let device: string | null = null
  const last = segments[segments.length - 1]
  if (segments.length > 1 && DEVICE_SHORT_RE.test(last)) {
    device = last
    segments.pop()
  }
  const platform = segments.length > 1 ? segments[segments.length - 1] : null
  if (platform && KNOWN_PLATFORMS.has(platform)) segments.pop()
  return {
    name: segments.join(LABEL_SEPARATOR),
    platform: platform && KNOWN_PLATFORMS.has(platform) ? platform : null,
    deviceShort: device,
    recognised: Boolean(device || (platform && KNOWN_PLATFORMS.has(platform))),
  }
}
