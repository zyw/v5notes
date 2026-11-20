/**
 * Turn a single accent colour into a full light/dark palette that reads like
 * the builtin themes: warm neutral surfaces, one accent, muted danger.
 *
 * This is a starting point, not a design system. The generated theme.css is
 * plain text meant to be edited by hand.
 */

export const ACCENT_PRESETS = {
  moss: '#3d6b54',
  indigo: '#4a5a86',
  brick: '#9a4a35',
  plum: '#6b3f63',
  amber: '#8a6420',
  slate: '#3f5568',
};

function toRgb(hex) {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function toHex(rgb) {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

/** Linear blend in sRGB; good enough for a palette draft. */
export function mix(a, b, t) {
  const ca = toRgb(a);
  const cb = toRgb(b);
  return toHex(ca.map((v, i) => v + (cb[i] - v) * t));
}

export function luminance(hex) {
  return toRgb(hex).reduce((sum, v) => sum + v / 255, 0) / 3;
}

/** Lighten or darken until the result is clearly on the other side. */
export function lighten(hex, amount = 0.18) {
  return mix(hex, '#ffffff', amount);
}

export function darken(hex, amount = 0.16) {
  return mix(hex, '#000000', amount);
}

/**
 * @returns {{
 *   light: Record<string, string>,
 *   dark: Record<string, string>,
 * }}
 * Keys are the token names without the leading --.
 */
export function buildPalette(accent, options = {}) {
  const warm = options.warm !== false;
  const base = warm
    ? { paper: '#f6f1e7', wash: '#d9cfbe', night: '#171a21', nightPanel: '#20242d' }
    : { paper: '#eff1f2', wash: '#c9cfd3', night: '#15181b', nightPanel: '#1d2125' };

  const light = {
    bg: base.paper,
    panel: lighten(base.paper, 0.7),
    ink: mix(accent, '#141414', 0.86),
    muted: mix(accent, '#6d6a66', 0.75),
    line: mix(base.wash, '#d8d0c4', 0.5),
    accent,
    'accent-hover': luminance(accent) > 0.6 ? darken(accent, 0.18) : lighten(accent, 0.12),
    surface: mix(base.paper, base.wash, 0.6),
    danger: '#8a3b2e',
    'danger-bg': '#f2e2dc',
    'bg-glow-a': mix(base.paper, accent, 0.08),
    'bg-glow-b': lighten(base.paper, 0.35),
  };

  const darkAccent = mix(accent, '#ffffff', luminance(accent) < 0.35 ? 0.42 : 0.2);
  const dark = {
    bg: base.night,
    panel: base.nightPanel,
    ink: mix(base.paper, '#ffffff', 0.35),
    muted: mix(darkAccent, '#9a97a8', 0.6),
    line: mix(base.nightPanel, '#ffffff', 0.14),
    accent: darkAccent,
    'accent-hover': lighten(darkAccent, 0.18),
    surface: mix(base.night, '#ffffff', 0.1),
    danger: '#e0a090',
    'danger-bg': '#3a2a2a',
    'bg-glow-a': mix(base.night, accent, 0.06),
    'bg-glow-b': base.night,
  };

  return { light, dark };
}

export function resolveAccent(input, hint) {
  if (input) {
    const value = String(input).trim();
    if (ACCENT_PRESETS[value.toLowerCase()]) return ACCENT_PRESETS[value.toLowerCase()];
    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return value;
    throw new Error('--accent 只接受预设名（' + Object.keys(ACCENT_PRESETS).join(' / ') + '）或 #rgb / #rrggbb');
  }
  if (!hint) return ACCENT_PRESETS.moss;
  // Stable pick from the id so two generated themes rarely look identical.
  const names = Object.keys(ACCENT_PRESETS);
  let sum = 0;
  for (const ch of String(hint)) sum += ch.charCodeAt(0);
  return ACCENT_PRESETS[names[sum % names.length]];
}
