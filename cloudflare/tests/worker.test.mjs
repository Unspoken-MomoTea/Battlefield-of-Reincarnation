import assert from 'node:assert/strict';
import test from 'node:test';

import { handleRequest } from '../src/index.js';

class MemoryKV {
  constructor() {
    this.values = new Map();
  }

  async get(key) {
    return this.values.get(key) ?? null;
  }

  async put(key, value) {
    this.values.set(key, String(value));
  }

  async delete(key) {
    this.values.delete(key);
  }
}

class UserDb {
  constructor(user) {
    this.user = user;
  }

  prepare(sql) {
    return {
      bind: (...args) => ({
        first: async () => {
          if (!/FROM users WHERE id = \?/u.test(sql)) return null;
          return Number(args[0]) === Number(this.user.id) ? this.user : null;
        },
      }),
    };
  }
}

class QuotaExceededKV {
  async get() { return null; }
  async put() { throw new Error('KV put() limit exceeded for the day.'); }
  async delete() {}
}

class AuthFallbackDb {
  constructor(user = null) {
    this.user = user;
    this.auth = new Map();
  }

  prepare(sql) {
    return {
      bind: (...args) => ({
        first: async () => {
          if (/FROM auth_store WHERE key = \?/u.test(sql)) {
            const row = this.auth.get(String(args[0]));
            return row ? { value: row.value, expires_at: row.expires_at } : null;
          }
          if (/FROM users WHERE id = \?/u.test(sql)) {
            if (!this.user) return null;
            return Number(args[0]) === Number(this.user.id) ? this.user : null;
          }
          return null;
        },
        run: async () => {
          if (/INSERT INTO auth_store/u.test(sql)) {
            this.auth.set(String(args[0]), {
              value: String(args[1]),
              expires_at: Number(args[2]),
              updated_at: Number(args[3]),
            });
          } else if (/DELETE FROM auth_store WHERE key = \?/u.test(sql)) {
            this.auth.delete(String(args[0]));
          } else if (/DELETE FROM auth_store WHERE expires_at <= \?/u.test(sql)) {
            const threshold = Number(args[0]);
            for (const [key, row] of this.auth) {
              if (Number(row.expires_at) <= threshold) this.auth.delete(key);
            }
          }
          return { success: true };
        },
      }),
    };
  }
}

function env(extra = {}) {
  return {
    DISCORD_CLIENT_ID: '1234567890',
    PUBLIC_BASE_URL: 'https://workshop.6661816.xyz',
    SESSION_TTL_SECONDS: '3600',
    CLIENT_UPDATE_CHANNEL: 'stable',
    CLIENT_UPDATE_REF: 'workshop-stable',
    SESSION_KV: new MemoryKV(),
    ...extra,
  };
}

test('health endpoint exposes the service contract', async () => {
  const response = await handleRequest(new Request('https://workshop.example/api/health'), env());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: 'reincarnation-workshop',
    version: '0.13.12',
    update_channel: 'stable',
    update_ref: 'workshop-stable',
  });
});

