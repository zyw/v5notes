import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createThemePackage, parseThemeArgs } from '../src/cli.js';
import { ruleSelectors, validateThemeCss } from '../src/validate.js';

async function withTemp(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'cvt-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('parseThemeArgs', () => {
  it('derives the id from the directory name', () => {
    const parsed = parseThemeArgs(['/tmp/ink-night', '--name', 'Ink Night']);
    assert.equal(parsed.id, 'ink-night');
    assert.equal(parsed.options.name, 'Ink Night');
  });

  it('rejects a directory name that disagrees with --id', () => {
    assert.throws(() => parseThemeArgs(['/tmp/one', '--id', 'two']), /不一致/);
  });

  it('rejects a builtin theme id', () => {
    assert.throws(() => parseThemeArgs(['/tmp/default']), /内置/);
  });

  it('rejects an unknown mode and a bad accent', () => {
    assert.throws(() => parseThemeArgs(['/tmp/x', '--mode', 'sepia']), /warm 或 cool/);
    assert.throws(() => parseThemeArgs(['/tmp/x', '--accent', 'chartreuse']), /预设/);
  });
});

describe('createThemePackage', () => {
  it('writes a complete, valid theme package', async () => {
    await withTemp(async (dir) => {
      const target = join(dir, 'ink-night');
      const result = await createThemePackage(target, { id: 'ink-night', name: 'Ink Night', accent: 'indigo' });
      assert.equal(result.accent, '#4a5a86');

      const manifest = JSON.parse(await readFile(join(target, 'manifest.json'), 'utf8'));
      assert.equal(manifest.kind, 'theme');
      assert.equal(manifest.id, 'ink-night');

      const css = await readFile(join(target, 'theme.css'), 'utf8');
      assert.equal(validateThemeCss(css, { id: 'ink-night' }).ok, true);
      assert.match(css, /--vault: #[0-9a-f]{6} !important/);
      assert.match(css, /\[data-color-preference='dark'\]/);

      const meta = JSON.parse(await readFile(join(target, 'theme.json'), 'utf8'));
      assert.equal(meta.accent, '#4a5a86');

      const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
      assert.equal(pkg.scripts['install:app'], 'node scripts/install.mjs');
      await readFile(join(target, 'scripts', 'build.mjs'));
      await readFile(join(target, 'scripts', 'install.mjs'));
    });
  });

  it('leaves no template tokens behind', async () => {
    await withTemp(async (dir) => {
      const target = join(dir, 'demo');
      await createThemePackage(target, { id: 'demo', name: 'Demo' });
      for (const rel of ['manifest.json', 'theme.css', 'theme.json', 'scripts/build.mjs']) {
        assert.doesNotMatch(await readFile(join(target, rel), 'utf8'), /\{\{[A-Z0-9_]+\}\}/, rel);
      }
    });
  });

  it('refuses a non-empty target', async () => {
    await withTemp(async (dir) => {
      const target = join(dir, 'demo');
      await createThemePackage(target, { id: 'demo', name: 'Demo' });
      await assert.rejects(createThemePackage(target, { id: 'demo', name: 'Demo' }), /不是空目录/);
    });
  });

  it('scopes every rule to the theme it generated', async () => {
    await withTemp(async (dir) => {
      const target = join(dir, 'demo');
      await createThemePackage(target, { id: 'demo', name: 'Demo' });
      const css = await readFile(join(target, 'theme.css'), 'utf8');
      const selectors = ruleSelectors(css);
      assert.equal(selectors.length, 3);
      for (const selector of selectors) assert.match(selector, /data-community-theme='demo'/);
    });
  });
});
