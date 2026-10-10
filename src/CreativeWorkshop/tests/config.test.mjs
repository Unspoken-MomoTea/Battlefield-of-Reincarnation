import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getUpdateChannel,
  getUpdateRef,
  isMarketEnabled,
  getWorldEngineUpdateChannel,
  getWorldEngineUpdateRef,
  getStatusBarUpdateChannel,
  getStatusBarUpdateRef,
  getCalculatorUpdateChannel,
  getCalculatorUpdateRef,
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
    assert.equal(getStatusBarUpdateChannel(), 'stable');
    assert.equal(getStatusBarUpdateRef(), 'status-bar-v*');
    assert.equal(getCalculatorUpdateChannel(), 'stable');
    assert.equal(getCalculatorUpdateRef(), 'calculator-v*');
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


test('status bar testing must be explicitly opted into', () => {
  withConfig({
    apiBase: 'https://workshop-test.6661816.xyz',
    updateChannel: 'testing',
    updateRef: 'main',
    statusBarUpdateChannel: 'testing',
    statusBarUpdateRef: 'main',
  }, () => {
    assert.equal(getStatusBarUpdateChannel(), 'testing');
    assert.equal(getStatusBarUpdateRef(), 'main');
  });
});


test('calculator testing must be explicitly opted into', () => {
  withConfig({
    apiBase: 'https://workshop-test.6661816.xyz',
    updateChannel: 'testing',
    updateRef: 'main',
    calculatorUpdateChannel: 'testing',
    calculatorUpdateRef: 'main',
  }, () => {
    assert.equal(getCalculatorUpdateChannel(), 'testing');
    assert.equal(getCalculatorUpdateRef(), 'main');
  });
});

test('Bazaar navigation is visible on both stable and testing workshop channels', () => {
  withConfig({ apiBase:'https://workshop.6661816.xyz', updateChannel:'stable' },
    () => assert.equal(isMarketEnabled(),true));
  withConfig({ apiBase:'https://workshop-test.6661816.xyz', updateChannel:'testing' },
    () => assert.equal(isMarketEnabled(),true));
  assert.equal(isMarketEnabled('unknown'),false);
});
