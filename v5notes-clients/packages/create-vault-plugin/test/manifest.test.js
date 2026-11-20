import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertBundleIsClean,
  assertCjsExport,
  buildManifest,
  compareSemver,
  findHostApiImports,
  validateManifest,
} from '../src/manifest.js';

const good = {
  id: 'demo',
  name: 'Demo',
  kind: 'plugin',
  version: '1.0.0',
  permissions: ['ui:commands'],
  main: 'main.js',
};

describe('validateManifest', () => {
  it('accepts a well-formed manifest', () => {
    const result = validateManifest(good);
    assert.deepEqual(result.errors, []);
    assert.ok(result.manifest);
  });

  it('rejects an id outside [a-z0-9-]', () => {
    assert.match(validateManifest({ ...good, id: 'Demo_1' }).errors.join(), /id/);
  });

  it('rejects the non-plugin kind', () => {
    assert.match(validateManifest({ ...good, kind: 'theme' }).errors.join(), /kind/);
  });

  it('rejects a forbidden permission', () => {
    const result = validateManifest({ ...good, permissions: ['ui:commands', 'shell'] });
    assert.match(result.errors.join(), /shell/);
  });

  it('rejects a publish:* permission', () => {
    assert.match(validateManifest({ ...good, permissions: ['publish:blog'] }).errors.join(), /publish/);
  });

  it('requires an allowlist for network:safe', () => {
    const result = validateManifest({ ...good, permissions: ['network:safe'] });
    assert.match(result.errors.join(), /networkAllowlist/);
  });

  it('rejects an allowlist entry carrying a scheme or path', () => {
    const result = validateManifest({
      ...good,
      permissions: ['network:safe'],
      networkAllowlist: ['https://api.example.com/v1'],
    });
    assert.match(result.errors.join(), /networkAllowlist/);
  });

  it('rejects publish-like tags', () => {
    assert.match(validateManifest({ ...good, tags: ['publishing'] }).errors.join(), /publishing/);
  });

  it('warns when minAppVersion is ahead of the host', () => {
    const result = validateManifest({ ...good, minAppVersion: '9.0.0' }, { hostVersion: '2.1.0' });
    assert.deepEqual(result.errors, []);
    assert.match(result.warnings.join(), /9\.0\.0/);
  });

  it('warns that ui:status is declared but inert', () => {
    const result = validateManifest({ ...good, permissions: ['ui:status'] });
    assert.deepEqual(result.errors, []);
    assert.match(result.warnings.join(), /ui:status/);
  });

  it('rejects a non-object manifest', () => {
    assert.match(validateManifest('nope').errors.join(), /对象/);
  });
});

describe('buildManifest', () => {
  it('defaults main and version', () => {
    const manifest = buildManifest({ id: 'demo', name: 'Demo', permissions: 'ui:commands' });
    assert.equal(manifest.main, 'main.js');
    assert.equal(manifest.version, '1.0.0');
    assert.equal(manifest.kind, 'plugin');
  });

  it('falls back to a readable name when none was given', () => {
    assert.equal(buildManifest({ id: 'my-notes', permissions: [] }).name, 'My Notes');
  });

  it('adds the allowlist only for network:safe', () => {
    const withNetwork = buildManifest({
      id: 'demo',
      permissions: 'network:safe',
      networkAllowlist: 'api.example.com',
    });
    assert.deepEqual(withNetwork.networkAllowlist, ['api.example.com']);
    const without = buildManifest({ id: 'demo', permissions: 'ui:commands', networkAllowlist: 'x.com' });
    assert.equal(without.networkAllowlist, undefined);
  });

  it('omits empty optional fields', () => {
    const manifest = buildManifest({ id: 'demo', permissions: [] });
    assert.equal('description' in manifest, false);
    assert.equal('author' in manifest, false);
    assert.equal('tags' in manifest, false);
  });
});

describe('bundle checks', () => {
  it('finds a bundled host API import', () => {
    const source = "import { Plugin } from '@v5notes/vault-plugin-api';";
    assert.equal(findHostApiImports(source).length, 1);
    assert.throws(() => assertBundleIsClean(source), /vault-plugin-api/);
  });

  it('accepts a clean bundle', () => {
    assert.doesNotThrow(() => assertBundleIsClean('var X = class extends Plugin {}; module.exports = X;'));
  });

  it('accepts the CJS shape the host evaluates', () => {
    assert.doesNotThrow(() => assertCjsExport('module.exports = MyPlugin;\nvar MyPlugin = class extends Plugin {};'));
    assert.throws(() => assertCjsExport('export default class extends Plugin {}'), /module\.exports/);
  });
});

describe('compareSemver', () => {
  it('orders versions numerically, not lexically', () => {
    assert.ok(compareSemver('2.10.0', '2.9.0') > 0);
    assert.equal(compareSemver('v2.1', '2.1.0'), 0);
  });
});
