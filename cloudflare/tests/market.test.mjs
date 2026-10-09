import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { handleRequest } from '../src/index.js';

class D1Statement {
  constructor(db, sql, args = []) {
    this.db = db;
    this.sql = sql;
    this.args = args;
  }
  bind(...args) { return new D1Statement(this.db, this.sql, args); }
  async first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() {
    const result = this.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

class D1Database {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    this.db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  }
  prepare(sql) { return new D1Statement(this.db, sql); }
  async batch(statements) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.db.exec('COMMIT');
      return results;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

class MemoryKV {
  constructor() { this.map = new Map(); }
  async get(key) { return this.map.get(key) ?? null; }
  async put(key, value) { this.map.set(key, String(value)); }
  async delete(key) { this.map.delete(key); }
}

function env(extra = {}) {
  return {
    DB: new D1Database(),
    SESSION_KV: new MemoryKV(),
    SESSION_TTL_SECONDS: '3600',
    CLIENT_UPDATE_CHANNEL: 'testing',
    CLIENT_UPDATE_REF: 'main',
    PUBLIC_BASE_URL: 'https://workshop-test.6661816.xyz',
    DISCORD_CLIENT_ID: '123',
    ...extra,
  };
}

function createUser(testEnv, discordId, displayName) {
  testEnv.DB.db.prepare(
    `INSERT INTO users
      (discord_id, username, display_name, is_admin, is_moderator, is_banned, created_at, updated_at)
     VALUES (?, ?, ?, 0, 0, 0, ?, ?)`,
  ).run(discordId, displayName.toLowerCase().replace(/\s+/gu, '-'), displayName, 1, 1);
  return testEnv.DB.db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId);
}

function authHeaders(testEnv, user, token) {
  const hash = createHash('sha256').update(token).digest('hex');
  const now = Math.floor(Date.now() / 1000);
  testEnv.DB.db.prepare(
    'INSERT INTO auth_store (key, value, expires_at, updated_at) VALUES (?, ?, ?, ?)',
  ).run(
    `session:${hash}`,
    JSON.stringify({ userId: user.id, expiresAt: now + 3600 }),
    now + 3600,
    now,
  );
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function jsonRequest(testEnv, path, init = {}) {
  const response = await handleRequest(
    new Request(`https://workshop.example${path}`, init),
    testEnv,
  );
  let body = null;
  try { body = await response.json(); } catch {}
  return { response, body };
}

test('space market is unavailable on the stable worker even when tables exist', async () => {
  const stableEnv = env({ CLIENT_UPDATE_CHANNEL: 'stable', CLIENT_UPDATE_REF: 'workshop-stable' });
  const { response, body } = await jsonRequest(stableEnv, '/api/market/listings');
  assert.equal(response.status, 404);
  assert.equal(body.code, 'not_found');
});

test('testing market supports listing, idempotent purchase, delivery and seller proceeds', async () => {
  const testEnv = env();
  const seller = createUser(testEnv, '100', 'Seller');
  const buyer = createUser(testEnv, '200', 'Buyer');
  const sellerHeaders = authHeaders(testEnv, seller, 'seller-token');
  const buyerHeaders = authHeaders(testEnv, buyer, 'buyer-token');

  const created = await jsonRequest(testEnv, '/api/market/listings', {
    method: 'POST',
    headers: sellerHeaders,
    body: JSON.stringify({
      id: 'listing-1',
      asset: {
        kind: 'item',
        name: '治疗药剂',
        quantity: 3,
        data: { 名称: '治疗药剂', 品质: 'E', 数量: 3, 描述: '恢复伤势' },
      },
      unit_price: 125,
    }),
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.listing.remaining_quantity, 3);
  assert.equal(created.body.listing.seller.display_name, 'Seller');

  const catalog = await jsonRequest(testEnv, '/api/market/listings?kind=item&sort=price_asc');
  assert.equal(catalog.response.status, 200);
  assert.ok(catalog.body.items.some(item => item.id === 'listing-1'));
  assert.ok(catalog.body.items.some(item => item.id === 'test-vendor:item:healing-potion'));

  const ownBuy = await jsonRequest(testEnv, '/api/market/listings/listing-1/buy', {
    method: 'POST',
    headers: sellerHeaders,
    body: JSON.stringify({ trade_id: 'trade-own', quantity: 1 }),
  });
  assert.equal(ownBuy.response.status, 409);
  assert.equal(ownBuy.body.code, 'market_own_listing');

  const purchase = await jsonRequest(testEnv, '/api/market/listings/listing-1/buy', {
    method: 'POST',
    headers: buyerHeaders,
    body: JSON.stringify({ trade_id: 'trade-1', quantity: 2 }),
  });
  assert.equal(purchase.response.status, 200);
  assert.equal(purchase.body.trade.total_price, 250);
  assert.equal(purchase.body.trade.quantity, 2);
  assert.equal(purchase.body.trade.delivered_at, null);
  assert.equal(purchase.body.listing.remaining_quantity, 1);

  const repeated = await jsonRequest(testEnv, '/api/market/listings/listing-1/buy', {
    method: 'POST',
    headers: buyerHeaders,
    body: JSON.stringify({ trade_id: 'trade-1', quantity: 2 }),
  });
  assert.equal(repeated.response.status, 200);
  assert.equal(repeated.body.trade.id, 'trade-1');
  assert.equal(repeated.body.listing.remaining_quantity, 1);

  const sellerMe = await jsonRequest(testEnv, '/api/market/me', {
    headers: sellerHeaders,
  });
  assert.equal(sellerMe.response.status, 200);
  assert.equal(sellerMe.body.wallet.balance, 242);
  assert.equal(sellerMe.body.sales[0].market_fee, 8);
  assert.equal(sellerMe.body.sales[0].seller_proceeds, 242);
  assert.equal(sellerMe.body.sales.length, 1);

  const buyerMe = await jsonRequest(testEnv, '/api/market/me', {
    headers: buyerHeaders,
  });
  assert.equal(buyerMe.body.pending_deliveries.length, 1);
  assert.equal(buyerMe.body.pending_deliveries[0].id, 'trade-1');

  const delivered = await jsonRequest(testEnv, '/api/market/trades/trade-1/delivered', {
    method: 'POST',
    headers: buyerHeaders,
  });
  assert.equal(delivered.response.status, 200);
  assert.ok(Number(delivered.body.trade.delivered_at) > 0);

  const tradeLookup = await jsonRequest(testEnv, '/api/market/trades/trade-1', {
    headers: buyerHeaders,
  });
  assert.equal(tradeLookup.response.status, 200);
  assert.equal(tradeLookup.body.trade.asset.name, '治疗药剂');
});

test('cancelling a listing creates a recoverable return and proceeds use pending payouts', async () => {
  const testEnv = env();
  const seller = createUser(testEnv, '300', 'Return Seller');
  const buyer = createUser(testEnv, '400', 'Return Buyer');
  const sellerHeaders = authHeaders(testEnv, seller, 'return-seller-token');
  const buyerHeaders = authHeaders(testEnv, buyer, 'return-buyer-token');

  await jsonRequest(testEnv, '/api/market/listings', {
    method: 'POST',
    headers: sellerHeaders,
    body: JSON.stringify({
      id: 'listing-2',
      asset: {
        kind: 'item',
        name: '稀有材料',
        quantity: 4,
        data: { 名称: '稀有材料', 品质: 'D', 数量: 4 },
      },
      unit_price: 50,
    }),
  });

  await jsonRequest(testEnv, '/api/market/listings/listing-2/buy', {
    method: 'POST',
    headers: buyerHeaders,
    body: JSON.stringify({ trade_id: 'trade-2', quantity: 1 }),
  });

  const cancelled = await jsonRequest(testEnv, '/api/market/listings/listing-2/cancel', {
    method: 'POST',
    headers: sellerHeaders,
  });
  assert.equal(cancelled.response.status, 200);
  assert.equal(cancelled.body.listing.status, 'cancelled');
  assert.equal(cancelled.body.return.quantity, 3);

  let sellerMe = await jsonRequest(testEnv, '/api/market/me', { headers: sellerHeaders });
  assert.equal(sellerMe.body.pending_returns.length, 1);
  assert.equal(sellerMe.body.pending_returns[0].quantity, 3);
  assert.equal(sellerMe.body.wallet.balance, 48);

  const confirmedReturn = await jsonRequest(
    testEnv,
    `/api/market/returns/${encodeURIComponent(sellerMe.body.pending_returns[0].id)}/confirmed`,
    { method: 'POST', headers: sellerHeaders },
  );
  assert.equal(confirmedReturn.response.status, 200);
  assert.ok(Number(confirmedReturn.body.return.confirmed_at) > 0);

  const payout = await jsonRequest(testEnv, '/api/market/payouts/claim', {
    method: 'POST',
    headers: sellerHeaders,
    body: JSON.stringify({ payout_id: 'payout-1' }),
  });
  assert.equal(payout.response.status, 200);
  assert.equal(payout.body.payout.amount, 48);
  assert.equal(payout.body.payout.confirmed_at, null);

  sellerMe = await jsonRequest(testEnv, '/api/market/me', { headers: sellerHeaders });
  assert.equal(sellerMe.body.wallet.balance, 0);
  assert.equal(sellerMe.body.pending_payouts.length, 1);

  const confirmedPayout = await jsonRequest(testEnv, '/api/market/payouts/payout-1/confirmed', {
    method: 'POST',
    headers: sellerHeaders,
  });
  assert.equal(confirmedPayout.response.status, 200);
  assert.ok(Number(confirmedPayout.body.payout.confirmed_at) > 0);
});


test('testing catalog auto-seeds virtual seller fixtures that a real user can purchase', async () => {
  const testEnv = env();
  const buyer = createUser(testEnv, '500', 'Solo Tester');
  const buyerHeaders = authHeaders(testEnv, buyer, 'solo-tester-token');

  const catalog = await jsonRequest(testEnv, '/api/market/listings?sort=price_asc');
  assert.equal(catalog.response.status, 200);
  assert.ok(catalog.body.items.length >= 5);
  assert.ok(catalog.body.items.some(item => item.seller.display_name === '轮回集市测试员 · 虚拟账号'));
  assert.ok(catalog.body.items.some(item => item.seller.display_name === '悖论公证所 · 系统柜台'));

  const potion = catalog.body.items.find(item => item.id === 'test-vendor:item:healing-potion');
  assert.ok(potion);
  assert.equal(potion.asset.kind, 'item');
  assert.equal(potion.remaining_quantity, 20);

  const purchase = await jsonRequest(testEnv, '/api/market/listings/test-vendor%3Aitem%3Ahealing-potion/buy', {
    method: 'POST',
    headers: buyerHeaders,
    body: JSON.stringify({ trade_id: 'trade-solo-test', quantity: 2 }),
  });
  assert.equal(purchase.response.status, 200);
  assert.equal(purchase.body.trade.quantity, 2);
  assert.equal(purchase.body.trade.seller.display_name, '轮回集市测试员 · 虚拟账号');
  assert.equal(purchase.body.listing.remaining_quantity, 18);

  const refreshed = await jsonRequest(testEnv, '/api/market/listings?sort=price_asc');
  const refreshedPotion = refreshed.body.items.find(item => item.id === 'test-vendor:item:healing-potion');
  assert.equal(refreshedPotion.remaining_quantity, 18);
});


test('auction quote uses quality high for tax and quality floor for equipment buyback', async () => {
  const testEnv = env();
  const seller = createUser(testEnv, '600', 'Economy Seller');
  const headers = authHeaders(testEnv, seller, 'economy-seller-token');

  const auction = await jsonRequest(testEnv, '/api/market/quote', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'auction',
      duration_hours: 72,
      asset: {
        kind: 'item',
        name: 'E级材料',
        quantity: 3,
        data: { 名称: 'E级材料', 品质: 'E', 类型: '材料', 数量: 3 },
      },
    }),
  });
  assert.equal(auction.response.status, 200);
  assert.equal(auction.body.quote.quality_floor, 100);
  assert.equal(auction.body.quote.quality_high, 999);
  assert.equal(auction.body.quote.listing_fee, 900);

  const buybackQuote = await jsonRequest(testEnv, '/api/market/quote', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'buyback',
      asset: {
        kind: 'equipment',
        name: 'F级旧剑',
        quantity: 1,
        data: { 名称: 'F级旧剑', 品质: 'F', 类型: 0 },
      },
    }),
  });
  assert.equal(buybackQuote.response.status, 200);
  assert.equal(buybackQuote.body.quote.unit_price, 3);
  assert.equal(buybackQuote.body.quote.total_price, 3);

  const buyback = await jsonRequest(testEnv, '/api/market/buybacks', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: 'buyback-economy-1',
      asset: {
        kind: 'equipment',
        name: 'F级旧剑',
        quantity: 1,
        data: { 名称: 'F级旧剑', 品质: 'F', 类型: 0 },
      },
    }),
  });
  assert.equal(buyback.response.status, 201);
  assert.equal(buyback.body.buyback.amount, 3);
  assert.equal(buyback.body.payout.amount, 3);
  assert.equal(buyback.body.payout.confirmed_at, null);
});

