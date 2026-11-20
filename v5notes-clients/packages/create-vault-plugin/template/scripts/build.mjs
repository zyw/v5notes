#!/usr/bin/env node
/**
 * 把 src/main.ts 构建成宿主真正读取的两个文件：
 *
 *   manifest.json   手写的，这里只做校验
 *   main.js         CJS，module.exports = class ... extends Plugin
 *
 * 宿主这样加载 main.js：
 *   new Function('Plugin', 'module', 'exports', source + ';return module.exports.default || module.exports;')
 * 所以产物必须导出 Plugin 子类。esbuild 的 ESM 输出会被改写成这个形状：
 *
 *   import type ...       -> 类型导入，编译时已擦除
 *   export default class  -> module.exports = <class>
 *
 * @v5notes/vault-plugin-api 故意不打进产物：Plugin 由宿主注入，
 * 多打一份就会出现两个 Plugin 类，插件加载失败。
 */
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const ENTRY = join(ROOT, 'src', 'main.ts');
const OUT = join(ROOT, 'main.js');
const API_ENTRY = resolve(HERE, '../../../vault-plugin-api/src/index.ts');

const checkOnly = process.argv.includes('--check');

const FORBIDDEN = ['network', 'publish', 'sync:control', 'fs:arbitrary', 'shell'];
const RESERVED = ['ui:status', 'editor:extend', 'clipboard'];

function fail(message) {
  console.error('\n✗ ' + message + '\n');
  process.exit(1);
}

async function readManifest() {
  let raw;
  try {
    raw = await readFile(join(ROOT, 'manifest.json'), 'utf8');
  } catch {
    fail('缺少 manifest.json');
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail('manifest.json 不是合法 JSON：' + error.message);
  }
}

function validateManifest(manifest) {
  const errors = [];
  const warnings = [];

  if (!/^[a-z0-9-]+$/.test(String(manifest.id ?? ''))) {
    errors.push('manifest.id 必须匹配 [a-z0-9-]+');
  }
  if (!String(manifest.name ?? '').trim()) errors.push('缺少 name');
  if (!String(manifest.version ?? '').trim()) errors.push('缺少 version');
  if (manifest.kind != null && manifest.kind !== 'plugin') errors.push('kind 只能是 "plugin"');
  if (manifest.main != null && manifest.main !== 'main.js') errors.push('main 固定为 main.js');

  const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
  for (const perm of permissions) {
    const value = String(perm).trim();
    if (FORBIDDEN.includes(value) || value.startsWith('publish:')) {
      errors.push(value + '：第三方永不发放，宿主会拒绝安装');
    } else if (RESERVED.includes(value)) {
      warnings.push(value + ' 目前没有对应的界面或 API');
    }
  }
  if (permissions.includes('network:safe')) {
    const allowlist = manifest.networkAllowlist;
    if (!Array.isArray(allowlist) || !allowlist.length) {
      errors.push('申请 network:safe 必须提供非空 networkAllowlist');
    }
  }
  const tags = Array.isArray(manifest.tags) ? manifest.tags.map((t) => String(t).toLowerCase()) : [];
  if (tags.some((t) => ['publishing', 'publish', 'publisher'].includes(t))) {
    errors.push('tags 里不能出现 publishing / publish / publisher');
  }
  return { errors, warnings };
}

async function compile() {
  try {
    const result = await build({
      entryPoints: [ENTRY],
      bundle: true,
      write: false,
      format: 'esm',
      target: 'es2022',
      platform: 'neutral',
      legalComments: 'none',
      external: ['@v5notes/vault-plugin-api'],
      alias: { '@v5notes/vault-plugin-api': API_ENTRY },
      logLevel: 'silent',
    });
    return result.outputFiles[0].text;
  } catch (error) {
    const details = error && error.errors ? error.errors.map((e) => e.text + (e.location ? ' (' + e.location.file + ':' + e.location.line + ')' : '')) : [];
    return fail(details.length ? details.join('\n') : String((error && error.message) || error));
  }
}

function toHostShape(code) {
  if (code.includes('@v5notes/vault-plugin-api')) {
    fail('产物里仍然引用了 @v5notes/vault-plugin-api；宿主已注入 Plugin，不能打进产物');
  }
  const apiImport = /import\s*\{[^}]*\}\s*from\s*['"]@v5notes\/vault-plugin-api['"];?/g;
  const defaultExport = /export\s*\{\s*([A-Za-z_$][\w$]*)\s+as\s+default\s*\};?/;
  let out = code.replace(apiImport, '');
  if (!defaultExport.test(out)) {
    fail('src/main.ts 必须有一个 export default 的 Plugin 子类');
  }
  out = out.replace(defaultExport, 'module.exports = $1;');
  return out.trim() + '\n';
}

const manifest = await readManifest();
const { errors, warnings } = validateManifest(manifest);
for (const warning of warnings) console.warn('! ' + warning);
if (errors.length) fail(errors.join('\n'));

const bundle = toHostShape(await compile());
if (checkOnly) {
  console.log('✓ manifest.json 与 src/main.ts 校验通过（--check 不写文件）');
  process.exit(0);
}
await writeFile(OUT, bundle, 'utf8');
console.log('✓ 已生成 main.js（' + Buffer.byteLength(bundle) + ' 字节）');
console.log('  下一步：npm run install:app，然后在 设置 → 插件与安全 里启用 ' + manifest.id);
