import { hasPublishingTag, parseList, validatePermissions } from './capabilities.js';
import { PLUGIN_ID_RE } from './id.js';
import { toDisplayName } from './naming.js';

/**
 * The manifest contract, mirrored from
 * v5notes-vault-client/src/plugin-host/manifest.ts.
 *
 * The host still re-validates at load time. Doing it here as well means a bad
 * package fails in the terminal that produced it, not silently in a settings
 * list that explains nothing.
 */

export function buildManifest(options) {
  const permissions = parseList(options.permissions);
  const manifest = {
    id: options.id,
    // Always emit a readable name: a manifest without one falls back to the
    // raw id in the settings list.
    name: String(options.name ?? '').trim() || toDisplayName(options.id),
    kind: 'plugin',
    version: options.version || '1.0.0',
    minAppVersion: options.minAppVersion || '0.1.0',
    description: options.description || '',
    author: options.author || '',
    permissions,
    tags: parseList(options.tags),
    main: 'main.js',
  };
  if (permissions.includes('network:safe')) {
    manifest.networkAllowlist = parseList(options.networkAllowlist);
  }
  if (!manifest.description) delete manifest.description;
  if (!manifest.author) delete manifest.author;
  if (!manifest.tags.length) delete manifest.tags;
  return manifest;
}

function semverParts(value) {
  return String(value)
    .replace(/^v/, '')
    .split('.')
    .map((x) => parseInt(x, 10) || 0);
}

export function compareSemver(a, b) {
  const pa = semverParts(a);
  const pb = semverParts(b);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * @param {unknown} input parsed manifest.json
 * @param {{ hostVersion?: string }} options
 * @returns {{ errors: string[], warnings: string[], manifest: object | null }}
 */
export function validateManifest(input, options = {}) {
  const errors = [];
  const warnings = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: ['manifest 必须是一个 JSON 对象'], warnings, manifest: null };
  }

  const id = String(input.id ?? '').trim();
  if (!PLUGIN_ID_RE.test(id)) errors.push('manifest.id「' + id + '」不合法：只允许 a-z、0-9、-');

  if (input.kind != null && input.kind !== 'plugin') {
    errors.push('kind 只能是 "plugin"（主题用 create-vault-theme）；收到「' + input.kind + '」');
  }
  if (!String(input.name ?? '').trim()) errors.push('缺少 name');
  if (!String(input.version ?? '').trim()) errors.push('缺少 version');

  const permissions = input.permissions == null ? [] : input.permissions;
  if (!Array.isArray(permissions)) {
    errors.push('permissions 必须是数组');
  } else {
    const checked = validatePermissions(permissions);
    errors.push(...checked.errors);
    warnings.push(...checked.warnings);
  }

  if (hasPublishingTag(input.tags)) {
    errors.push('tags 里不能出现 publishing / publish / publisher（第三方无发布能力）');
  }

  const networkSafe = Array.isArray(permissions) && permissions.includes('network:safe');
  const allowlist = input.networkAllowlist;
  if (networkSafe) {
    if (!Array.isArray(allowlist) || allowlist.length === 0) {
      errors.push('申请 network:safe 必须提供非空 networkAllowlist');
    } else {
      for (const host of allowlist) {
        const value = String(host ?? '').trim();
        if (!value || /[\s/:]/.test(value)) {
          errors.push('networkAllowlist 项无效（只写 host 或 *.domain）：「' + value + '」');
        }
      }
    }
  } else if (Array.isArray(allowlist) && allowlist.length) {
    warnings.push('没有申请 network:safe，networkAllowlist 会被忽略');
  }

  if (input.main != null && input.main !== 'main.js') {
    errors.push('main 固定为 "main.js"（构建产物名）；收到「' + input.main + '」');
  }

  const hostVersion = options.hostVersion;
  if (input.minAppVersion && hostVersion && compareSemver(hostVersion, String(input.minAppVersion)) < 0) {
    warnings.push('minAppVersion ' + input.minAppVersion + ' 高于当前宿主 ' + hostVersion + '，本机会加载失败');
  }

  return { errors, warnings, manifest: errors.length ? null : input };
}

/**
 * Imports that would drag the host API package into the bundle. The host
 * injects Plugin; a second copy makes `extends` resolve to a different class
 * and the loader rejects the export.
 */
export function findHostApiImports(source) {
  const hits = [];
  const patterns = [
    /from\s+['"]@v5notes\/vault-plugin-api['"]/g,
    /require\(\s*['"]@v5notes\/vault-plugin-api['"]\s*\)/g,
    /import\(\s*['"]@v5notes\/vault-plugin-api['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let match;
    while ((match = re.exec(source))) hits.push(match[0]);
  }
  return hits;
}

/** Throws when the built main.js still references the host API package. */
export function assertBundleIsClean(source) {
  const hits = findHostApiImports(source);
  if (hits.length) {
    throw new Error(
      'main.js 里仍然引用 @v5notes/vault-plugin-api（' +
        hits.join(' / ') +
        '）：宿主已注入 Plugin，打进产物会形成两个 Plugin 类，插件将加载失败',
    );
  }
  return source;
}

/**
 * The host evaluates main.js as CJS and accepts module.exports or
 * module.exports.default. Check the shape here so "加载失败：main.js 必须导出
 * Plugin 子类" never has to appear without an explanation.
 */
export function assertCjsExport(source) {
  if (!/module\.exports\s*=\s*[\s\S]*?extends\s+Plugin/.test(source)) {
    throw new Error('main.js 必须以 module.exports = class ... extends Plugin 的形式导出 Plugin 子类');
  }
  return source;
}
