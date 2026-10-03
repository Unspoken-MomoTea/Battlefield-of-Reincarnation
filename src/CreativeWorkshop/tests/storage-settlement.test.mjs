import assert from 'node:assert/strict';
import test from 'node:test';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('successful IndexedDB put does not wait forever for a lost transaction completion event', async () => {
  const originalIndexedDB = globalThis.indexedDB;
  const originalBroadcastChannel = globalThis.BroadcastChannel;
  globalThis.BroadcastChannel = undefined;
  let committed = false;
  const fakeDb = {
    objectStoreNames: { contains: () => true },
    close() {},
    transaction() {
      return {
        objectStore() {
          return {
            put(value) {
              const request = {};
              queueMicrotask(() => {
                committed = Boolean(value?.id);
                request.result = value?.id;
                request.onsuccess?.();
              });
              return request;
            },
          };
        },
      };
    },
  };
  globalThis.indexedDB = {
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = fakeDb;
        request.onsuccess?.();
      });
      return request;
    },
  };

  try {
    const storage = await import('../services/storage.js?lost-complete-event');
    const result = await Promise.race([
      storage.putInstalledProject({ id: 'local-test:stall' }).then(() => 'done'),
      delay(800).then(() => 'hung'),
    ]);
    assert.equal(committed, true);
    assert.equal(result, 'done');
  } finally {
    if (originalIndexedDB === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = originalIndexedDB;
    if (originalBroadcastChannel === undefined) delete globalThis.BroadcastChannel;
    else globalThis.BroadcastChannel = originalBroadcastChannel;
  }
});
