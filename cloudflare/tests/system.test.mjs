import assert from 'node:assert/strict';
import test from 'node:test';

import { routeSystem } from '../src/routes/system.js';

test('client latest endpoint serves cached metadata for the configured stable ref', async () => {
  const sha = '0123456789abcdef0123456789abcdef01234567';
  const env = {
    CLIENT_UPDATE_CHANNEL: 'stable',
    CLIENT_UPDATE_REF: 'workshop-stable',
    SESSION_KV: {
      get: async (key, type) => {
        assert.equal(key, 'public:workshop-client:stable:workshop-stable');
        assert.equal(type, 'json');
        return {
          channel: 'stable',
          ref: 'workshop-stable',
          sha,
          short_sha: sha.slice(0, 8),
          repository: 'Unspoken-MomoTea/Battlefield-of-Reincarnation',
          entry_path: '/src/CreativeWorkshop/index.js',
          checked_at: 1,
        };
      },
      put: async () => {
        throw new Error('cached response should not write');
      },
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
  assert.equal(data.channel, 'stable');
  assert.equal(data.ref, 'workshop-stable');
  assert.equal(data.sha, sha);
  assert.equal(data.cached, true);
});
