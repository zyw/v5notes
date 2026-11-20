import { accentFromCss, buildThemeManifest, buildThemeMeta } from './manifest.js';
import { renderThemeCss } from './css.js';
import { buildPalette, resolveAccent } from './colors.js';

/** Values consumed by template/theme.css. */
export function themeTemplateValues(options) {
  const palette = buildPalette(resolveAccent(options.accent, options.id), { warm: options.warm !== false });
  return {
    ID: options.id,
    NAME: options.name,
    DESCRIPTION: options.description || '',
    VERSION: options.version || '1.0.0',
    LIGHT_BG: palette.light.bg,
    LIGHT_PANEL: palette.light.panel,
    LIGHT_INK: palette.light.ink,
    LIGHT_MUTED: palette.light.muted,
    LIGHT_LINE: palette.light.line,
    LIGHT_ACCENT: palette.light.accent,
    LIGHT_ACCENT_HOVER: palette.light['accent-hover'],
    LIGHT_SURFACE: palette.light.surface,
    DARK_BG: palette.dark.bg,
    DARK_PANEL: palette.dark.panel,
    DARK_INK: palette.dark.ink,
    DARK_MUTED: palette.dark.muted,
    DARK_LINE: palette.dark.line,
    DARK_ACCENT: palette.dark.accent,
    DARK_ACCENT_HOVER: palette.dark['accent-hover'],
    DARK_SURFACE: palette.dark.surface,
  };
}

/** Same token substitution as the plugin scaffold; unknown tokens survive. */
export function renderTemplate(text, values) {
  return text.replace(/\{\{([A-Z0-9_]+)\}\}/g, (whole, token) => {
    if (!(token in values)) return whole;
    if (values[token] == null) throw new Error('模板变量 ' + token + ' 没有值');
    return String(values[token]);
  });
}

/**
 * Every file of a theme package.
 *
 * The two scripts come from template/scripts/*.mjs and are copied verbatim:
 * they are ordinary files a developer can read and edit, not strings built
 * at runtime (a String.raw blob is one escaping mistake away from a broken
 * regex in the generated project).
 *
 * @param {object} options  { id, name, description, version, accent, warm }
 * @param {{ templateCss: string, buildScript: string, installScript: string }} templates
 */
export function buildThemePackage(options, templates) {
  const accent = resolveAccent(options.accent, options.id);
  const palette = buildPalette(accent, { warm: options.warm !== false });
  const css = templates.templateCss
    ? renderTemplate(templates.templateCss, themeTemplateValues(options))
    : renderThemeCss(options.id, palette);

  const manifest = { ...buildThemeManifest(options) };
  if (options.description) manifest.description = options.description;

  const meta = buildThemeMeta({ accent: accentFromCss(css) || accent, modes: ['light', 'dark'] });

  const packageJson = {
    name: 'vault-theme-' + options.id,
    version: options.version || '1.0.0',
    private: true,
    scripts: {
      build: 'node scripts/build.mjs',
      check: 'node scripts/build.mjs --check',
      'install:app': 'node scripts/install.mjs',
      dev: 'node scripts/build.mjs && node scripts/install.mjs',
    },
  };
  if (options.description) packageJson.description = options.description;

  return {
    accent,
    files: {
      'manifest.json': JSON.stringify(manifest, null, 2) + '\n',
      'theme.css': css,
      // Optional to the host; it lets tooling and the settings preview agree
      // with the CSS instead of guessing.
      'theme.json': JSON.stringify(meta, null, 2) + '\n',
      'package.json': JSON.stringify(packageJson, null, 2) + '\n',
      'scripts/build.mjs': templates.buildScript,
      'scripts/install.mjs': templates.installScript,
      '.gitignore': 'dist/\n',
    },
  };
}