test('expired auction disappears, stays reclaimable for 72 hours, then server recycles it', async () => {
  const testEnv = env();
  const seller = createUser(testEnv, '700', 'Expiry Seller');
  const headers = authHeaders(testEnv, seller, 'expiry-seller-token');

  const created = await jsonRequest(testEnv, '/api/market/listings', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: 'listing-expiry-1',
      duration_hours: 24,
      asset: {
        kind: 'equipment',
        name: 'D级旧甲',
        quantity: 1,
        data: { 名称: 'D级旧甲', 品质: 'D', 类型: 3 },
      },
      unit_price: 1500,
    }),
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.listing.duration_hours, 24);
  assert.equal(created.body.listing.listing_fee, 500);
  assert.ok(created.body.listing.recycle_at > created.body.listing.expires_at);

  const now = Date.now();
  testEnv.DB.db.prepare(
    'UPDATE market_listings SET expires_at = ?, recycle_at = ? WHERE id = ?',
  ).run(now - 1000, now + 60_000, 'listing-expiry-1');

  let catalog = await jsonRequest(testEnv, '/api/market/listings?sort=latest');
  assert.equal(catalog.body.items.some(item => item.id === 'listing-expiry-1'), false);

  let mine = await jsonRequest(testEnv, '/api/market/me', { headers });
  const waiting = mine.body.listings.find(item => item.id === 'listing-expiry-1');
  assert.equal(waiting.status, 'active');
  assert.equal(waiting.expired, true);

  testEnv.DB.db.prepare(
    'UPDATE market_listings SET recycle_at = ? WHERE id = ?',
  ).run(now - 1, 'listing-expiry-1');

  mine = await jsonRequest(testEnv, '/api/market/me', { headers });
  const recycled = mine.body.listings.find(item => item.id === 'listing-expiry-1');
  assert.equal(recycled.status, 'cancelled');
  assert.equal(recycled.remaining_quantity, 0);
  assert.equal(mine.body.recycles.length, 1);
  assert.equal(mine.body.recycles[0].amount, 250);
  assert.equal(mine.body.wallet.balance, 250);
});

