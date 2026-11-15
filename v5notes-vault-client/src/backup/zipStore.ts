/**
 * Minimal ZIP (store / no compression) for vault backups.
 * Backup zip is never a Sync transport — see copy.ts.
 */

export interface ZipEntry {
  /** Path inside the archive using `/` separators (no leading slash). */
  path: string
  data: Uint8Array
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]!
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2)
  b[0] = n & 0xff
  b[1] = (n >>> 8) & 0xff
  return b
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4)
  b[0] = n & 0xff
  b[1] = (n >>> 8) & 0xff
  b[2] = (n >>> 16) & 0xff
  b[3] = (n >>> 24) & 0xff
  return b
}

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0
  for (const p of parts) total += p.length
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

/** Build an uncompressed ZIP archive (PKZIP store). */
export function buildZipStore(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const name = entry.path.replace(/\\/g, '/').replace(/^\/+/, '')
    if (!name || name.includes('..')) {
      throw new Error(`非法 zip 路径: ${entry.path}`)
    }
    const nameBytes = encodeUtf8(name)
    const data = entry.data
    const crc = crc32(data)
    const generalPurpose = 0x0800 // UTF-8
    const localHeader = concat([
      u32(0x04034b50),
      u16(20),
      u16(generalPurpose),
      u16(0), // store
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
    ])
    localParts.push(localHeader, data)

    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(generalPurpose),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ])
    centralParts.push(central)
    offset += localHeader.length + data.length
  }

  const centralDir = concat(centralParts)
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ])

  return concat([...localParts, centralDir, end])
}

export function defaultBackupFileName(vaultName: string, now = new Date()): string {
  const safe = vaultName
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'vault'
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, (c) => (c === 'T' ? '-' : c === ':' ? '' : ''))
  return `${safe}-backup-${stamp}.zip`
}
