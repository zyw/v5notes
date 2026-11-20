import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scaffold } from '../src/scaffold.js';
import { parseCreateArgs } from '../src/cli.js';

const TEMPLATE = fileURLToPath(new URL('../template', import.meta.url));

async function withTemp(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'cvp-'));
  try {
    await fn(join(dir, 'demo'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const baseOptions = {
  id: 'demo',
  name: 'Demo',
  permissions: ['ui:commands'],
  version: '1.0.0',
  minAppVersion: '0.1.0',
};

describe('scaffold', () => {
  it('writes a loadable package: manifest.json, main.ts, build and install scripts', async () => {
    await withTemp(async (target) => {
      await scaffold(TEMPLATE, target, { ...baseOptions, targetDir: target });
      const manifest = JSON.parse(await readFile(join(target, 'manifest.json'), 'utf8'));
      assert.equal(manifest.id, 'demo');
      assert.equal(manifest.main, 'main.js');
      const source = await readFile(join(target, 'src', 'main.ts'), 'utf8');
      assert.match(source, /class Demo extends Plugin/);
      assert.match(source, /export default Demo;/);
      await readFile(join(target, 'scripts', 'build.mjs'));
      await readFile(join(target, 'scripts', 'install.mjs'));
      const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
      assert.equal(pkg.scripts['install:app'], 'node scripts/install.mjs');
    });
  });

  it('leaves no template tokens in any file', async () => {
    await withTemp(async (target) => {
      await scaffold(TEMPLATE, target, {
        ...baseOptions,
        targetDir: target,
        permissions: ['ui:commands', 'ui:ribbon', 'ui:settings'],
        description: 'desc',
      });
      for (const rel of ['manifest.json', 'src/main.ts', 'scripts/build.mjs', 'scripts/install.mjs', 'package.json']) {
        const text = await readFile(join(target, rel), 'utf8');
        assert.doesNotMatch(text, /\{\{[A-Z0-9_]+\}\}/, rel + ' still has a token');
      }
    });
  });

  it('adds ribbon and settings code only when asked for', async () => {
    await withTemp(async (target) => {
      await scaffold(TEMPLATE, target, { ...baseOptions, targetDir: target });
      const source = await readFile(join(target, 'src', 'main.ts'), 'utf8');
      assert.doesNotMatch(source, /addRibbonIcon/);
      assert.doesNotMatch(source, /addSettingTab/);
    });
    await withTemp(async (target) => {
      await scaffold(TEMPLATE, target, {
        ...baseOptions,
        targetDir: target,
        permissions: ['ui:commands', 'ui:ribbon', 'ui:settings'],
      });
      const source = await readFile(join(target, 'src', 'main.ts'), 'utf8');
      assert.match(source, /addRibbonIcon/);
      assert.match(source, /addSettingTab/);
    });
  });

  it('refuses to write into a non-empty directory', async () => {
    await withTemp(async (target) => {
      await scaffold(TEMPLATE, target, { ...baseOptions, targetDir: target });
      await assert.rejects(
        scaffold(TEMPLATE, target, { ...baseOptions, targetDir: target }),
        /不是空目录/,
      );
    });
  });

  it('refuses a bad id', async () => {
    await withTemp(async (target) => {
      await assert.rejects(
        scaffold(TEMPLATE, target, { ...baseOptions, id: 'Bad_Id', targetDir: target }),
        /不合法/,
      );
    });
  });
});

describe('parseCreateArgs', () => {
  it('derives the id from the directory name', () => {
    const parsed = parseCreateArgs(['/tmp/my-plugin']);
    assert.equal(parsed.id, 'my-plugin');
    assert.deepEqual(parsed.options.permissions, ['ui:commands']);
  });

  it('rejects a directory name that disagrees with --id', () => {
    assert.throws(() => parseCreateArgs(['/tmp/one', '--id', 'two']), /不一致/);
  });

  it('rejects a forbidden permission', () => {
    assert.throws(() => parseCreateArgs(['/tmp/x', '--permissions', 'network']), /network/);
  });

  it('requires an allowlist alongside network:safe', () => {
    assert.throws(() => parseCreateArgs(['/tmp/x', '--permissions', 'network:safe']), /allowlist/);
  });

  it('accepts network:safe with an allowlist and parses flags loosely', () => {
    const parsed = parseCreateArgs([
      '/tmp/fetch-demo',
      '--permissions=ui:commands,network:safe',
      '--allowlist',
      'api.example.com,*.cdn.example.com',
      '--name',
      'Fetch Demo',
    ]);
    assert.deepEqual(parsed.options.permissions, ['ui:commands', 'network:safe']);
    assert.deepEqual(parsed.options.networkAllowlist, ['api.example.com', '*.cdn.example.com']);
    assert.equal(parsed.options.name, 'Fetch Demo');
  });
});
