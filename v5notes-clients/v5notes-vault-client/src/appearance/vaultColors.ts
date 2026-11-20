/**
 * Direction A · 节气库色 — vault identity stripe colors.
 * Color names are approximate traditional-color labels, not a standard card.
 */

export interface VaultColorSwatch {
  id: string
  term: string
  name: string
  color: string
}

export const VAULT_COLOR_PALETTE: VaultColorSwatch[] = [
  { id: 'lichun', term: '立春', name: '缥碧', color: '#7d8f6e' },
  { id: 'hanlu', term: '寒露', name: '竹青', color: '#8a3b2e' },
  { id: 'yushui', term: '雨水', name: '天水', color: '#6a8a9a' },
  { id: 'qiufen', term: '秋分', name: '缃叶', color: '#c4a882' },
  { id: 'dongzhi', term: '冬至', name: '松花', color: '#4a5c48' },
  { id: 'guyu', term: '谷雨', name: '艾绿', color: '#9aab8c' },
]

function parseHexColor(color: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (!match) return null
  const raw = match[1]!
  const full = raw.length === 3 ? raw.split('').map(part => part + part).join('') : raw
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ]
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const v = value / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Ink for text/icons sitting on a solid vault-color fill. */
export function vaultOnColor(color: string): string {
  const rgb = parseHexColor(color)
  if (!rgb) return '#fffefa'
  const luminance = relativeLuminance(rgb)
  const againstLight = 1.05 / (luminance + 0.05)
  const againstDark = (luminance + 0.05) / 0.05
  return againstLight >= againstDark ? '#fffefa' : '#1f1d18'
}

const STORAGE_KEY = 'v5notes.vault.vault-color.v1'
const PENDING_KEY = 'v5notes.vault.welcome-color.v1'

function hashPath(path: string): number {
  let h = 0
  for (let i = 0; i < path.length; i++) {
    h = (h * 31 + path.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function loadOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveOverrides(map: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

/**
 * 每个库在库内文件（.v5notes/appearance.json）里读到的库色。
 * 必须按库分开记：库列表一次列出所有库，公用一个「当前库色」会让
 * 其它库的色条跟着当前库变色。
 */
const vaultColorByPath = new Map<string, string>()

export function findVaultSwatch(id: string | null | undefined): VaultColorSwatch | null {
  if (!id) return null
  return VAULT_COLOR_PALETTE.find(s => s.id === id) ?? null
}

/**
 * 记下某个库的库内库色。传入 undefined 表示库内还没有写过：
 * 此时沿用本机的旧选择，下一次写盘时连同它一起迁进库。
 */
export function setVaultColorFromVault(
  id: string | null | undefined,
  rootPath?: string | null,
): void {
  const swatch = findVaultSwatch(id)
  if (!rootPath) return
  if (swatch) vaultColorByPath.set(rootPath, swatch.id)
  else vaultColorByPath.delete(rootPath)
}

function vaultColorFor(rootPath: string): VaultColorSwatch | null {
  return findVaultSwatch(vaultColorByPath.get(rootPath))
}

function localOverride(rootPath: string): VaultColorSwatch | null {
  return findVaultSwatch(loadOverrides()[rootPath])
}

function fallbackSwatch(rootPath: string): VaultColorSwatch {
  const idx = hashPath(rootPath) % VAULT_COLOR_PALETTE.length
  return VAULT_COLOR_PALETTE[idx]!
}

/** Resolve order: 该库在库内的库色 → 本机旧偏好 → 按路径哈希的默认色。 */
export function resolveVaultColor(rootPath: string | null | undefined): VaultColorSwatch {
  if (rootPath) {
    const fromVault = vaultColorFor(rootPath)
    if (fromVault) return fromVault
    const local = localOverride(rootPath)
    if (local) return local
    return fallbackSwatch(rootPath)
  }
  return VAULT_COLOR_PALETTE[0]!
}

/**
 * 本机偏好只作回退：库色以库内文件为准，写盘由调用方通过 updateAppearanceFile 完成。
 * 这里同时记下本机一份，供读不到库文件时（库被移动、离线扫描等）仍能显示。
 */
export function setVaultColor(rootPath: string, swatchId: string): VaultColorSwatch {
  const swatch = findVaultSwatch(swatchId) ?? VAULT_COLOR_PALETTE[0]!
  vaultColorByPath.set(rootPath, swatch.id)
  const map = loadOverrides()
  map[rootPath] = swatch.id
  saveOverrides(map)
  applyVaultColor(swatch.color)
  return swatch
}

export function applyVaultColor(color: string | null): void {
  const root = document.documentElement
  if (color) {
    root.style.setProperty('--vault', color)
    root.style.setProperty('--vault-on', vaultOnColor(color))
    root.dataset.vaultColor = color
  } else {
    root.style.removeProperty('--vault')
    root.style.removeProperty('--vault-on')
    delete root.dataset.vaultColor
  }
}

export function applyVaultColorForPath(rootPath: string | null | undefined): VaultColorSwatch | null {
  if (!rootPath) {
    return applyPendingWelcomeColor()
  }
  const swatch = resolveVaultColor(rootPath)
  applyVaultColor(swatch.color)
  return swatch
}

/** Preferred 节气库色 on the welcome picker (before a vault path exists). */
export function getPendingWelcomeColor(): VaultColorSwatch {
  try {
    const id = localStorage.getItem(PENDING_KEY)
    const found = id ? VAULT_COLOR_PALETTE.find(s => s.id === id) : null
    if (found) return found
  } catch {
    /* ignore */
  }
  return VAULT_COLOR_PALETTE.find(s => s.id === 'hanlu') ?? VAULT_COLOR_PALETTE[0]!
}

export function setPendingWelcomeColor(swatchId: string): VaultColorSwatch {
  const swatch = VAULT_COLOR_PALETTE.find(s => s.id === swatchId) ?? getPendingWelcomeColor()
  try {
    localStorage.setItem(PENDING_KEY, swatch.id)
  } catch {
    /* ignore */
  }
  applyVaultColor(swatch.color)
  return swatch
}

export function applyPendingWelcomeColor(): VaultColorSwatch {
  const swatch = getPendingWelcomeColor()
  applyVaultColor(swatch.color)
  return swatch
}

/** Bind the welcome-picked color to a newly opened / created vault path. */
export function commitPendingWelcomeColor(rootPath: string): VaultColorSwatch {
  return setVaultColor(rootPath, getPendingWelcomeColor().id)
}