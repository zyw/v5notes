/** SHA-256 content hash with protocol prefix `sha256:`. */

export async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  let buffer: ArrayBuffer
  if (typeof data === 'string') {
    const encoded = new TextEncoder().encode(data)
    buffer = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer
  } else if (data instanceof Uint8Array) {
    buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  } else {
    buffer = data
  }
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    return `sha256:${simpleFallbackHex(new Uint8Array(buffer))}`
  }
  const digest = await subtle.digest('SHA-256', buffer)
  return `sha256:${bufferToHex(digest)}`
}

export function normalizeContentHash(value: string): string {
  const trimmed = value.trim().toLowerCase()
  if (trimmed.startsWith('sha256:')) {
    const hex = trimmed.slice('sha256:'.length)
    if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error('contentHash 无效')
    return `sha256:${hex}`
  }
  if (/^[0-9a-f]{64}$/.test(trimmed)) return `sha256:${trimmed}`
  throw new Error('contentHash 无效')
}

function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function simpleFallbackHex(bytes: Uint8Array): string {
  // Not cryptographic; only for unit tests without subtle in weird runtimes.
  let h = 0
  for (const b of bytes) h = (Math.imul(31, h) + b) >>> 0
  return h.toString(16).padStart(64, '0').slice(0, 64)
}
