import assert from 'node:assert/strict';
import test from 'node:test';

import { createWorkshopSelfUpdater } from '../services/self-update.js';

function adapterFixture() {
  const state = {
    character: [{
      type: 'script',
      id: 'workshop-loader',
      name: '轮回战场创意工坊',
      enabled: true,
      content: `(async () => {
  window.ReincarnationWorkshopConfig = {
    apiBase: 'https://workshop-test.6661816.xyz',
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

function githubFetch(sha) {
  return async () => new Response(JSON.stringify({ sha }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('one-click workshop update rewrites only the loader ref and preserves staging config', async () => {
  const adapter = adapterFixture();
  const latest = '0123456789abcdef0123456789abcdef01234567';
  const updater = createWorkshopSelfUpdater({
    adapter,
    fetchImpl: githubFetch(latest),
  });

  const before = await updater.check();
  assert.equal(before.loaderFound, true);
  assert.equal(before.updateAvailable, true);
  assert.equal(
    before.latestImportUrl,
    `https://testingcf.jsdelivr.net/gh/Unspoken-MomoTea/Battlefield-of-Reincarnation@${latest}/src/CreativeWorkshop/index.js`,
  );
  assert.deepEqual(before.refs, ['593cf339818e5ed1c8e2ed363d28e34ff98fa835']);

  const result = await updater.updateLoaderLink();
  assert.equal(result.updated, true);
  assert.equal(result.changedScripts, 1);
  assert.equal(
    result.latestImportUrl,
    `https://testingcf.jsdelivr.net/gh/Unspoken-MomoTea/Battlefield-of-Reincarnation@${latest}/src/CreativeWorkshop/index.js`,
  );

  const content = adapter.state.character[0].content;
  assert.match(content, new RegExp(`@${latest}/src/CreativeWorkshop/index\\.js`, 'u'));
  assert.match(content, /https:\/\/workshop-test\.6661816\.xyz/u);

  const after = await updater.check();
  assert.equal(after.updateAvailable, false);
  assert.deepEqual(after.refs, [latest]);
});


test('self update leaves unrelated loader content untouched', async () => {
  const adapter = adapterFixture();
  adapter.state.character[0].content += `
window.SomeOtherSetting = 'keep-me';
import('https://example.com/another-plugin.js');`;

  const latest = 'abcdefabcdefabcdefabcdefabcdefabcdefabcd';
  const updater = createWorkshopSelfUpdater({
    adapter,
    fetchImpl: githubFetch(latest),
  });

  await updater.updateLoaderLink();
  const content = adapter.state.character[0].content;
  assert.match(content, /SomeOtherSetting = 'keep-me'/u);
  assert.match(content, /https:\/\/example\.com\/another-plugin\.js/u);
  assert.match(content, new RegExp(`@${latest}/src/CreativeWorkshop/index\\.js`, 'u'));
});
