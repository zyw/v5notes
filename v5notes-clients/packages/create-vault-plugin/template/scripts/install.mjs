#!/usr/bin/env node
/**
 * 把构建好的包拷进 Vault Client 的扩展目录：
 *
 *   <appConfigDir>/extensions/plugins/<manifest.id>/
 *
 * 这里只写文件。安装 ≠ 启用：拷完之后要到 设置 → 插件与安全 点「启用」。
 *
 * 应用配置目录的取法（先命中先用）：
 *   --app-dir <dir>  |  V5NOTES_APP_CONFIG_DIR  |  平台默认（bundle id xin.v5ai.v5notes.vault）
 */
import { copyFile, mkdir, readFile } from 'node:fs/promises';
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

let built;
try {
  built = await readFile(join(ROOT, 'main.js'), 'utf8');
} catch {
  fail('还没有 main.js：先运行 npm run build');
}
if (!/module\.exports\s*=/.test(built)) {
  fail('main.js 不是宿主需要的 CJS 形式：先运行 npm run build');
}

const target = join(appConfigDir(), 'extensions', 'plugins', manifest.id);
await mkdir(target, { recursive: true });
await copyFile(join(ROOT, 'manifest.json'), join(target, 'manifest.json'));
await copyFile(join(ROOT, 'main.js'), join(target, 'main.js'));

console.log('✓ 已安装到 ' + target);
console.log('  打开 设置 → 插件与安全，在「' + (manifest.name || manifest.id) + '」这一行点「启用」。');
console.log('  安装 ≠ 启用：只改了代码时，点「禁用」再「启用」即可重载。');
