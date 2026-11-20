import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateThemeCss, cssVariableDeclarations, ruleSelectors } from '../src/validate.js';
import { renderThemeCss } from '../src/css.js';
import { buildPalette } from '../src/colors.js';

const palette = buildPalette('#3d6b54');

describe('validateThemeCss', () => {
  it('accepts the generated stylesheet', () => {
    const result = validateThemeCss(renderThemeCss('demo', palette));
    assert.deepEqual(result.errors, []);
    assert.equal(result.ok, true);
  });

  it('rejects an unscoped :root rule', () => {
    const result = validateThemeCss(":root, :root[data-community-theme='demo'] { --bg: #fff; }");
    assert.equal(result.ok, false);
    assert.match(result.errors.join(), /:root/);
  });

  it('rejects a rule scoped to another theme', () => {
    const css = renderThemeCss('demo', palette).replace(/data-community-theme='demo'/g, "data-community-theme='other'");
    const result = validateThemeCss(css, { id: 'demo' });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(), /没有限定到本主题/);
  });

  const dangerous = [
    ['@import', '@import url("x.css");'],
    ['expression', 'a { width: expression(1); }'],
    ['fixed', 'a { position: fixed; }'],
    ['remote url', 'a { background: url(https://x.test/a.png); }'],
  ];
  for (const [label, snippet] of dangerous) {
    it('rejects ' + label, () => {
      const css = renderThemeCss('demo', palette) + '\n' + snippet + '\n';
      assert.equal(validateThemeCss(css, { id: 'demo' }).ok, false);
    });
  }

  it('rejects a stylesheet hiding everything with *', () => {
    const css = renderThemeCss('demo', palette) + '\n* { display: none; }\n';
    assert.equal(validateThemeCss(css).ok, false);
  });

  it('rejects empty css', () => {
    assert.equal(validateThemeCss('   ').ok, false);
  });

  it('fails when more than half the tokens are missing', () => {
    const css = ":root[data-community-theme='demo'] { --bg: #fff; --accent: #000; }";
    assert.match(validateThemeCss(css, { id: 'demo' }).errors.join(), /token/);
  });

  it('warns when a dark palette is absent', () => {
    const css = ":root[data-community-theme='demo'] { --bg: #fff; --panel: #fff; --ink: #000; --muted: #777; --line: #ddd; --accent: #3d6b54; --accent-hover: #2f5441; --surface: #eee; --danger: #a00; --danger-bg: #fee; }";
    const result = validateThemeCss(css, { id: 'demo' });
    assert.equal(result.ok, true);
    assert.match(result.warnings.join(), /深色/);
  });
});

describe('ruleSelectors', () => {
  it('lists selectors without the comment header', () => {
    const source = '/* c */\n:root[a] { --bg: #fff; }\n:root[b] { --ink: #000; }';
    assert.deepEqual(ruleSelectors(source), [':root[a]', ':root[b]']);
  });
});

describe('cssVariableDeclarations', () => {
  it('reads token values', () => {
    const vars = cssVariableDeclarations(':root { --bg: #fff; --accent: #3d6b54; }');
    assert.equal(vars.get('--bg'), '#fff');
    assert.equal(vars.get('--accent'), '#3d6b54');
  });
});
