import { validateHexColor } from './validate.js';

/**
 * Theme manifest contract, mirrored from
 * v5notes-vault-client/src/plugin-host/manifest.ts (kind === 'theme' path).
 *
 * Differences from a plugin manifest that matter:
 * - kind must be "theme";
 * - only ui:theme (plus ui:settings / ui:commands) is allowed — no vault:*,
 *   no network:safe, no editor:*;
 * - there is no main.js; the entry is theme.css.
 */

export const THEME_ALLOWED_PERMISSIONS = ['ui:theme', 'ui:settings', 'ui:commands'];
export const THEME_ID_RE = /^[a-z0-9-]+$/;

/** Builtin ids the host resolves before it ever looks at installed themes. */
export const RESERVED_THEME_IDS = ['default', 'dusk'];

export function buildThemeManifest(options) {
  return {
    id: options.id,
    name: options.name,
    kind: 'theme',
    version: options.version || '1.0.0',
    minAppVersion: options.minAppVersion || '0.1.0',
    permissions: ['ui:theme'],
    theme: 'theme.css',
    themeMeta: 'theme.json',
  };
}

export function validateThemeManifest(input) {
  const errors = [];
  const warnings = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: ['manifest 必须是一个 JSON 对象'], warnings };
  }

  const id = String(input.id ?? '').trim();
  if (!THEME_ID_RE.test(id)) errors.push('manifest.id「' + id + '」不合法：只允许 a-z、0-9、-');
  if (RESERVED_THEME_IDS.includes(id)) {
    errors.push('「' + id + '」是内置主题 id，装上去永远不会被选中');
  }

  if (input.kind !== 'theme') errors.push('kind 必须是 "theme"；收到「' + input.kind + '」');
  if (!String(input.name ?? '').trim()) errors.push('缺少 name');
  if (!String(input.version ?? '').trim()) errors.push('缺少 version');

  if (input.theme != null && input.theme !== 'theme.css') {
    errors.push('theme 固定为 "theme.css"（宿主按 manifest.theme 或默认名读取）；收到「' + input.theme + '」');
  }
  if (input.themeMeta != null && input.themeMeta !== 'theme.json') {
    errors.push('themeMeta 固定为 "theme.json"；收到「' + input.themeMeta + '」');
  }
  if (input.main != null) {
    errors.push('主题包没有 main.js：请删掉 manifest.main');
  }

  const permissions = input.permissions == null ? ['ui:theme'] : input.permissions;
  if (!Array.isArray(permissions)) {
    errors.push('permissions 必须是数组');
  } else {
    for (const perm of permissions) {
      if (!THEME_ALLOWED_PERMISSIONS.includes(String(perm))) {
        errors.push('主题不得申请「' + perm + '」（只允许 ' + THEME_ALLOWED_PERMISSIONS.join(' / ') + '）');
      }
    }
  }
  return { errors, warnings };
}

/**
 * theme.json is optional — the host never reads it — but it drives the
 * settings preview, so a malformed one is worth rejecting.
 */
export function buildThemeMeta(meta = {}) {
  const out = { modes: ['light', 'dark'] };
  const accent = validateHexColor(meta.accent, '--accent');
  if (accent) out.accent = accent;
  if (meta.modes) {
    const modes = (Array.isArray(meta.modes) ? meta.modes : String(meta.modes).split(',')).map((m) =>
      String(m).trim(),
    );
    const bad = modes.filter((m) => m !== 'light' && m !== 'dark');
    if (bad.length) throw new Error('modes 只能是 light / dark，收到「' + bad.join(', ') + '」');
    out.modes = modes;
  }
  return out;
}

/**
 * Pull the accent straight out of the CSS so theme.json cannot drift from
 * the palette the user actually sees.
 */
export function accentFromCss(css) {
  const match = /--accent\s*:\s*(#[0-9a-fA-F]{3,6})\s*[;!]/i.exec(css);
  return match ? match[1] : null;
}
