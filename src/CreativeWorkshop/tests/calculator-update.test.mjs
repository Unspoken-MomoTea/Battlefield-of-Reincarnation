import assert from 'node:assert/strict';
import test from 'node:test';

import { createCalculatorUpdater } from '../services/calculator-update.js';
import {
  buildCalculatorLoaderContent,
  calculatorLoaderRefs,
} from '../services/calculator-loader.js';

function adapterFixture(content) {
  const state = {
    character: [{ type: 'script', id: 'calculator', name: '辅助计算脚本', enabled: true, content }],
    preset: [],
    global: [],
  };
  return {
    state,
    getScriptTrees: async scope => structuredClone(state[scope]),
    replaceScriptTrees: async (trees, scope) => { state[scope] = structuredClone(trees); },
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('calculator loader exposes and rewrites its pinned ref', () => {
  const sha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const content = buildCalculatorLoaderContent(sha, sha);
  assert.deepEqual(calculatorLoaderRefs(content), [sha]);
  assert.match(content, /SamsaraCalculatorLoader/u);
  assert.match(content, /script\/辅助计算脚本\.js/u);
});

test('legacy inline calculator migrates to loader but defers first runtime replacement', async () => {
  const legacy = `(function(){ eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, function(){}); window.__辅助计算脚本_loaded__ = true; })();`;
  const adapter = adapterFixture(legacy);
  const latest = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  let loads = 0;

  const updater = createCalculatorUpdater({
    adapter,
    host: { __辅助计算脚本_loaded__: true },
    channel: 'testing',
    ref: 'main',
    fetchImpl: async url => {
      const value = String(url);
      if (value.includes('/commits?')) return json([{ sha: latest }]);
      throw new Error(`unexpected ${value}`);
    },
    loadScript: async () => { loads += 1; },
  });

  const before = await updater.check();
  assert.equal(before.legacyFound, true);
  assert.equal(before.updateAvailable, true);

  const result = await updater.updateAndReload();
  assert.equal(result.updated, true);
  assert.equal(result.legacyMigration, true);
  assert.equal(result.hotReloaded, false);
  assert.equal(result.reloadRequired, true);
  assert.equal(loads, 0);
  assert.match(adapter.state.character[0].content, new RegExp(`@${latest}/script/辅助计算脚本\\.js`, 'u'));
});

test('managed calculator loader can hot reload a newer testing sha', async () => {
  const old = 'cccccccccccccccccccccccccccccccccccccccc';
  const latest = 'dddddddddddddddddddddddddddddddddddddddd';
  const adapter = adapterFixture(buildCalculatorLoaderContent(old, old));
  const beforeRuntime = { version: '1.0.0', sha: old };
  const host = {
    SamsaraCalculatorRuntime: beforeRuntime,
    Samsara: { CalculatorInfo: { version: '1.0.0', sha: old } },
    SamsaraCalculatorLoader: { ref: old, sha: old },
  };
  let loaded = '';

  const updater = createCalculatorUpdater({
    adapter,
    host,
    channel: 'testing',
    ref: 'main',
    fetchImpl: async url => {
      const value = String(url);
      if (value.includes('/commits?')) return json([{ sha: latest }]);
      if (value.includes('/compare/')) return json({ status: 'behind' });
      throw new Error(`unexpected ${value}`);
    },
    loadScript: async url => {
      loaded = String(url);
      host.SamsaraCalculatorRuntime = { version: '1.0.1', sha: latest };
      host.Samsara.CalculatorInfo = { version: '1.0.1', sha: latest };
    },
  });

  const result = await updater.updateAndReload();
  assert.equal(result.updated, true);
  assert.equal(result.hotReloaded, true);
  assert.equal(result.reloadRequired, false);
  assert.match(loaded, new RegExp(`@${latest}/script/辅助计算脚本\\.js`, 'u'));
  assert.match(adapter.state.character[0].content, new RegExp(`@${latest}/script/辅助计算脚本\\.js`, 'u'));
});

test('stable calculator refuses main when no formal calculator tag exists', async () => {
  const adapter = adapterFixture(buildCalculatorLoaderContent('main'));
  const updater = createCalculatorUpdater({
    adapter,
    host: {},
    channel: 'stable',
    ref: 'calculator-v*',
    fetchImpl: async url => {
      const value = String(url);
      if (value.includes('/api/components/latest')) return json({ code: 'component_release_unavailable' }, 404);
      if (value.includes('/tags?')) return json([]);
      throw new Error(`stable updater must not query main: ${value}`);
    },
    loadScript: async () => {},
  });

  const result = await updater.check();
  assert.equal(result.releaseAvailable, false);
  assert.equal(result.updateAvailable, false);
});

test('stable calculator rewrites a sha loader to the formal calculator tag', async () => {
  const old = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  const latest = 'ffffffffffffffffffffffffffffffffffffffff';
  const adapter = adapterFixture(buildCalculatorLoaderContent(old, old));
  const host = {
    SamsaraCalculatorRuntime: { version: '1.0.0', sha: old },
    Samsara: { CalculatorInfo: { version: '1.0.0', sha: old } },
  };

  const updater = createCalculatorUpdater({
    adapter,
    host,
    channel: 'stable',
    ref: 'calculator-v*',
    fetchImpl: async url => {
      const value = String(url);
      if (value.includes('/api/components/latest')) {
        return json({
          sha: latest,
          channel: 'stable',
          ref: 'calculator-v*',
          version: '1.0.1',
          tag: 'calculator-v1.0.1',
          release_source: 'tag',
        });
      }
      throw new Error(`unexpected ${value}`);
    },
    loadScript: async () => {
      host.SamsaraCalculatorRuntime = { version: '1.0.1', sha: latest };
      host.Samsara.CalculatorInfo = { version: '1.0.1', sha: latest };
    },
  });

  const check = await updater.check();
  assert.equal(check.updateAvailable, true);
  assert.equal(check.latestLoaderRef, 'calculator-v1.0.1');

  const result = await updater.updateAndReload();
  assert.equal(result.hotReloaded, true);
  assert.match(adapter.state.character[0].content, /@calculator-v1\.0\.1\/script\/辅助计算脚本\.js/u);
});
