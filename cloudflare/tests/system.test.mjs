import assert from 'node:assert/strict';
import test from 'node:test';

import { routeSystem } from '../src/routes/system.js';

test('client latest endpoint serves cached main commit metadata', async () => {
  const sha = '0123456789abcdef0123456789abcdef01234567';
  const env = {
    SESSION_KV: {
      get: async (key, type) => {
        assert.equal(key, 'public:workshop-client-main');
        assert.equal(type, 'json');
        return {
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
  assert.equal(data.sha, sha);
  assert.equal(data.cached, true);
});
