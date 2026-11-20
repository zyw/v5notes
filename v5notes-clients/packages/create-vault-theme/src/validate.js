/**
 * Theme CSS validation, mirrored from
 * v5notes-vault-client/src/theme-host/cssValidate.ts.
 *
 * The host runs the same checks when a theme is selected and silently falls
 * back to 默认 on failure. Running them here turns "外观没变化" into a named
 * error in the terminal that produced the file.
 */

/** Tokens the shell reads; a theme leaving too many out falls back per-token. */
export const REQUIRED_CSS_VARS = [
  '--bg',
  '--panel',
  '--ink',
  '--muted',
  '--line',
  '--accent',
  '--accent-hover',
  '--surface',
  '--danger',
  '--danger-bg',
];

const DANGEROUS_PATTERNS = [
  { re: /@import\b/i, message: '禁止 @import（主题不能加载外部样式表）' },
  { re: /expression\s*\(/i, message: '禁止 CSS expression()' },
  { re: /javascript\s*:/i, message: '禁止 javascript: URL' },
  { re: /-moz-binding\s*:/i, message: '禁止 -moz-binding' },
  { re: /behavior\s*:/i, message: '禁止 behavior' },
  { re: /@\s*document\b/i, message: '禁止 @document' },
  { re: /position\s*:\s*fixed\b/i, message: '禁止 position:fixed（可能遮挡安全 UI）' },
  { re: /\*\s*\{[^}]*all\s*:\s*unset/i, message: '禁止通用选择器 all:unset 重置' },
  { re: /url\s*\(\s*['"]?\s*https?:/i, message: '禁止远程 url()' },
];

export function stripCssComments(css) {
  return String(css ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Every selector that opens a rule block. */
export function ruleSelectors(css) {
  const body = stripCssComments(css);
  return [...body.matchAll(/([^{}]+)\{/g)]
    .map((m) => m[1].trim())
    .filter((selector) => selector && !selector.startsWith('@'));
}

/**
 * @param {string} css
 * @param {{ id?: string }} options  when given, every rule must be scoped to it
 */
export function validateThemeCss(css, options = {}) {
  const errors = [];
  const warnings = [];
  const body = stripCssComments(css);

  if (!body.trim()) {
    return { ok: false, errors: ['theme.css 为空'], warnings, definedVars: [] };
  }

  for (const rule of DANGEROUS_PATTERNS) {
    if (rule.re.test(body)) errors.push(rule.message);
  }

  if (/\*\s*\{[^}]*(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(body)) {
    errors.push('禁止用 * 选择器隐藏全部 UI');
  }

  // A bare :root rule leaks its palette into every other theme: the injected
  // stylesheet outlives the switch, so "换主题好像没生效".
  if (/(?:^|[},])\s*:root\s*(?=[,{])/i.test(body)) {
    const hint = options.id
      ? ":root[data-community-theme='" + options.id + "']"
      : ":root[data-community-theme='<id>']";
    errors.push('以 :root 开头的规则必须限定到本主题，例如 ' + hint);
  }

  if (options.id) {
    const scope = "data-community-theme='" + options.id + "'";
    for (const selector of ruleSelectors(body)) {
      if (!selector.includes(scope)) {
        errors.push('规则没有限定到本主题：' + selector.slice(0, 60));
      }
    }
  }

  const definedVars = new Set();
  let match;
  const varDecl = /(--[a-zA-Z0-9-_]+)\s*:/g;
  while ((match = varDecl.exec(body))) definedVars.add(match[1]);

  const missing = REQUIRED_CSS_VARS.filter((v) => !definedVars.has(v));
  if (missing.length > REQUIRED_CSS_VARS.length / 2) {
    errors.push('缺少过多设计 token（至少一半）：' + missing.join(', '));
  } else if (missing.length) {
    warnings.push('未定义部分 token（将回退内置）：' + missing.join(', '));
  }

  if (options.id) {
    const scope = "data-community-theme='" + options.id + "'";
    if (!new RegExp(scope.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\]\\[data-color-mode='dark'\\]").test(body)) {
      warnings.push('没有深色palette（[data-color-mode=\'dark\']），切到深色时主题不会变');
    }
  }

  return { ok: errors.length === 0, errors, warnings, definedVars: [...definedVars] };
}

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Colours in theme.json are only read for display; keep them well-formed. */
export function validateHexColor(value, field) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!HEX_RE.test(text)) {
    throw new Error(field + ' 必须是 #rgb 或 #rrggbb 颜色，收到「' + text + '」');
  }
  return text;
}

/** Non-property declarations, for the token-only check in the build script. */
export function cssVariableDeclarations(css) {
  const body = stripCssComments(css);
  const out = new Map();
  let match;
  const re = /(--[a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g;
  while ((match = re.exec(body))) out.set(match[1], match[2].trim());
  return out;
}
