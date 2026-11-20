import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The scaffold's whole promise is that its output loads. Unit tests check the
 * pieces; this one runs the real CLI, builds the real bundle with esbuild and
 * evaluates it the way PluginHost does. Skipped when esbuild is not installed,
 * so the unit suite still runs with no dependencies.
 */
const HERE = fileURLToPath(new URL('..', import.meta.url));
const BIN = join(HERE, 'bin', 'create-vault-plugin.js');

async function esbuildAvailable() {
  try {
    await import('esbuild');
    return true;
  } catch {
    return false;
  }
}

describe('generated plugin', async () => {
  const available = await esbuildAvailable();
  if (!available) {
    it('loads in the host loader (skipped: esbuild not installed — run npm install)', () => {
      assert.ok(true);
    });
    return;
  }

  it('builds and loads as a Plugin subclass the way PluginHost does', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cvp-e2e-'));
    const target = join(dir, 'e2e-demo');
    try {
      execFileSync(process.execPath, [BIN, target, '--name', 'E2E', '--permissions', 'ui:commands,ui:ribbon,ui:settings'], {
        stdio: 'pipe',
      });
      execFileSync(process.execPath, [join(target, 'scripts', 'build.mjs')], { cwd: target, stdio: 'pipe' });

      const source = await readFile(join(target, 'main.js'), 'utf8');
      // Same evaluation as PluginHost.loadCjsPluginClass.
      const records = { cmds: [], ribbons: [], tabs: [] };
      class Plugin {
        constructor(app, manifest) {
          this.app = app;
          this.manifest = manifest;
        }
        addCommand(c) {
          records.cmds.push(c);
        }
        addRibbonIcon(r) {
          records.ribbons.push(r);
        }
        addSettingTab(t) {
          records.tabs.push(t);
        }
      }
      const module = { exports: {} };
      const fn = new Function('Plugin', 'module', 'exports', source + '\n;return module.exports.default || module.exports;');
      const Exported = fn(Plugin, module, module.exports);

      assert.equal(typeof Exported, 'function');
      assert.ok(Exported.prototype instanceof Plugin, 'must extend the host-injected Plugin');

      const notices = [];
      const app = { workspace: { openNotice: (m) => notices.push(m), getActiveFile: () => null } };
      const instance = new Exported(app, { id: 'e2e-demo' });
      await instance.onload();

      assert.deepEqual(records.cmds.map((c) => c.id), ['greet']);
      records.cmds[0].callback();
      assert.deepEqual(notices, ['Hello Vault']);
      assert.deepEqual(records.ribbons.map((r) => r.id), ['ribbon']);
      assert.deepEqual(records.tabs.map((t) => t.id), ['settings']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
