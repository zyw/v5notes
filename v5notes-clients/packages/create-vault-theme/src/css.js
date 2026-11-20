/** Render a complete, scoped theme.css from a palette. */

const ORDER = [
  'bg',
  'panel',
  'ink',
  'muted',
  'line',
  'accent',
  'accent-hover',
  'surface',
  'danger',
  'danger-bg',
  'bg-glow-a',
  'bg-glow-b',
];

function block(selector, palette, extra = '') {
  const lines = ORDER.filter((key) => palette[key]).map((key) => '  --' + key + ': ' + palette[key] + ';');
  if (extra) lines.push(extra);
  return selector + ' {\n' + lines.join('\n') + '\n}';
}

/**
 * Three rule blocks, same shape as the bundled samples:
 *
 *   [data-community-theme='<id>']                                  light
 *   [data-community-theme='<id>'][data-color-mode='dark']          dark
 *   [data-community-theme='<id>'][data-color-preference='dark']    dark, when
 *   :not([data-color-mode='dark'])                                 only the
 *                                                                  choice is set
 *
 * The vault colour is written as an INLINE --vault on <html> by the app, and
 * inline styles beat stylesheets — hence !important.
 */
export function renderThemeCss(id, palette) {
  const scope = ":root[data-community-theme='" + id + "']";
  const vault = (p) => '  --vault: ' + (p.accent || '#3d6b54') + ' !important;';
  return [
    '/* ' + id + ' — 只写设计 token。',
    ' * 所有规则都限定到本主题：未限定的 :root 在切换主题后会继续生效。',
    ' * --vault 用 !important，因为应用以行内样式写库色，行内样式优先于样式表。 */',
    block(scope, palette.light, vault(palette.light)),
    block(scope + "[data-color-mode='dark']", palette.dark, vault(palette.dark)),
    block(
      scope + "[data-color-preference='dark']:not([data-color-mode='dark'])",
      palette.dark,
      vault(palette.dark),
    ),
  ].join('\n\n') + '\n';
}
