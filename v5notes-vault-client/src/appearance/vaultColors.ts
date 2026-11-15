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

const STORAGE_KEY = 'v5notes.vault.vault-color.v1'

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

export function resolveVaultColor(rootPath: string): VaultColorSwatch {
  const overrides = loadOverrides()
  const overrideId = overrides[rootPath]
  if (overrideId) {
    const found = VAULT_COLOR_PALETTE.find(s => s.id === overrideId)
    if (found) return found
  }
  const idx = hashPath(rootPath) % VAULT_COLOR_PALETTE.length
  return VAULT_COLOR_PALETTE[idx]!
}

export function setVaultColor(rootPath: string, swatchId: string): VaultColorSwatch {
  const swatch = VAULT_COLOR_PALETTE.find(s => s.id === swatchId) ?? VAULT_COLOR_PALETTE[0]!
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
    root.dataset.vaultColor = color
  } else {
    root.style.removeProperty('--vault')
    delete root.dataset.vaultColor
  }
}

export function applyVaultColorForPath(rootPath: string | null | undefined): VaultColorSwatch | null {
  if (!rootPath) {
    applyVaultColor(null)
    return null
  }
  const swatch = resolveVaultColor(rootPath)
  applyVaultColor(swatch.color)
  return swatch
}
