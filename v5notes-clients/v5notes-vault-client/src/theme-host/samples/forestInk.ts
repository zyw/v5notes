/** Bundled Forest Ink sample (also mirrored under samples/forest-ink/ for install-to-vault). */

export const FOREST_INK_MANIFEST = {
  id: 'forest-ink',
  name: 'Forest Ink',
  kind: 'theme' as const,
  version: '1.0.0',
  minAppVersion: '0.1.0',
  description: 'Muted green vault theme (Phase 6 sample)',
  author: 'v5notes',
  permissions: ['ui:theme'] as const,
  theme: 'theme.css',
  themeMeta: 'theme.json',
}

export const FOREST_INK_CSS = `/* Forest Ink — sample first-class theme (Phase 6). Only design tokens. */
:root,
:root[data-community-theme='forest-ink'] {
  --bg: #e8f0ea;
  --panel: #f7fbf8;
  --ink: #1e3328;
  --muted: #5f7568;
  --line: #c5d4ca;
  --accent: #3d6b54;
  --accent-hover: #2f5441;
  --surface: #dce8e0;
  --danger: #8a3b2e;
  --danger-bg: #f3e4e0;
  --bg-glow-a: #d2e2d8;
  --bg-glow-b: #e3eee6;
}

:root[data-community-theme='forest-ink'][data-color-mode='dark'] {
  --bg: #141c17;
  --panel: #1c2620;
  --ink: #e2eee6;
  --muted: #8fa498;
  --line: #2e3c34;
  --accent: #6fad8e;
  --accent-hover: #8bc4a6;
  --surface: #243028;
  --danger: #e0a090;
  --danger-bg: #3a2a26;
  --bg-glow-a: #1a241e;
  --bg-glow-b: #15201a;
}
`
