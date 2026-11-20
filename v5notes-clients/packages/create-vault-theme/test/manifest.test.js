import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  accentFromCss,
  buildThemeManifest,
  buildThemeMeta,
  validateThemeManifest,
} from '../src/manifest.js';

const good = {
  id: 'demo',
  name: 'Demo',
  kind: 'theme',
  version: '1.0.0',
  permissions: ['ui:theme'],
  theme: 'theme.css',
  themeMeta: 'theme.json',
};

describe('buildThemeManifest', () => {
  it('produces a manifest the host accepts as a theme', () => {
    const manifest = buildThemeManifest({ id: 'demo', name: 'Demo' });
    assert.equal(manifest.kind, 'theme');
    assert.equal(manifest.theme, 'theme.css');
    assert.equal(manifest.themeMeta, 'theme.json');
    assert.deepEqual(manifest.permissions, ['ui:theme']);
    assert.equal('main' in manifest, false);
  });
});

describe('validateThemeManifest', () => {
  it('accepts a well-formed theme manifest', () => {
    assert.deepEqual(validateThemeManifest(good).errors, []);
  });

  it('rejects kind: plugin', () => {
    assert.match(validateThemeManifest({ ...good, kind: 'plugin' }).errors.join(), /kind/);
  });

  it('rejects a builtin id the host resolves first', () => {
    assert.match(validateThemeManifest({ ...good, id: 'default' }).errors.join(), /内置/);
    assert.match(validateThemeManifest({ ...good, id: 'dusk' }).errors.join(), /内置/);
  });

  it('rejects vault, network and editor permissions', () => {
    for (const perm of ['vault:write', 'network:safe', 'editor:provide', 'ui:theme-all']) {
      assert.match(validateThemeManifest({ ...good, permissions: [perm] }).errors.join(), new RegExp(perm.split(':')[0]));
    }
  });

  it('rejects a main entry', () => {
    assert.match(validateThemeManifest({ ...good, main: 'main.js' }).errors.join(), /main/);
  });

  it('rejects a renamed css entry', () => {
    assert.match(validateThemeManifest({ ...good, theme: 'style.css' }).errors.join(), /theme\.css/);
  });
});

describe('buildThemeMeta', () => {
  it('defaults to both modes and derives the accent', () => {
    const meta = buildThemeMeta({ accent: '#3d6b54' });
    assert.deepEqual(meta.modes, ['light', 'dark']);
    assert.equal(meta.accent, '#3d6b54');
  });

  it('rejects a malformed accent', () => {
    assert.throws(() => buildThemeMeta({ accent: 'green' }), /颜色/);
  });

  it('rejects an unknown mode', () => {
    assert.throws(() => buildThemeMeta({ modes: ['sepia'] }), /light \/ dark/);
  });
});

describe('accentFromCss', () => {
  it('reads the accent so theme.json cannot drift from the css', () => {
    assert.equal(accentFromCss(':root[x] { --accent: #4a5a86; }'), '#4a5a86');
    assert.equal(accentFromCss(':root[x] { --accent: #4a5a86 !important; }'), '#4a5a86');
    assert.equal(accentFromCss(':root[x] { --bg: #fff; }'), null);
  });
});
