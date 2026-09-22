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
    version: '0.13.0',
    update_channel: 'stable',
    update_ref: 'workshop-stable',
  });
});

test('stable latest endpoint resolves workshop-stable instead of main', async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  const stableSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  globalThis.fetch = async url => {
    urls.push(String(url));
    return new Response(JSON.stringify({ sha: stableSha }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const response = await handleRequest(
      new Request('https://workshop.example/api/client/latest'),
      env(),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.channel, 'stable');
    assert.equal(body.ref, 'workshop-stable');
    assert.equal(body.sha, stableSha);
    assert.equal(body.short_sha, stableSha.slice(0, 8));
    assert.equal(body.repository, 'Unspoken-MomoTea/Battlefield-of-Reincarnation');
    assert.equal(body.entry_path, '/src/CreativeWorkshop/index.js');
    assert.ok(body.checked_at > 0);
    assert.equal(body.cached, false);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(urls.some(url => url.includes('/commits/main')), false);
  assert.equal(urls.some(url => url.includes('/commits/workshop-stable')), true);
});

test('testing latest endpoint resolves main and uses a separate cache key', async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  const mainSha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  globalThis.fetch = async url => {
    urls.push(String(url));
    return new Response(JSON.stringify({ sha: mainSha }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const testEnv = env({
    CLIENT_UPDATE_CHANNEL: 'testing',
    CLIENT_UPDATE_REF: 'main',
    SESSION_KV: new MemoryKV(),
  });

  try {
    const response = await handleRequest(
      new Request('https://workshop.example/api/client/latest'),
      testEnv,
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.channel, 'testing');
    assert.equal(body.ref, 'main');
    assert.equal(body.sha, mainSha);
    assert.equal(body.short_sha, mainSha.slice(0, 8));
    assert.ok(body.checked_at > 0);
    assert.equal(body.cached, false);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(urls.some(url => url.includes('/commits/main')), true);
  assert.equal(
    await testEnv.SESSION_KV.get('public:workshop-client:testing:main') !== null,
    true,
  );
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
