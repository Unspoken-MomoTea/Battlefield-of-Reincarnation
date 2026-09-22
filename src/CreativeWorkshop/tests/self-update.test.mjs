import assert from 'node:assert/strict';
import test from 'node:test';

import { createWorkshopSelfUpdater } from '../services/self-update.js';

function adapterFixture(apiBase = 'https://workshop-test.6661816.xyz') {
  const state = {
    character: [{
      type: 'script',
      id: 'workshop-loader',
      name: '轮回战场创意工坊',
      enabled: true,
      content: `(async () => {
  window.ReincarnationWorkshopConfig = {
    apiBase: '${apiBase}',
  };
  await import(
    'https://testingcf.jsdelivr.net/gh/Unspoken-MomoTea/Battlefield-of-Reincarnation@593cf339818e5ed1c8e2ed363d28e34ff98fa835/src/CreativeWorkshop/index.js'
  );
})();`,
    }],
    preset: [],
    global: [],
  };
  return {
    state,
    getScriptTrees: async scope => structuredClone(state[scope]),
    replaceScriptTrees: async (trees, scope) => { state[scope] = structuredClone(trees); },
  };
}

function response(sha, extra = {}) {
  return new Response(JSON.stringify({ sha, ...extra }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('testing channel follows main and preserves the staging apiBase', async () => {
  const adapter = adapterFixture();
  const latest = '0123456789abcdef0123456789abcdef01234567';
  const urls = [];
  const updater = createWorkshopSelfUpdater({
    adapter,
    channel: 'testing',
    ref: 'main',
    fetchImpl: async url => {
      urls.push(String(url));
      if (String(url).includes('/api/client/latest')) {
        return response(latest, { channel: 'testing', ref: 'main' });
      }
      return response(latest);
    },
  });

  const before = await updater.check();
  assert.equal(before.loaderFound, true);
  assert.equal(before.updateAvailable, true);
  assert.equal(before.channel, 'testing');
  assert.equal(before.ref, 'main');
  assert.equal(
    before.latestImportUrl,
    `https://cdn.jsdelivr.net/gh/Unspoken-MomoTea/Battlefield-of-Reincarnation@${latest}/src/CreativeWorkshop/index.js`,
  );
  assert.ok(urls.some(url => url.includes('/commits/main')));

  const result = await updater.updateLoaderLink();
  assert.equal(result.updated, true);
  assert.equal(result.changedScripts, 1);
  assert.equal(result.channel, 'testing');
  assert.equal(result.ref, 'main');

  const content = adapter.state.character[0].content;
  assert.match(content, new RegExp(`@${latest}/src/CreativeWorkshop/index\\.js`, 'u'));
  assert.match(content, /https:\/\/workshop-test\.6661816\.xyz/u);

  const after = await updater.check();
  assert.equal(after.updateAvailable, false);
  assert.deepEqual(after.refs, [latest]);
});

test('stable channel follows workshop-stable and never checks main', async () => {
  const adapter = adapterFixture('https://workshop.6661816.xyz');
  const stable = 'abcdefabcdefabcdefabcdefabcdefabcdefabcd';
  const staleWorker = '1111111111111111111111111111111111111111';
  const urls = [];

  const updater = createWorkshopSelfUpdater({
    adapter,
    channel: 'stable',
    ref: 'workshop-stable',
    fetchImpl: async url => {
      const value = String(url);
      urls.push(value);
      if (value.includes('/api/client/latest')) {
        return response(staleWorker, { channel: 'stable', ref: 'workshop-stable' });
      }
      if (value.includes('/commits/workshop-stable')) return response(stable);
      throw new Error(`unexpected request: ${value}`);
    },
  });

  const check = await updater.check();
  assert.equal(check.channel, 'stable');
  assert.equal(check.ref, 'workshop-stable');
  assert.equal(check.latestSha, stable);
  assert.equal(check.updateAvailable, true);
  assert.ok(urls.some(url => url.includes('/commits/workshop-stable')));
  assert.equal(urls.some(url => url.includes('/commits/main')), false);

  await updater.updateLoaderLink();
  assert.match(
    adapter.state.character[0].content,
    new RegExp(`@${stable}/src/CreativeWorkshop/index\\.js`, 'u'),
  );
  assert.equal(urls.some(url => url.includes('/commits/main')), false);
});

test('self update leaves unrelated loader content untouched', async () => {
  const adapter = adapterFixture();
  adapter.state.character[0].content += `
window.SomeOtherSetting = 'keep-me';
import('https://example.com/another-plugin.js');`;

  const latest = 'abcdefabcdefabcdefabcdefabcdefabcdefabcd';
  const updater = createWorkshopSelfUpdater({
    adapter,
    channel: 'testing',
    ref: 'main',
    fetchImpl: async url => String(url).includes('/api/client/latest')
      ? response(latest, { channel: 'testing', ref: 'main' })
      : response(latest),
  });

  await updater.updateLoaderLink();
  const content = adapter.state.character[0].content;
  assert.match(content, /SomeOtherSetting = 'keep-me'/u);
  assert.match(content, /https:\/\/example\.com\/another-plugin\.js/u);
  assert.match(content, new RegExp(`@${latest}/src/CreativeWorkshop/index\\.js`, 'u'));
});

test('mismatched worker metadata falls back to the client channel ref instead of main', async () => {
  const adapter = adapterFixture('https://workshop.6661816.xyz');
  const stable = 'fedcbafedcbafedcbafedcbafedcbafedcbafedc';
  const urls = [];
  const updater = createWorkshopSelfUpdater({
    adapter,
    channel: 'stable',
    ref: 'workshop-stable',
    fetchImpl: async url => {
      const value = String(url);
      urls.push(value);
      if (value.includes('/api/client/latest')) {
        return response('1111111111111111111111111111111111111111', {
          channel: 'testing',
          ref: 'main',
        });
      }
      if (value.includes('/commits/workshop-stable')) return response(stable);
      throw new Error(`unexpected request: ${value}`);
    },
  });

  const check = await updater.check();
  assert.equal(check.latestSha, stable);
  assert.equal(check.channel, 'stable');
  assert.equal(check.ref, 'workshop-stable');
  assert.equal(urls.some(url => url.includes('/commits/main')), false);
});
