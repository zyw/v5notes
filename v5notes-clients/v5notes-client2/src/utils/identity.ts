const idKey = /^(?:id|pid|createDept|.*Id|.*Ids)$/

export function asId(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value)
  throw new Error('Received unsafe numeric ID')
}

export function normalizeIds<T>(value: T): T {
  function visit(input: unknown, key = ''): unknown {
    if (Array.isArray(input)) return input.map(item => visit(item, key))
    if (input !== null && typeof input === 'object') {
      return Object.fromEntries(Object.entries(input).map(([name, item]) => [name, visit(item, name)]))
    }
    if (idKey.test(key) && typeof input === 'number') {
      try { return asId(input) }
      catch { throw new Error(`Received unsafe numeric ID in ${key}`) }
    }
    return input
  }
  return visit(value) as T
}
