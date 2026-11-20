#!/usr/bin/env node
/**
 * 校验主题包并输出到 dist/。宿主加载主题时只读 manifest.json 与 theme.css
 * （theme.json 只给设置页预览用），所以这里做的是：校验 + 拷贝。
 *
 * 校验失败时宿主会静默回退到「默认」，界面上看不出原因；这里提前把它说清楚。
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DIST = join(ROOT, 'dist');
const checkOnly = process.argv.includes('--check');

const REQUIRED = ['--bg', '--panel', '--ink', '--muted', '--line', '--accent', '--accent-hover', '--surface', '--danger', '--danger-bg'];

const DANGEROUS = [
  [/@import\b/i, '禁止 @import（主题不能加载外部样式表）'],
  [/expression\s*\(/i, '禁止 CSS expression()'],
  [/javascript\s*:/i, '禁止 javascript: URL'],
  [/-moz-binding\s*:/i, '禁止 -moz-binding'],
  [/behavior\s*:/i, '禁止 behavior'],
  [/@\s*document\b/i, '禁止 @document'],
  [/position\s*:\s*fixed\b/i, '禁止 position:fixed（可能遮挡安全 UI）'],
  [/\*\s*\{[^}]*all\s*:\s*unset/i, '禁止通用选择器 all:unset 重置'],
  [/\*\s*\{[^}]*(?:display\s*:\s*none|visibility\s*:\s*hidden)/i, '禁止用 * 选择器隐藏全部 UI'],
  [/url\s*\(\s*['"]?\s*https?:/i, '禁止远程 url()'],
];

function fail(message) {
  console.error('\n✗ ' + message + '\n');
  process.exit(1);
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

async function main() {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8'));
  } catch (error) {
    return fail('manifest.json 读取失败：' + ((error && error.message) || error));
  }
  const id = String(manifest.id ?? '');
  if (!/^[a-z0-9-]+$/.test(id)) fail('manifest.id 必须匹配 [a-z0-9-]+');
  if (manifest.kind !== 'theme') fail('manifest.kind 必须是 "theme"');
  if (['default', 'dusk'].includes(id)) fail('「' + id + '」是内置主题 id，装上去永远不会被选中');
  for (const perm of manifest.permissions || []) {
    if (!['ui:theme', 'ui:settings', 'ui:commands'].includes(String(perm))) {
      fail('主题不得申请「' + perm + '」');
    }
  }
  if (manifest.main) fail('主题包没有 main.js：删掉 manifest.main');

  const cssName = String(manifest.theme || 'theme.css');
  let css;
  try {
    css = await readFile(join(ROOT, cssName), 'utf8');
  } catch {
    return fail('缺少 ' + cssName);
  }
  const body = stripComments(css);
  if (!body.trim()) fail(cssName + ' 为空');

  for (const [re, message] of DANGEROUS) {
    if (re.test(body)) fail(message);
  }

  if (/(?:^|[},])\s*:root\s*(?=[,{])/i.test(body)) {
    fail("以 :root 开头的规则必须限定到本主题，例如 :root[data-community-theme='" + id + "']");
  }
  const scope = "data-community-theme='" + id + "'";
  for (const match of body.matchAll(/([^{}]+)\{/g)) {
    const selector = match[1].trim();
    if (selector && !selector.startsWith('@') && !selector.includes(scope)) {
      fail('规则没有限定到本主题：' + selector.slice(0, 60));
    }
  }

  const defined = new Set([...body.matchAll(/(--[a-zA-Z0-9-_]+)\s*:/g)].map((m) => m[1]));
  const missing = REQUIRED.filter((token) => !defined.has(token));
  if (missing.length > REQUIRED.length / 2) fail('缺少过多设计 token（至少一半）：' + missing.join(', '));
  if (missing.length) console.warn('! 未定义部分 token（将回退内置）：' + missing.join(', '));
  if (!body.includes("[data-color-mode='dark']")) {
    console.warn('! 没有深色 palette：切到深色时主题不会变');
  }
  if (!/--vault\s*:[^;]*!important/.test(body)) {
    console.warn('! --vault 没有 !important：应用写的库色会盖住主题色');
  }

  if (checkOnly) {
    console.log('✓ 主题校验通过（--check 不写文件）');
    return;
  }

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  const entries = await readdir(ROOT, { withFileTypes: true });
  let copied = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(json|css)$/.test(entry.name)) continue;
    await writeFile(join(DIST, entry.name), await readFile(join(ROOT, entry.name), 'utf8'));
    copied += 1;
  }
  console.log('✓ 已输出 dist/（' + copied + ' 个文件）');
  console.log('  下一步：npm run install:app，然后在 设置 → 外观 里选择 ' + (manifest.name || id) + '。');
}

main().catch((error) => fail((error && error.message) || String(error)));
