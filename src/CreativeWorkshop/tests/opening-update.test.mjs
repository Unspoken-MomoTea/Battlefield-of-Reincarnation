import assert from 'node:assert/strict';
import test from 'node:test';

import { createOpeningUpdater } from '../services/opening-update.js';

test('opening updater reports the Worker component seam and fixed loader URL', async () => {
  const sha = '0123456789abcdef0123456789abcdef01234567';
  const requests = [];
  const updater = createOpeningUpdater({
    apiBase: 'https://workshop.example/',
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({
        component: 'opening',
        channel: 'testing',
        ref: 'main',
        sha,
        version: '',
        tag: '',
        release_source: 'branch',
        entry_path: '/dist/opening/entry.html',
        source_path: 'dist/opening/entry.html',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  const result = await updater.check();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://workshop.example/api/components/latest?component=opening');
  assert.equal(requests[0].init.cache, 'no-store');
  assert.equal(result.healthy, true);
  assert.equal(result.channel, 'testing');
  assert.equal(result.ref, 'main');
  assert.equal(result.sha, sha);
  assert.equal(result.shortSha, sha.slice(0, 8));
  assert.equal(result.entryPath, '/dist/opening/entry.html');
  assert.equal(result.sourcePath, 'dist/opening/entry.html');
  assert.equal(result.loaderUrl, 'https://workshop.example/opening/latest');
});

test('opening updater surfaces the Worker error instead of inventing a local repair state', async () => {
  const updater = createOpeningUpdater({
    apiBase: 'https://workshop.example',
    fetchImpl: async () => new Response(JSON.stringify({
      code: 'opening_update_check_failed',
      message: 'GitHub request failed: 502',
    }), { status: 502, headers: { 'Content-Type': 'application/json' } }),
  });
  await assert.rejects(() => updater.check(), /GitHub request failed: 502/u);
});

test('opening updater rejects malformed component metadata', async () => {
  const updater = createOpeningUpdater({
    apiBase: 'https://workshop.example',
    fetchImpl: async () => new Response(JSON.stringify({ component: 'opening', sha: 'main' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }),
  });
  await assert.rejects(() => updater.check(), /无效版本/u);
});