test('system credential listings restock daily and do not credit a synthetic seller wallet', async () => {
  const testEnv = env();
  const buyer = createUser(testEnv, '800', 'Credential Buyer');
  const headers = authHeaders(testEnv, buyer, 'credential-buyer-token');

  const catalog = await jsonRequest(testEnv, '/api/market/listings?kind=item&sort=price_asc');
  const credential = catalog.body.items.find(item => item.id === 'system:credential:F');
  assert.ok(credential);
  assert.equal(credential.is_system, true);
  assert.equal(credential.remaining_quantity, 30);
  assert.equal(credential.unit_price, 99);
  assert.equal(credential.asset.data.类型, '权限凭证');
  assert.equal(credential.asset.data.系统商品, undefined);
  assert.equal(credential.asset.data.凭证品质, undefined);

  const eCredential = catalog.body.items.find(item => item.id === 'system:credential:E');
  assert.equal(eCredential.unit_price, 999);
  const sssCredential = catalog.body.items.find(item => item.id === 'system:credential:SSS');
  assert.equal(sssCredential.unit_price, 5_120_000);

  const purchase = await jsonRequest(testEnv, '/api/market/listings/system%3Acredential%3AF/buy', {
    method: 'POST',
    headers,
    body: JSON.stringify({ trade_id: 'trade-credential-1', quantity: 2 }),
  });
  assert.equal(purchase.response.status, 200);
  assert.equal(purchase.body.trade.market_fee, 0);
  assert.equal(purchase.body.trade.seller_proceeds, 0);
  assert.equal(purchase.body.listing.remaining_quantity, 28);

  const systemUser = testEnv.DB.db.prepare(
    "SELECT id FROM users WHERE discord_id = '__market_system_vendor__'",
  ).get();
  const wallet = testEnv.DB.db.prepare(
    'SELECT balance FROM market_wallets WHERE user_id = ?',
  ).get(systemUser.id);
  assert.equal(wallet, undefined);
});
