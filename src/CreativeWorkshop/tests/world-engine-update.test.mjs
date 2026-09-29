import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorldEngineUpdater } from '../services/world-engine-update.js';

function adapterFixture(content) {
  const state = {
    character: [{ type: 'script', id: 'world-engine', name: '世界推进', enabled: true, content }],
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

test('legacy inline world engine migrates to fixed sha loader and hot reloads when idle', async () => {
  const legacy = `/* 轮回战场 · 世界引擎 */\n(function(){ const host={Samsara:{}}; host.Samsara.worldEngine={}; })();`;
  const adapter = adapterFixture(legacy);
  const latest = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const host = { Samsara: { worldEngine: { version: '1.9.0', busy: false, committing: false } } };
  let loaded = '';
  const updater = createWorldEngineUpdater({
    adapter, host, channel: 'testing', ref: 'main',
    fetchImpl: async url => String(url).includes('/commits?') ? json([{ sha: latest }]) : json({ status: 'behind' }),
    loadScript: async url => {
      loaded = String(url);
      host.Samsara.worldEngine = { version: '2.0.0', busy: false, committing: false };
    },
  });
  const before = await updater.check();
  assert.equal(before.legacyFound, true);
  assert.equal(before.updateAvailable, true);
  const result = await updater.updateAndReload();
  assert.equal(result.updated, true);
  assert.equal(result.hotReloaded, true);
  assert.match(adapter.state.character[0].content, new RegExp(`@${latest}/script/世界推进系统\\.js`, 'u'));
  assert.match(loaded, new RegExp(`@${latest}/script/世界推进系统\\.js`, 'u'));
});

test('busy world engine persists loader update but defers runtime replacement', async () => {
  const old = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const latest = 'cccccccccccccccccccccccccccccccccccccccc';
  const adapter = adapterFixture(`import('https://cdn.jsdelivr.net/gh/Unspoken-MomoTea/Battlefield-of-Reincarnation@${old}/script/世界推进系统.js');`);
  const host = { Samsara: { worldEngine: { version: '2.0.0', busy: true, committing: false } } };
  let loads = 0;
  const updater = createWorldEngineUpdater({
    adapter, host, channel: 'testing', ref: 'main',
    fetchImpl: async url => {
      const value = String(url);
      if (value.includes('/commits?')) return json([{ sha: latest }]);
      if (value.includes('/compare/')) return json({ status: 'behind' });
      throw new Error(`unexpected ${value}`);
    },
    loadScript: async () => { loads += 1; },
  });
  const result = await updater.updateAndReload();
  assert.equal(result.updated, true);
  assert.equal(result.busy, true);
  assert.equal(result.hotReloaded, false);
  assert.equal(result.reloadRequired, true);
  assert.equal(loads, 0);
  assert.match(adapter.state.character[0].content, new RegExp(`@${latest}/script/世界推进系统\\.js`, 'u'));
});

test('stable world engine refuses main when no formal tag exists', async () => {
  const adapter = adapterFixture(`/* 轮回战场 · 世界引擎 */\nconst host={Samsara:{worldEngine:{}}};`);
  const host = { Samsara: { worldEngine: { version: '2.0.0', busy: false, committing: false } } };
  const updater = createWorldEngineUpdater({
    adapter, host, channel: 'stable', ref: 'workshop-stable',
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
