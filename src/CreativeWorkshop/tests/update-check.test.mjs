import assert from 'node:assert/strict';
import test from 'node:test';

import { createUpdateChecker } from '../services/projects/update-check.js';

function setup({ now = 1_000_000 } = {}) {
  let meta = null;
  let apiCalls = 0;
  const installed = [
    { id: 'a', name: 'A', version: 1 },
    { id: 'b', name: 'B', version: 3 },
  ];
  const checker = createUpdateChecker({
    api: {
      async getProjectVersions(ids) {
        apiCalls += 1;
        assert.deepEqual(ids, ['a', 'b']);
        return { items: [{ id: 'a', version: 2, updated_at: 10 }], unavailable: ['b'] };
      },
    },
    listInstalled: async () => installed,
    getMeta: async () => meta,
    setMeta: async value => { meta = value; },
    now: () => now,
    cooldownMs: 60_000,
  });
  return { checker, apiCalls: () => apiCalls, getMeta: () => meta };
}

test('batch update checker reports updates and unavailable projects in one request', async () => {
  const state = setup();
  const result = await state.checker.checkAll();
  assert.equal(state.apiCalls(), 1);
  assert.equal(result.fromCache, false);
  assert.deepEqual(result.items, [
    { id: 'a', name: 'A', localVersion: 1, remoteVersion: 2, updateAvailable: true, unavailable: false },
    { id: 'b', name: 'B', localVersion: 3, remoteVersion: null, updateAvailable: false, unavailable: true },
  ]);
});

test('batch update checker reuses persistent result during cooldown', async () => {
  const state = setup();
  await state.checker.checkAll();
  const second = await state.checker.checkAll();
  assert.equal(state.apiCalls(), 1);
  assert.equal(second.fromCache, true);
  assert.equal(second.items[0].remoteVersion, 2);
});

test('force bypasses update check cooldown', async () => {
  const state = setup();
  await state.checker.checkAll();
  await state.checker.checkAll(true);
  assert.equal(state.apiCalls(), 2);
});
