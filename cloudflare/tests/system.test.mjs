import assert from 'node:assert/strict';
import test from 'node:test';
import { routeSystem } from '../src/routes/system.js';

test('client latest endpoint serves cached component metadata', async () => {
  const sha = '0123456789abcdef0123456789abcdef01234567';
  const env = {
    CLIENT_UPDATE_CHANNEL: 'stable',
    CLIENT_UPDATE_REF: 'workshop-stable',
    SESSION_KV: {
      get: async (key, type) => {
        assert.equal(key, 'public:core-component:v2:workshop:stable:workshop-stable');
        assert.equal(type, 'json');
        return {
          component: 'workshop',
          channel: 'stable',
          ref: 'workshop-stable',
          sha,
          short_sha: sha.slice(0, 8),
          version: '1.20.1',
          tag: 'workshop-v1.20.1',
          release_source: 'tag',
        };
      },
      put: async () => { throw new Error('cached response should not write'); },
    },
  };
  const response = await routeSystem(
    new Request('https://workshop.example/api/client/latest'),
    env,
    '/api/client/latest',
    'test',
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.sha, sha);
  assert.equal(data.tag, 'workshop-v1.20.1');
  assert.equal(data.cached, true);
});

test('world engine endpoint reports missing formal tag without falling back to main', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.match(String(url), /\/tags\?per_page=100/u);
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const response = await routeSystem(
      new Request('https://workshop.example/api/components/latest?component=world-engine'),
      {
        CLIENT_UPDATE_CHANNEL: 'stable',
        CLIENT_UPDATE_REF: 'workshop-stable',
        SESSION_KV: { get: async () => null, put: async () => {} },
      },
      '/api/components/latest',
      'test',
    );
    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, 'component_release_unavailable');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
