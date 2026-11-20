/**
 * Minimal argv parser: --key value / --key=value / --flag. No dependency.
 */
export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const body = arg.slice(2);
    const eq = body.indexOf('=');
    if (eq !== -1) {
      flags[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }
    const next = argv[i + 1];
    if (next == null || next.startsWith('--')) {
      flags[body] = true;
      continue;
    }
    flags[body] = next;
    i++;
  }
  return { positional, flags };
}

export function flagValue(flags, name) {
  const value = flags[name];
  return typeof value === 'string' ? value : undefined;
}

export function flagList(flags, name) {
  const value = flags[name];
  if (value == null) return [];
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
