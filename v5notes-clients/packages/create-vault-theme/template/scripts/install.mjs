#!/usr/bin/env node
/**
 * 把主题拷进 Vault Client 的扩展目录：
 *
 *   <appConfigDir>/extensions/themes/<manifest.id>/
 *
 * 安装 ≠ 生效：拷完之后到 设置 → 外观 里选中这个主题。当前用哪个主题是
 * 每个库各自的记录（写在该库的 .v5notes/appearance.json）。
 */
import { copyFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, platform } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const BUNDLE_ID = 'xin.v5ai.v5notes.vault';

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const next = process.argv[index + 1];
  return next && !next.startsWith('--') ? next : undefined;
}

function appConfigDir() {
  const explicit = argValue('--app-dir') || process.env.V5NOTES_APP_CONFIG_DIR;
  if (explicit) return resolve(explicit);
  const home = homedir();
  if (platform() === 'darwin') return join(home, 'Library', 'Application Support', BUNDLE_ID);
  if (platform() === 'win32') return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), BUNDLE_ID);
  return join(process.env.XDG_CONFIG_HOME || join(home, '.config'), BUNDLE_ID);
}

function fail(message) {
  console.error('\n✗ ' + message + '\n');
  process.exit(1);
}

const manifest = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8'));
if (!manifest.id || !/^[a-z0-9-]+$/.test(manifest.id)) fail('manifest.id 不合法');

const source = join(ROOT, 'dist');
let entries;
try {
  entries = await readdir(source);
} catch {
  fail('还没有 dist/：先运行 npm run build');
}
if (!entries.includes('theme.css')) fail('dist/ 里没有 theme.css：先运行 npm run build');

const target = join(appConfigDir(), 'extensions', 'themes', manifest.id);
await mkdir(target, { recursive: true });
for (const name of entries) {
  await copyFile(join(source, name), join(target, name));
}

console.log('✓ 已安装到 ' + target);
console.log('  打开 设置 → 外观，选择「' + (manifest.name || manifest.id) + '」。');
console.log('  当前主题按库记录：换一个库要重新选一次。');
