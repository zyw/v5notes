const idKey = /^(?:id|pid|createDept|.*Id|.*Ids)$/;

export function normalizeIds<T>(value: T): T {
  function visit(current: unknown, key = ''): unknown {
    if (Array.isArray(current)) {
      return current.map(item => visit(item, key));
    }
    if (current !== null && typeof current === 'object') {
      return Object.fromEntries(
        Object.entries(current).map(([name, item]) => [name, visit(item, name)])
      );
    }
    if (idKey.test(key) && typeof current === 'number') {
      if (!Number.isSafeInteger(current)) {
        throw new Error(`Received unsafe numeric ID in ${key}`);
      }
      return String(current);
    }
    return current;
  }

  return visit(value) as T;
}
