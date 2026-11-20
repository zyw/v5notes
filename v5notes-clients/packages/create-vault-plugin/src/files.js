import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git']);

/** Recursive file list, relative to `root`, sorted for stable output. */
export async function walkFiles(root, options = {}) {
  const skip = options.skip ? new Set([...SKIP_DIRS, ...options.skip]) : SKIP_DIRS;
  const out = [];
  async function visit(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (skip.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile()) out.push(relative(root, full).split('\\').join('/'));
    }
  }
  await visit(root);
  return out;
}

export async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectoryEmpty(path) {
  const entries = await readdir(path);
  return entries.length === 0;
}

export async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function writeJson(path, value) {
  await ensureDir(dirname(path));
  await writeFile(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

export async function writeText(path, value) {
  await ensureDir(dirname(path));
  await writeFile(path, value.endsWith('\n') ? value : value + '\n', 'utf8');
}

export { readFile, writeFile, dirname, join, relative };
