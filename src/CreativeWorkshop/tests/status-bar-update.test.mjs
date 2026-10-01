import assert from 'node:assert/strict';
import test from 'node:test';

import { createStatusBarUpdater } from '../services/status-bar-update.js';
import {
  buildStatusBarLoaderContent,
  statusBarLoaderRefs,
} from '../services/status-bar-loader.js';

function adapterFixture(content) {
  const state = {
    character: [{ type: 'script', id: 'status-bar', name: '悬浮球状态栏', enabled: true, content }],
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

test('status bar loader exposes and rewrites its pinned ref', () => {
  const sha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const content = buildStatusBarLoaderContent(sha, sha);
  assert.deepEqual(statusBarLoaderRefs(content), [sha]);
  assert.match(content, /SamsaraStatusBarLoader/u);
  assert.match(content, /script\/悬浮球状态栏\.js/u);
});

test('legacy inline status bar migrates to loader but defers first runtime replacement', async () => {
  const legacy = `/* [轮回空间] 主神终端系统 UI */\n(function(){ window.__悬浮球状态栏_loaded__ = true; })();`;
  const adapter = adapterFixture(legacy);
  const latest = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  let loads = 0;

  const updater = createStatusBarUpdater({
    adapter,
    host: { __悬浮球状态栏_loaded__: true },
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
  assert.match(adapter.state.character[0].content, new RegExp(`@${latest}/script/悬浮球状态栏\\.js`, 'u'));
});

test('managed status bar loader can hot reload a newer testing sha', async () => {
  const old = 'cccccccccccccccccccccccccccccccccccccccc';
  const latest = 'dddddddddddddddddddddddddddddddddddddddd';
  const adapter = adapterFixture(buildStatusBarLoaderContent(old, old));
  const beforeRuntime = { version: '1.0.0', sha: old };
  const host = {
    SamsaraStatusBarRuntime: beforeRuntime,
    Samsara: { StatusBarInfo: { version: '1.0.0', sha: old } },
    SamsaraStatusBarLoader: { ref: old, sha: old },
  };
  let loaded = '';

  const updater = createStatusBarUpdater({
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
      host.SamsaraStatusBarRuntime = { version: '1.0.1', sha: latest };
      host.Samsara.StatusBarInfo = { version: '1.0.1', sha: latest };
    },
  });

  const result = await updater.updateAndReload();
  assert.equal(result.updated, true);
  assert.equal(result.hotReloaded, true);
  assert.equal(result.reloadRequired, false);
  assert.match(loaded, new RegExp(`@${latest}/script/悬浮球状态栏\\.js`, 'u'));
  assert.match(adapter.state.character[0].content, new RegExp(`@${latest}/script/悬浮球状态栏\\.js`, 'u'));
});

test('stable status bar refuses main when no formal status-bar tag exists', async () => {
  const adapter = adapterFixture(buildStatusBarLoaderContent('main'));
  const updater = createStatusBarUpdater({
    adapter,
    host: {},
    channel: 'stable',
    ref: 'status-bar-v*',
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

test('stable status bar rewrites a sha loader to the formal status-bar tag', async () => {
  const old = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  const latest = 'ffffffffffffffffffffffffffffffffffffffff';
  const adapter = adapterFixture(buildStatusBarLoaderContent(old, old));
  const host = {
    SamsaraStatusBarRuntime: { version: '1.0.0', sha: old },
    Samsara: { StatusBarInfo: { version: '1.0.0', sha: old } },
  };

  const updater = createStatusBarUpdater({
    adapter,
    host,
    channel: 'stable',
    ref: 'status-bar-v*',
    fetchImpl: async url => {
      const value = String(url);
      if (value.includes('/api/components/latest')) {
        return json({
          sha: latest,
          channel: 'stable',
          ref: 'status-bar-v*',
          version: '1.0.1',
          tag: 'status-bar-v1.0.1',
          release_source: 'tag',
        });
      }
      throw new Error(`unexpected ${value}`);
    },
    loadScript: async () => {
      host.SamsaraStatusBarRuntime = { version: '1.0.1', sha: latest };
      host.Samsara.StatusBarInfo = { version: '1.0.1', sha: latest };
    },
  });

  const check = await updater.check();
  assert.equal(check.updateAvailable, true);
  assert.equal(check.latestLoaderRef, 'status-bar-v1.0.1');

  const result = await updater.updateAndReload();
  assert.equal(result.hotReloaded, true);
  assert.match(adapter.state.character[0].content, /@status-bar-v1\.0\.1\/script\/悬浮球状态栏\.js/u);
});
