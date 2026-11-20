import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCENT_PRESETS, buildPalette, luminance, resolveAccent } from '../src/colors.js';

describe('resolveAccent', () => {
  it('accepts a preset name', () => {
    assert.equal(resolveAccent('indigo'), ACCENT_PRESETS.indigo);
  });

  it('accepts a hex value', () => {
    assert.equal(resolveAccent('#123456'), '#123456');
  });

  it('rejects anything else', () => {
    assert.throws(() => resolveAccent('purple-ish'), /预设/);
  });

  it('picks a stable preset from the id when none was given', () => {
    assert.equal(resolveAccent(undefined, 'abc'), resolveAccent(undefined, 'abc'));
    assert.match(resolveAccent(undefined, 'abc'), /^#[0-9a-f]{6}$/);
  });
});

describe('buildPalette', () => {
  it('produces every token the shell requires, light and dark', () => {
    const { light, dark } = buildPalette('#3d6b54');
    for (const key of ['bg', 'panel', 'ink', 'muted', 'line', 'accent', 'accent-hover', 'surface', 'danger', 'danger-bg']) {
      assert.match(light[key], /^#[0-9a-f]{6}$/, 'light ' + key);
      assert.match(dark[key], /^#[0-9a-f]{6}$/, 'dark ' + key);
    }
  });

  it('keeps light backgrounds light and dark backgrounds dark', () => {
    const { light, dark } = buildPalette('#3d6b54');
    assert.ok(luminance(light.bg) > 0.8);
    assert.ok(luminance(dark.bg) < 0.2);
  });

  it('lightens the accent in dark mode so it stays readable', () => {
    const { light, dark } = buildPalette('#1f2a24');
    assert.ok(luminance(dark.accent) > luminance(light.accent));
  });

  it('supports a cool base', () => {
    const warm = buildPalette('#3d6b54', { warm: true });
    const cool = buildPalette('#3d6b54', { warm: false });
    assert.notEqual(warm.light.bg, cool.light.bg);
  });
});
