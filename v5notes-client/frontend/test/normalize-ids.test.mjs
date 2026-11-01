import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeIds } from '../src/utils/normalizeIds.ts';

test('normalizes nested note, directory and user IDs without changing pagination', () => {
  const response = {
    code: 200,
    total: 2,
    data: {
      id: '1849657039948210177',
      userId: '1849657039948210178',
      dirId: 0,
      roleIds: [1, '1849657039948210180'],
      createDept: 0,
      children: [{ id: '1849657039948210179', pid: 0, type: 2 }]
    },
    rows: [{ id: 1, name: 'note' }]
  };

  assert.deepEqual(normalizeIds(response), {
    code: 200,
    total: 2,
    data: {
      id: '1849657039948210177',
      userId: '1849657039948210178',
      dirId: '0',
      roleIds: ['1', '1849657039948210180'],
      createDept: '0',
      children: [{ id: '1849657039948210179', pid: '0', type: 2 }]
    },
    rows: [{ id: '1', name: 'note' }]
  });
});

test('rejects already imprecise numeric IDs', () => {
  assert.throws(() => normalizeIds({ id: 9007199254740992 }), /unsafe/i);
});
