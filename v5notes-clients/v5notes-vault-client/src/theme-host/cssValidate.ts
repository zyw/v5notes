/**
 * Community theme.css validation (Phase 6 / design §5.6).
 * Not a full CSS parser — deny-list + required design tokens.
 */

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
] as const

export interface CssValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  definedVars: string[]
}

const DANGEROUS_PATTERNS: { re: RegExp; message: string }[] = [
  { re: /@import\b/i, message: '禁止 @import' },
  { re: /expression\s*\(/i, message: '禁止 CSS expression()' },
  { re: /javascript\s*:/i, message: '禁止 javascript: URL' },
  { re: /-moz-binding\s*:/i, message: '禁止 -moz-binding' },
  { re: /behavior\s*:/i, message: '禁止 behavior' },
  { re: /@\s*document\b/i, message: '禁止 @document' },
  { re: /position\s*:\s*fixed\b/i, message: '禁止 position:fixed（可能遮挡安全 UI）' },
  { re: /\*\s*\{[^}]*all\s*:\s*unset/i, message: '禁止通用选择器 all:unset 重置' },
  { re: /url\s*\(\s*['"]?\s*https?:/i, message: '禁止远程 url()' },
]

export function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

export function validateThemeCss(css: string): CssValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const body = stripCssComments(css || '')

  if (!body.trim()) {
    return { ok: false, errors: ['theme.css 为空'], warnings, definedVars: [] }
  }

  for (const rule of DANGEROUS_PATTERNS) {
    if (rule.re.test(body)) errors.push(rule.message)
  }

  // Extremely broad `* { ... }` with display/visibility nukes.
  if (/\*\s*\{[^}]*(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(body)) {
    errors.push('禁止用 * 选择器隐藏全部 UI')
  }

  const definedVars = new Set<string>()
  const varDecl = /(--[a-zA-Z0-9-_]+)\s*:/g
  let m: RegExpExecArray | null
  while ((m = varDecl.exec(body))) {
    definedVars.add(m[1])
  }

  const missing = REQUIRED_CSS_VARS.filter((v) => !definedVars.has(v))
  if (missing.length > REQUIRED_CSS_VARS.length / 2) {
    errors.push(`缺少过多设计 token（至少一半）: ${missing.join(', ')}`)
  } else if (missing.length) {
    warnings.push(`未定义部分 token（将回退内置）: ${missing.join(', ')}`)
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    definedVars: [...definedVars],
  }
}