test('stable latest endpoint uses matching workshop tag as formal release', async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  const stableSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  globalThis.fetch = async url => {
    const value = String(url);
    urls.push(value);
    if (value.includes('/tags?')) {
      return new Response(JSON.stringify([{ name: 'workshop-v1.20.1', commit: { sha: stableSha } }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
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
    const response = await handleRequest(new Request('https://workshop.example/api/client/latest'), env());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.release_source, 'tag');
    assert.equal(body.tag, 'workshop-v1.20.1');
    assert.equal(body.version, '1.20.1');
    assert.equal(body.sha, stableSha);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.ok(urls.some(url => url.includes('/tags?')));
  assert.ok(urls.some(url => url.includes('/commits/workshop-stable')));
  assert.equal(urls.some(url => url.includes('sha=main')), false);
});

test('world engine stable endpoint ignores newer workshop tags and selects its own namespace', async () => {
  const originalFetch = globalThis.fetch;
  const workshopSha = '4444444444444444444444444444444444444444';
  const worldSha = '5555555555555555555555555555555555555555';
  globalThis.fetch = async url => {
    const value = String(url);
    if (value.includes('/tags?')) {
      return new Response(JSON.stringify([
        { name: 'workshop-v9.9.9', commit: { sha: workshopSha } },
        { name: 'world-engine-v2.0.8', commit: { sha: worldSha } },
        { name: 'V2.0.7', commit: { sha: '6666666666666666666666666666666666666666' } },
      ]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error(`unexpected request: ${value}`);
  };
  try {
    const response = await handleRequest(
      new Request('https://workshop.example/api/components/latest?component=world-engine'),
      env({ SESSION_KV: new MemoryKV() }),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.release_source, 'tag');
    assert.equal(body.tag, 'world-engine-v2.0.8');
    assert.equal(body.version, '2.0.8');
    assert.equal(body.sha, worldSha);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('stable workshop keeps the previous formal tag while GitHub tag listing lags behind the new stable head', async () => {
  const originalFetch = globalThis.fetch;
  const previousSha = '2828282828282828282828282828282828282828';
  const nextSha = '2929292929292929292929292929292929292929';
  globalThis.fetch = async url => {
    const value = String(url);
    if (value.includes('/tags?')) {
      return new Response(JSON.stringify([
        { name: 'workshop-v2.0.28', commit: { sha: previousSha } },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (value.includes('/commits/workshop-stable')) {
      return new Response(JSON.stringify({ sha: nextSha }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (value.includes('/commits?') && value.includes('sha=workshop-stable')) {
      return new Response(JSON.stringify([{ sha: nextSha }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error(`unexpected request: ${value}`);
  };

  const previousSnapshot = {
    component: 'workshop',
    channel: 'stable',
    ref: 'workshop-stable',
    sha: previousSha,
    short_sha: previousSha.slice(0, 8),
    version: '2.0.28',
    tag: 'workshop-v2.0.28',
    release_source: 'tag',
    repository: 'Unspoken-MomoTea/Battlefield-of-Reincarnation',
    entry_path: '/src/CreativeWorkshop/index.js',
    source_path: 'src/CreativeWorkshop',
    checked_at: 1,
  };

  try {
    const response = await handleRequest(
      new Request('https://workshop.example/api/client/latest'),
      env({
        SESSION_KV: {
          get: async key => key === 'public:core-component:last-known:v1:workshop:stable:workshop-stable'
            ? previousSnapshot
            : null,
          put: async () => {},
        },
      }),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.sha, previousSha);
    assert.equal(body.tag, 'workshop-v2.0.28');
    assert.equal(body.release_source, 'tag');
    assert.equal(body.stale, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('stable workshop refuses a bare stable head until a matching immutable tag is visible', async () => {
  const originalFetch = globalThis.fetch;
  const tagSha = '1111111111111111111111111111111111111111';
  const stableHead = '2222222222222222222222222222222222222222';
  globalThis.fetch = async url => {
    const value = String(url);
    if (value.includes('/tags?')) {
      return new Response(JSON.stringify([{ name: 'V1.0.0', commit: { sha: tagSha } }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (value.includes('/commits/workshop-stable')) {
      return new Response(JSON.stringify({ sha: stableHead }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error(`unexpected request: ${value}`);
  };
  try {
    const response = await handleRequest(
      new Request('https://workshop.example/api/client/latest'),
      env({ SESSION_KV: new MemoryKV() }),
    );
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.code, 'component_release_pending');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('testing latest endpoint resolves main and uses component cache key', async () => {
  const originalFetch = globalThis.fetch;
  const mainSha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  globalThis.fetch = async () => new Response(JSON.stringify([{ sha: mainSha }]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  const testEnv = env({
    CLIENT_UPDATE_CHANNEL: 'testing',
    CLIENT_UPDATE_REF: 'main',
    SESSION_KV: new MemoryKV(),
  });
  try {
    const response = await handleRequest(new Request('https://workshop.example/api/client/latest'), testEnv);
    const body = await response.json();
    assert.equal(body.channel, 'testing');
    assert.equal(body.ref, 'main');
    assert.equal(body.release_source, 'branch');
    assert.equal(body.sha, mainSha);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(
    await testEnv.SESSION_KV.get('public:core-component:v4:workshop:testing:main'),
    null,
  );
  assert.equal(
    await testEnv.SESSION_KV.get('public:core-component:last-known:v2:workshop:testing:main') !== null,
    true,
  );
});

test('testing latest never substitutes unrelated main HEAD when path lookup is rate limited', async () => {
  const originalFetch = globalThis.fetch;
  const knownWorkshopSha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const unrelatedMainHead = 'cccccccccccccccccccccccccccccccccccccccc';
  let atomRequests = 0;
  globalThis.fetch = async input => {
    const value = String(input);
    if (value.includes('/commits?') && value.includes('path=src%2FCreativeWorkshop')) {
      return new Response('rate limited', { status: 403 });
    }
    if (value.includes('/commits/main.atom')) {
      atomRequests += 1;
      return new Response(
        '<feed><entry><id>https://github.com/Unspoken-MomoTea/Battlefield-of-Reincarnation/commit/' + unrelatedMainHead + '</id></entry></feed>',
        { status: 200, headers: { 'Content-Type': 'application/atom+xml' } },
      );
    }
    throw new Error('unexpected request: ' + value);
  };

  const previousSnapshot = {
    component: 'workshop',
    channel: 'testing',
    ref: 'main',
    sha: knownWorkshopSha,
    short_sha: knownWorkshopSha.slice(0, 8),
    version: '',
    tag: '',
    release_source: 'branch',
    repository: 'Unspoken-MomoTea/Battlefield-of-Reincarnation',
    entry_path: '/src/CreativeWorkshop/index.js',
    source_path: 'src/CreativeWorkshop',
    checked_at: 1,
  };
  const store = {
    get: async key => key === 'public:core-component:last-known:v2:workshop:testing:main'
      ? previousSnapshot
      : null,
    put: async () => {},
  };

  try {
    const response = await handleRequest(
      new Request('https://workshop.example/api/client/latest'),
      env({
        CLIENT_UPDATE_CHANNEL: 'testing',
        CLIENT_UPDATE_REF: 'main',
        SESSION_KV: store,
      }),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.sha, knownWorkshopSha);
    assert.equal(body.stale, true);
    assert.equal(atomRequests, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Discord login start falls back to D1 when KV writes are exhausted', async () => {
  const db = new AuthFallbackDb();
  const loginId = 'e'.repeat(64);
  const response = await handleRequest(
    new Request(`https://workshop.example/api/auth/discord/start?login_id=${loginId}`),
    env({ SESSION_KV: new QuotaExceededKV(), DB: db }),
  );

  assert.equal(response.status, 302);
  assert.match(response.headers.get('location') || '', /^https:\/\/discord\.com\/oauth2\/authorize/u);
  assert.equal([...db.auth.keys()].some(key => key.startsWith('oauth:')), true);
});

test('login exchange and authenticated session use D1 when KV writes are exhausted', async () => {
  const user = {
    id: 17,
    discord_id: '1717',
    username: 'd1-user',
    display_name: 'D1 User',
    avatar: null,
    is_admin: 0,
    is_moderator: 0,
    is_banned: 0,
    ban_reason: '',
    banned_at: null,
    created_at: 1,
    updated_at: 1,
  };
  const db = new AuthFallbackDb(user);
  const loginId = 'f'.repeat(64);
  db.auth.set(`login_result:${loginId}`, {
    value: JSON.stringify({ userId: user.id, createdAt: Date.now() }),
    expires_at: Math.floor(Date.now() / 1000) + 120,
    updated_at: Math.floor(Date.now() / 1000),
  });
  const testEnv = env({ SESSION_KV: new QuotaExceededKV(), DB: db });

  const exchangeResponse = await handleRequest(
    new Request('https://workshop.example/api/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_id: loginId }),
    }),
    testEnv,
  );
  assert.equal(exchangeResponse.status, 200);
  const exchange = await exchangeResponse.json();
  assert.ok(exchange.token);
  assert.equal(db.auth.has(`login_result:${loginId}`), false);
  assert.equal([...db.auth.keys()].some(key => key.startsWith('session:')), true);

  const meResponse = await handleRequest(
    new Request('https://workshop.example/api/auth/me', {
      headers: { Authorization: `Bearer ${exchange.token}` },
    }),
    testEnv,
  );
  assert.equal(meResponse.status, 200);
  assert.equal((await meResponse.json()).user.discord_id, '1717');
});

test('Discord login start rejects caller supplied non-random login ids', async () => {
  const response = await handleRequest(
    new Request('https://workshop.example/api/auth/discord/start?login_id=abc&opener_origin=https://tavern.example'),
    env(),
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'invalid_login_id');
});

test('Discord login start also supports polling-only native clients without opener origin', async () => {
  const testEnv = env();
  const loginId = 'd'.repeat(64);
  const response = await handleRequest(
    new Request(
      `https://workshop.example/api/auth/discord/start?login_id=${loginId}`,
    ),
    testEnv,
  );

  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('location'));
  const state = location.searchParams.get('state');
  const pending = JSON.parse(await testEnv.SESSION_KV.get(`oauth:${state}`));
  assert.equal(pending.loginId, loginId);
  assert.equal(pending.openerOrigin, null);
});

test('Discord login start binds state to the login id and opener origin', async () => {
  const testEnv = env();
  const loginId = 'a'.repeat(64);
  const response = await handleRequest(
    new Request(
      `https://workshop.example/api/auth/discord/start?login_id=${loginId}&opener_origin=https://tavern.example/path`,
    ),
    testEnv,
  );

  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('location'));
  assert.equal(location.origin, 'https://discord.com');
  assert.equal(location.searchParams.get('client_id'), '1234567890');
  assert.equal(location.searchParams.get('scope'), 'identify');
  assert.equal(location.searchParams.get('redirect_uri'), 'https://workshop.6661816.xyz/api/auth/discord/callback');

  const state = location.searchParams.get('state');
  const pending = JSON.parse(await testEnv.SESSION_KV.get(`oauth:${state}`));
  assert.equal(pending.loginId, loginId);
  assert.equal(pending.openerOrigin, 'https://tavern.example');
});

test('completed login can be exchanged once for a session and queried through /me', async () => {
  const testEnv = env({
    DB: new UserDb({
      id: 7,
      discord_id: '999',
      username: 'tester',
      display_name: 'Tester',
      avatar: null,
      is_admin: 0,
      created_at: 1,
      updated_at: 1,
    }),
  });
  const loginId = 'b'.repeat(64);
  await testEnv.SESSION_KV.put(`login_result:${loginId}`, JSON.stringify({ userId: 7 }));

  const exchangeResponse = await handleRequest(
    new Request('https://workshop.example/api/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_id: loginId }),
    }),
    testEnv,
  );
  assert.equal(exchangeResponse.status, 200);
  const exchange = await exchangeResponse.json();
  assert.ok(exchange.token);
  assert.ok(exchange.expires_at > Math.floor(Date.now() / 1000));
  assert.equal(await testEnv.SESSION_KV.get(`login_result:${loginId}`), null);

  const secondExchange = await handleRequest(
    new Request('https://workshop.example/api/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_id: loginId }),
    }),
    testEnv,
  );
  assert.equal(secondExchange.status, 409);

  const meResponse = await handleRequest(
    new Request('https://workshop.example/api/auth/me', {
      headers: { Authorization: `Bearer ${exchange.token}` },
    }),
    testEnv,
  );
  assert.equal(meResponse.status, 200);
  const me = await meResponse.json();
  assert.equal(me.user.discord_id, '999');
  assert.equal(me.user.display_name, 'Tester');
});

test('an existing session is rejected immediately after the user is banned', async () => {
  const user = {
    id: 8,
    discord_id: '888',
    username: 'banned-user',
    display_name: 'Banned User',
    avatar: null,
    is_admin: 0,
    is_banned: 0,
    ban_reason: '',
    banned_at: null,
    created_at: 1,
    updated_at: 1,
  };
  const testEnv = env({ DB: new UserDb(user) });
  const loginId = 'c'.repeat(64);
  await testEnv.SESSION_KV.put(`login_result:${loginId}`, JSON.stringify({ userId: 8 }));

  const exchangeResponse = await handleRequest(
    new Request('https://workshop.example/api/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_id: loginId }),
    }),
    testEnv,
  );
  const exchange = await exchangeResponse.json();

  user.is_banned = 1;
  user.ban_reason = '恶意上传';

  const meResponse = await handleRequest(
    new Request('https://workshop.example/api/auth/me', {
      headers: { Authorization: `Bearer ${exchange.token}` },
    }),
    testEnv,
  );
  assert.equal(meResponse.status, 403);
  const body = await meResponse.json();
  assert.equal(body.code, 'user_banned');
  assert.equal(body.error, '恶意上传');
});

test('unsupported routes return a stable 404 contract', async () => {
  const response = await handleRequest(new Request('https://workshop.example/api/nope'), env());
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, 'not_found');
});


test('production opening preview endpoint follows its independent main channel without changing workshop stable', async () => {
  const originalFetch = globalThis.fetch;
  const sha = 'abcdefabcdefabcdefabcdefabcdefabcdefabcd';
  globalThis.fetch = async url => {
    const value = String(url);
    if (value.includes('/commits?')) {
      return new Response(JSON.stringify([{ sha }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error(`unexpected request: ${value}`);
  };
  try {
    const response = await handleRequest(
      new Request('https://workshop.6661816.xyz/opening/latest', { redirect: 'manual' }),
      env({
        OPENING_UPDATE_CHANNEL: 'testing',
        OPENING_UPDATE_REF: 'main',
        SESSION_KV: new MemoryKV(),
      }),
    );
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('x-opening-channel'), 'testing');
    assert.equal(response.headers.get('x-opening-ref'), 'main');
    assert.match(response.headers.get('location') || '', new RegExp('@' + sha + '/dist/opening/entry\\.html\\?v='));
    assert.match(response.headers.get('cache-control') || '', /no-store/u);
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('status bar component endpoint remains independent from workshop and world engine tags', async () => {
  const originalFetch = globalThis.fetch;
  const statusSha = '7878787878787878787878787878787878787878';
  globalThis.fetch = async url => {
    const value = String(url);
    if (value.includes('/tags?')) {
      return new Response(JSON.stringify([
        { name: 'workshop-v3.0.0', commit: { sha: '8989898989898989898989898989898989898989' } },
        { name: 'world-engine-v3.0.0', commit: { sha: '9090909090909090909090909090909090909090' } },
        { name: 'status-bar-v1.0.0', commit: { sha: statusSha } },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error(`unexpected request: ${value}`);
  };
  try {
    const response = await handleRequest(
      new Request('https://workshop.example/api/components/latest?component=status-bar'),
      env({
        STATUS_BAR_UPDATE_CHANNEL: 'stable',
        STATUS_BAR_UPDATE_REF: 'status-bar-v*',
        SESSION_KV: new MemoryKV(),
      }),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.tag, 'status-bar-v1.0.0');
    assert.equal(body.sha, statusSha);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('calculator component endpoint remains independent from other component tags', async () => {
  const originalFetch = globalThis.fetch;
  const calculatorSha = '6767676767676767676767676767676767676767';
  globalThis.fetch = async url => {
    const value = String(url);
    if (value.includes('/tags?')) {
      return new Response(JSON.stringify([
        { name: 'workshop-v4.0.0', commit: { sha: '8989898989898989898989898989898989898989' } },
        { name: 'status-bar-v4.0.0', commit: { sha: '9090909090909090909090909090909090909090' } },
        { name: 'calculator-v1.0.0', commit: { sha: calculatorSha } },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error(`unexpected request: ${value}`);
  };
  try {
    const response = await handleRequest(
      new Request('https://workshop.example/api/components/latest?component=calculator'),
      env({
        CALCULATOR_UPDATE_CHANNEL: 'stable',
        CALCULATOR_UPDATE_REF: 'calculator-v*',
        SESSION_KV: new MemoryKV(),
      }),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.tag, 'calculator-v1.0.0');
    assert.equal(body.sha, calculatorSha);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('opening component metadata endpoint is publicly routed in production Worker', async () => {
  const originalFetch = globalThis.fetch;
  const sha = '1357135713571357135713571357135713571357';
  globalThis.fetch = async url => {
    const value = String(url);
    if (value.includes('/commits?')) {
      return new Response(JSON.stringify([{ sha }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error(`unexpected request: ${value}`);
  };
  try {
    const response = await handleRequest(
      new Request('https://workshop.example/api/components/latest?component=opening'),
      env({
        OPENING_UPDATE_CHANNEL: 'testing',
        OPENING_UPDATE_REF: 'main',
        SESSION_KV: new MemoryKV(),
      }),
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
