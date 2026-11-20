import { parseList } from './capabilities.js';
import { toDisplayName, toPascalCase } from './naming.js';

/**
 * Replace {{TOKEN}} placeholders. Unknown tokens are left alone — build
 * scripts and the plugin's own template literals must survive untouched —
 * while a known token with no value throws, so a half-filled file never
 * reaches disk.
 */
export function renderTemplate(text, values) {
  return text.replace(/\{\{([A-Z0-9_]+)\}\}/g, (whole, token) => {
    if (!(token in values)) return whole;
    const value = values[token];
    if (value == null) throw new Error('模板变量 ' + token + ' 没有值');
    return String(value);
  });
}

/** Every token the template folder is allowed to use. */
export function templateValues(options) {
  const permissions = parseList(options.permissions);
  const allowlist = parseList(options.networkAllowlist);
  return {
    ID: options.id,
    CLASS: toPascalCase(options.id),
    NAME: options.name || toDisplayName(options.id),
    VERSION: options.version || '1.0.0',
    MIN_APP_VERSION: options.minAppVersion || '0.1.0',
    AUTHOR: options.author || '',
    DESCRIPTION: options.description || '',
    PERMISSIONS_JSON: JSON.stringify(permissions),
    PERMISSIONS_TOKENS: permissions.map((p) => "'" + p + "'").join(', '),
    NETWORK_ALLOWLIST_JSON: allowlist.length ? JSON.stringify(allowlist) : 'null',
  };
}

/**
 * Commands are fixed; optional surfaces follow the permissions the user
 * asked for, so a ui:commands-only plugin never carries dead ribbon code.
 */
export function surfaceFlags(options) {
  const permissions = parseList(options.permissions);
  return {
    RIBBON: permissions.includes('ui:ribbon'),
    SETTINGS: permissions.includes('ui:settings'),
    NETWORK: permissions.includes('network:safe'),
    DESCRIPTION: Boolean(String(options.description ?? '').trim()),
  };
}

/**
 * Strip a {{#IF_TOKEN}} ... {{/IF_TOKEN}} block whose flag is false, then drop
 * the markers of the blocks that stayed.
 */
export function applyConditionals(text, flags) {
  let out = text;
  for (const [key, enabled] of Object.entries(flags)) {
    const re = new RegExp('\\{\\{#' + key + '\\}\\}([\\s\\S]*?)\\{\\{/' + key + '\\}\\}', 'g');
    out = out.replace(re, (_whole, body) => (enabled ? body : ''));
  }
  const leftover = out.match(/\{\{[#/][A-Z0-9_]+\}\}/g);
  if (leftover) throw new Error('模板里有未闭合的条件块：' + leftover.join(' '));
  // A dropped block leaves its own line's blank line behind; two in a row
  // inside a function body read as an accident, because they are one.
  out = out.replace(/^[ \t]*\n([ \t]*\n)+(?=[ \t]*\n)/gm, '').replace(/\n[ \t]*\n([ \t]*\n)+/g, '\n\n');
  return out.replace(/\n[ \t]*\n([ \t]*\})/g, '\n$1');
}
