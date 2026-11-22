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
 * A label every machine can answer for itself: the vault it has open plus its
 * platform. Lets each client recognise its own row (see localDeviceNames) even
 * on a machine that has not bound yet, without the server knowing the network
 * address or hostname of anyone.
 */
export function buildVaultDeviceLabel(vaultName: string, userAgent?: string | null): string {
  const platform = detectPlatform(userAgent)
  const name = vaultName.trim() || PRODUCT_DISPLAY_NAME
  return platform ? `${name}${LABEL_SEPARATOR}${PLATFORM_NAMES[platform]}` : name
}

export interface DeviceLabelParts {
  /** Name line. */
  name: string
  /** Platform carried by the label, when it names one. */
  platform: string | null
  /** False when the server only holds a free-form label. */
  recognised: boolean
  /** Label written by a build before this module (shows a placeholder name). */
  legacy?: boolean
}

const KNOWN_PLATFORMS = new Set<string>(Object.values(PLATFORM_NAMES))

/**
 * Splits only when the second half is a platform this app can send. Vault names
 * may contain " · " themselves, so a plain split would truncate them.
 */
export function describeDeviceLabel(clientInfo: string | null | undefined): DeviceLabelParts {
  const raw = clientInfo?.trim()
  if (!raw) return { name: '', platform: null, recognised: false }
  if (LEGACY_LABELS.has(raw)) return { name: raw, platform: null, recognised: false, legacy: true }
  const cut = raw.lastIndexOf(' · ')
  if (cut > 0) {
    const platform = raw.slice(cut + 3).trim()
    if (KNOWN_PLATFORMS.has(platform)) {
      return { name: raw.slice(0, cut).trim(), platform, recognised: true }
    }
  }
  return { name: raw, platform: null, recognised: false }
}
