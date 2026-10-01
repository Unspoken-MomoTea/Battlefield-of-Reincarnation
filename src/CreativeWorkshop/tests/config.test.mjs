import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getUpdateChannel,
  getUpdateRef,
  getWorldEngineUpdateChannel,
  getWorldEngineUpdateRef,
} from '../config.js';

function withConfig(config, fn) {
  const previous = globalThis.window;
  globalThis.window = {
    ReincarnationWorkshopConfig: config,
    parent: null,
  };
  try {
    return fn();
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
}

test('testing workshop stays on main while world engine stays on formal stable by default', () => {
  withConfig({
    apiBase: 'https://workshop-test.6661816.xyz',
    updateChannel: 'testing',
    updateRef: 'main',
  }, () => {
    assert.equal(getUpdateChannel(), 'testing');
    assert.equal(getUpdateRef(), 'main');
    assert.equal(getWorldEngineUpdateChannel(), 'stable');
    assert.equal(getWorldEngineUpdateRef(), 'world-engine-v*');
  });
});

test('world engine testing must be explicitly opted into', () => {
  withConfig({
    apiBase: 'https://workshop-test.6661816.xyz',
    updateChannel: 'testing',
    updateRef: 'main',
    worldEngineUpdateChannel: 'testing',
    worldEngineUpdateRef: 'main',
  }, () => {
    assert.equal(getWorldEngineUpdateChannel(), 'testing');
    assert.equal(getWorldEngineUpdateRef(), 'main');
  });
});
