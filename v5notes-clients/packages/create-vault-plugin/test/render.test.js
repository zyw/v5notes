import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyConditionals, renderTemplate, surfaceFlags, templateValues } from '../src/render.js';

describe('renderTemplate', () => {
  it('replaces known tokens', () => {
    assert.equal(renderTemplate('Hi {{NAME}}!', { NAME: 'A' }), 'Hi A!');
  });

  it('leaves unknown tokens alone so plugin code survives', () => {
    assert.equal(renderTemplate('{{NOT_A_TOKEN}}', { NAME: 'A' }), '{{NOT_A_TOKEN}}');
  });

  it('throws on a known token with no value instead of writing blanks', () => {
    assert.throws(() => renderTemplate('{{NAME}}', { NAME: null }), /NAME/);
  });
});

describe('applyConditionals', () => {
  it('keeps a block whose flag is on', () => {
    assert.equal(applyConditionals('a{{#X}}b{{/X}}c', { X: true }), 'abc');
  });

  it('drops a block whose flag is off', () => {
    assert.equal(applyConditionals('a{{#X}}b{{/X}}c', { X: false }), 'ac');
  });

  it('refuses an unclosed block', () => {
    assert.throws(() => applyConditionals('{{#X}}b', { X: true }), /未闭合/);
  });

  it('leaves no stray blank line above a closing brace', () => {
    const out = applyConditionals('  });\n{{#X}}\n  extra();\n{{/X}}\n}\n', { X: false });
    assert.equal(out, '  });\n}\n');
  });
});

describe('surfaceFlags', () => {
  it('turns ribbon, settings and network on from permissions', () => {
    const flags = surfaceFlags({ permissions: ['ui:commands', 'ui:ribbon', 'ui:settings', 'network:safe'] });
    assert.equal(flags.RIBBON, true);
    assert.equal(flags.SETTINGS, true);
    assert.equal(flags.NETWORK, true);
  });

  it('keeps a commands-only plugin free of ribbon and settings code', () => {
    const flags = surfaceFlags({ permissions: ['ui:commands'] });
    assert.equal(flags.RIBBON, false);
    assert.equal(flags.SETTINGS, false);
    assert.equal(flags.NETWORK, false);
  });

  it('marks an empty description so package.json skips the field', () => {
    assert.equal(surfaceFlags({ permissions: ['ui:commands'], description: 'x' }).DESCRIPTION, true);
    assert.equal(surfaceFlags({ permissions: ['ui:commands'] }).DESCRIPTION, false);
  });
});

describe('templateValues', () => {
  it('derives class and display name from the id', () => {
    const values = templateValues({ id: 'my-notes', permissions: ['ui:commands'] });
    assert.equal(values.CLASS, 'MyNotes');
    assert.equal(values.NAME, 'My Notes');
  });

  it('serialises permissions for the manifest', () => {
    const values = templateValues({ id: 'x', permissions: ['ui:commands', 'vault:read'] });
    assert.deepEqual(JSON.parse(values.PERMISSIONS_JSON), ['ui:commands', 'vault:read']);
  });
});
