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
        assert.equal(key, 'public:core-component:v4:workshop:stable:workshop-stable');
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

test('client latest survives a transient KV read failure when GitHub is available', async () => {
  const originalFetch = globalThis.fetch;
  const stableSha = 'abababababababababababababababababababab';
  globalThis.fetch = async url => {
    const value = String(url);
    if (value.includes('/tags?')) {
      return new Response(JSON.stringify([
        { name: 'workshop-v2.0.16', commit: { sha: stableSha } },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (value.includes('/commits/workshop-stable')) {
      return new Response(JSON.stringify({ sha: stableSha }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error(`unexpected request: ${value}`);
  };

  try {
    const response = await routeSystem(
      new Request('https://workshop.example/api/client/latest'),
      {
        CLIENT_UPDATE_CHANNEL: 'stable',
        CLIENT_UPDATE_REF: 'workshop-stable',
        SESSION_KV: {
          get: async () => { throw new Error('KV temporarily unavailable'); },
          put: async () => {},
        },
      },
      '/api/client/latest',
      'test',
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.sha, stableSha);
    assert.equal(body.tag, 'workshop-v2.0.16');
    assert.equal(body.release_source, 'tag');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('client latest does not downgrade a formal stable release to a bare sha when GitHub tag lookup is unavailable', async () => {
  const originalFetch = globalThis.fetch;
  const stableSha = 'efefefefefefefefefefefefefefefefefefefef';
  globalThis.fetch = async url => {
    const value = String(url);
    if (value.startsWith('https://api.github.com/')) {
      return new Response('bad gateway', { status: 502 });
    }
    if (value === 'https://github.com/Unspoken-MomoTea/Battlefield-of-Reincarnation/commits/workshop-stable.atom') {
      return new Response(
        `<?xml version="1.0"?><feed><entry><link href="https://github.com/Unspoken-MomoTea/Battlefield-of-Reincarnation/commit/${stableSha}"/></entry></feed>`,
        { status: 200, headers: { 'Content-Type': 'application/atom+xml' } },
      );
    }
    throw new Error(`unexpected request: ${value}`);
  };

  try {
    const response = await routeSystem(
      new Request('https://workshop.example/api/client/latest'),
      {
        CLIENT_UPDATE_CHANNEL: 'stable',
        CLIENT_UPDATE_REF: 'workshop-stable',
        SESSION_KV: { get: async () => null, put: async () => {} },
      },
      '/api/client/latest',
      'test',
    );
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.code, 'component_release_pending');
  } finally {
    globalThis.fetch = originalFetch;
  }
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


test('opening latest redirects to an immutable main sha with no-cache headers', async () => {
  const originalFetch = globalThis.fetch;
  const sha = '89abcdef0123456789abcdef0123456789abcdef';
  const writes = [];
  globalThis.fetch = async url => {
    const value = String(url);
    assert.match(value, /\/commits\?sha=main&path=dist%2Fopening%2Fentry.html&per_page=1/u);
    return new Response(JSON.stringify([{ sha }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const response = await routeSystem(
      new Request('https://workshop.6661816.xyz/opening/latest'),
      {
        CLIENT_UPDATE_CHANNEL: 'stable',
        CLIENT_UPDATE_REF: 'workshop-stable',
        OPENING_UPDATE_CHANNEL: 'testing',
        OPENING_UPDATE_REF: 'main',
        SESSION_KV: {
          get: async () => null,
          put: async (key, value, options) => writes.push({ key, value, options }),
        },
      },
      '/opening/latest',
      'test',
    );
    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get('location'),
      `https://cdn.jsdelivr.net/gh/Unspoken-MomoTea/Battlefield-of-Reincarnation@${sha}/dist/opening/entry.html?v=${sha.slice(0, 12)}`,
    );
    assert.match(response.headers.get('cache-control') || '', /no-store/u);
    assert.equal(response.headers.get('x-opening-channel'), 'testing');
    assert.equal(response.headers.get('x-opening-ref'), 'main');
    assert.equal(response.headers.get('x-opening-sha'), sha);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].key, 'public:core-component:last-known:v2:opening:testing:main');
    assert.equal(writes[0].options, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('opening latest falls back to GitHub Atom when the commits API returns 502', async () => {
  const originalFetch = globalThis.fetch;
  const sha = 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd';
  globalThis.fetch = async url => {
    const value = String(url);
    if (value.includes('api.github.com/repos/') && value.includes('/commits?')) {
      return new Response('bad gateway', { status: 502 });
    }
    if (value === 'https://github.com/Unspoken-MomoTea/Battlefield-of-Reincarnation/commits/main.atom') {
      return new Response(
        `<?xml version="1.0"?><feed><entry><link href="https://github.com/Unspoken-MomoTea/Battlefield-of-Reincarnation/commit/${sha}"/></entry></feed>`,
        { status: 200, headers: { 'Content-Type': 'application/atom+xml' } },
      );
    }
    throw new Error(`unexpected request: ${value}`);
  };

  try {
    const response = await routeSystem(
      new Request('https://workshop.6661816.xyz/opening/latest'),
      {
        OPENING_UPDATE_CHANNEL: 'testing',
        OPENING_UPDATE_REF: 'main',
        SESSION_KV: { get: async () => null, put: async () => {} },
      },
      '/opening/latest',
      'test',
    );
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('x-opening-sha'), sha);
    assert.match(response.headers.get('location') || '', new RegExp('@' + sha + '/dist/opening/entry\\.html'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('status bar endpoint uses only status-bar tags on stable channel', async () => {
  const originalFetch = globalThis.fetch;
  const statusSha = '1212121212121212121212121212121212121212';
  globalThis.fetch = async url => {
    const value = String(url);
    if (value.includes('/tags?')) {
      return new Response(JSON.stringify([
        { name: 'workshop-v9.9.9', commit: { sha: '3434343434343434343434343434343434343434' } },
        { name: 'world-engine-v9.9.9', commit: { sha: '5656565656565656565656565656565656565656' } },
        { name: 'status-bar-v1.0.0', commit: { sha: statusSha } },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error(`unexpected request: ${value}`);
  };
  try {
    const response = await routeSystem(
      new Request('https://workshop.example/api/components/latest?component=status-bar'),
      {
        CLIENT_UPDATE_CHANNEL: 'stable',
        CLIENT_UPDATE_REF: 'workshop-stable',
        STATUS_BAR_UPDATE_CHANNEL: 'stable',
        STATUS_BAR_UPDATE_REF: 'status-bar-v*',
        SESSION_KV: { get: async () => null, put: async () => {} },
      },
      '/api/components/latest',
      'test',
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.component, 'status-bar');
    assert.equal(body.channel, 'stable');
    assert.equal(body.ref, 'status-bar-v*');
    assert.equal(body.tag, 'status-bar-v1.0.0');
    assert.equal(body.sha, statusSha);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('calculator endpoint uses only calculator tags on stable channel', async () => {
  const originalFetch = globalThis.fetch;
  const calculatorSha = '2323232323232323232323232323232323232323';
  globalThis.fetch = async url => {
    const value = String(url);
    if (value.includes('/tags?')) {
      return new Response(JSON.stringify([
        { name: 'workshop-v9.9.9', commit: { sha: '3434343434343434343434343434343434343434' } },
        { name: 'status-bar-v9.9.9', commit: { sha: '5656565656565656565656565656565656565656' } },
        { name: 'calculator-v1.0.0', commit: { sha: calculatorSha } },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error(`unexpected request: ${value}`);
  };
  try {
    const response = await routeSystem(
      new Request('https://workshop.example/api/components/latest?component=calculator'),
      {
        CLIENT_UPDATE_CHANNEL: 'stable',
        CLIENT_UPDATE_REF: 'workshop-stable',
        CALCULATOR_UPDATE_CHANNEL: 'stable',
        CALCULATOR_UPDATE_REF: 'calculator-v*',
        SESSION_KV: { get: async () => null, put: async () => {} },
      },
      '/api/components/latest',
      'test',
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.component, 'calculator');
    assert.equal(body.channel, 'stable');
    assert.equal(body.ref, 'calculator-v*');
    assert.equal(body.tag, 'calculator-v1.0.0');
    assert.equal(body.sha, calculatorSha);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('opening component endpoint exposes the same testing build used by /opening/latest', async () => {
  const originalFetch = globalThis.fetch;
  const sha = '2468246824682468246824682468246824682468';
  globalThis.fetch = async url => {
    const value = String(url);
    assert.match(value, /\/commits\?sha=main&path=dist%2Fopening%2Fentry.html&per_page=1/u);
    return new Response(JSON.stringify([{ sha }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const response = await routeSystem(
      new Request('https://workshop.example/api/components/latest?component=opening'),
      {
        OPENING_UPDATE_CHANNEL: 'testing',
        OPENING_UPDATE_REF: 'main',
        SESSION_KV: { get: async () => null, put: async () => {} },
      },
      '/api/components/latest',
      'test',
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.component, 'opening');
    assert.equal(body.channel, 'testing');
    assert.equal(body.ref, 'main');
    assert.equal(body.sha, sha);
    assert.equal(body.entry_path, '/dist/opening/entry.html');
    assert.equal(body.source_path, 'dist/opening/entry.html');
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('opening testing channel falls back to GitHub Atom when REST is rate limited', async () => {
  const originalFetch = globalThis.fetch;
  const sha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    const value = String(url);
    requests.push({ value, init });
    if (value.includes('api.github.com/repos/') && value.includes('/commits?')) {
      return new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (value === 'https://github.com/Unspoken-MomoTea/Battlefield-of-Reincarnation/commits/main.atom') {
      return new Response(
        `<?xml version="1.0"?><feed><entry><link rel="alternate" href="https://github.com/Unspoken-MomoTea/Battlefield-of-Reincarnation/commit/${sha}"/></entry></feed>`,
        { status: 200, headers: { 'Content-Type': 'application/atom+xml' } },
      );
    }
    throw new Error(`unexpected request: ${value}`);
  };
  try {
    const response = await routeSystem(
      new Request('https://workshop.example/opening/latest', { redirect: 'manual' }),
      {
        OPENING_UPDATE_CHANNEL: 'testing',
        OPENING_UPDATE_REF: 'main',
        SESSION_KV: { get: async () => null, put: async () => {} },
      },
      '/opening/latest',
      'test',
    );
    assert.equal(response.status, 302);
    assert.match(response.headers.get('location') || '', new RegExp('@' + sha + '/dist/opening/entry\\.html\\?v='));
    assert.ok(requests.some(entry => entry.value.endsWith('/commits/main.atom')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GitHub REST requests use configured token when available', async () => {
  const originalFetch = globalThis.fetch;
  const sha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  let authorization = '';
  globalThis.fetch = async (url, init = {}) => {
    const value = String(url);
    if (value.includes('api.github.com/repos/') && value.includes('/commits?')) {
      authorization = new Headers(init.headers).get('authorization') || '';
      return new Response(JSON.stringify([{ sha }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error(`unexpected request: ${value}`);
  };
  try {
    const response = await routeSystem(
      new Request('https://workshop.example/api/components/latest?component=opening'),
      {
        GITHUB_TOKEN: 'worker-token',
        OPENING_UPDATE_CHANNEL: 'testing',
        OPENING_UPDATE_REF: 'main',
        SESSION_KV: { get: async () => null, put: async () => {} },
      },
      '/api/components/latest',
      'test',
    );
    assert.equal(response.status, 200);
    assert.equal(authorization, 'Bearer worker-token');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('opening component uses persistent last-known metadata when upstream resolution fails', async () => {
  const originalFetch = globalThis.fetch;
  const sha = 'cccccccccccccccccccccccccccccccccccccccc';
  globalThis.fetch = async url => {
    const value = String(url);
    if (value.includes('api.github.com/')) {
      return new Response('{}', { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error(`unexpected request: ${value}`);
  };
  try {
    const response = await routeSystem(
      new Request('https://workshop.example/api/components/latest?component=opening'),
      {
        OPENING_UPDATE_CHANNEL: 'testing',
        OPENING_UPDATE_REF: 'main',
        SESSION_KV: {
          get: async key => {
            if (key === 'public:core-component:last-known:v2:opening:testing:main') {
              return {
                component: 'opening',
                channel: 'testing',
                ref: 'main',
                sha,
                short_sha: sha.slice(0, 8),
                version: '',
                tag: '',
                release_source: 'branch',
                repository: 'Unspoken-MomoTea/Battlefield-of-Reincarnation',
                entry_path: '/dist/opening/entry.html',
                source_path: 'dist/opening/entry.html',
              };
            }
            return null;
          },
          put: async () => {},
        },
      },
      '/api/components/latest',
      'test',
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.sha, sha);
    assert.equal(body.cached, true);
    assert.equal(body.stale, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
