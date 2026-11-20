import { readdir, stat } from 'node:fs/promises';

export async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectoryEmpty(path) {
  return (await readdir(path)).length === 0;
}
