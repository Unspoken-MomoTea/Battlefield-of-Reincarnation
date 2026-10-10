import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { handleRequest } from '../src/index.js';
import { cleanupCompletedMarketRecords } from '../src/market-cleanup.js';

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

function authHeaders(testEnv, user, token, saveId = 'test-save-1') {
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
    'X-Market-Save': saveId,
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
  assert.equal(catalog.body.items.some(item => item.id.startsWith('test-vendor:')), false);

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
  assert.equal(purchase.body.trade.market_fee, 0, 'auction tax is paid up front; no second fee at sale');
  assert.equal(purchase.body.trade.seller_proceeds, 250);
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
  assert.equal(sellerMe.body.wallet.balance, 250);
  assert.equal(Object.hasOwn(sellerMe.body, 'sales'), false);
  assert.equal(Object.hasOwn(sellerMe.body, 'purchases'), false);

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
  assert.equal(sellerMe.body.wallet.balance, 50);

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
  assert.equal(payout.body.payout.amount, 50);
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


test('testing catalog starts with real system credentials only, never virtual test merchandise', async () => {
  const testEnv = env();
  const catalog = await jsonRequest(testEnv, '/api/market/listings?sort=price_asc&limit=60');
  assert.equal(catalog.response.status, 200);
  assert.equal(catalog.body.items.length, 6);
  assert.equal(catalog.body.items.every(item => item.id.startsWith('system:credential:')), true);
  assert.equal(catalog.body.items.every(item => item.remaining_quantity === 10), true);
  const names = catalog.body.items.map(item => item.id).sort();
  assert.deepEqual(names, ['A', 'B', 'C', 'D', 'E', 'F'].map(x => 'system:credential:' + x).sort());
  assert.equal(testEnv.DB.db.prepare("SELECT COUNT(*) AS count FROM market_listings WHERE id LIKE 'test-vendor:%'").get().count, 0);
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
  assert.equal(Object.hasOwn(mine.body, 'recycles'), false);
  assert.equal(testEnv.DB.db.prepare('SELECT amount FROM market_recycles WHERE listing_id = ?')
    .get('listing-expiry-1').amount, 250);
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
  assert.equal(credential.remaining_quantity, 10);
  assert.equal(credential.unit_price, 99);
  assert.equal(credential.asset.data.类型, '权限凭证');
  assert.equal(credential.asset.data.系统商品, undefined);
  assert.equal(credential.asset.data.凭证品质, undefined);

  const eCredential = catalog.body.items.find(item => item.id === 'system:credential:E');
  assert.equal(eCredential.unit_price, 999);
  const aCredential = catalog.body.items.find(item => item.id === 'system:credential:A');
  assert.equal(aCredential.unit_price, 319_999);
  assert.equal(catalog.body.items.some(item => item.id === 'system:credential:S'), false);
  assert.equal(catalog.body.items.some(item => item.id === 'system:credential:SS'), false);
  assert.equal(catalog.body.items.some(item => item.id === 'system:credential:SSS'), false);

  const purchase = await jsonRequest(testEnv, '/api/market/listings/system%3Acredential%3AF/buy', {
    method: 'POST',
    headers,
    body: JSON.stringify({ trade_id: 'trade-credential-1', quantity: 2 }),
  });
  assert.equal(purchase.response.status, 200);
  assert.equal(purchase.body.trade.market_fee, 0);
  assert.equal(purchase.body.trade.seller_proceeds, 0);
  assert.equal(purchase.body.listing.remaining_quantity, 8);

  const systemUser = testEnv.DB.db.prepare(
    "SELECT id FROM users WHERE discord_id = '__market_system_vendor__'",
  ).get();
  const wallet = testEnv.DB.db.prepare(
    'SELECT balance FROM market_save_wallets WHERE user_id = ?',
  ).get(systemUser.id);
  assert.equal(wallet, undefined);
});


test('F voucher daily ten-stock pool is shared across buyers and never refills the same day', async () => {
  const testEnv = env();
  const userA = createUser(testEnv, 'stock-buyer-A', 'Stock A');
  const userB = createUser(testEnv, 'stock-buyer-B', 'Stock B');
  const headersA = authHeaders(testEnv, userA, 'stock-a-token');
  const headersB = authHeaders(testEnv, userB, 'stock-b-token');

  const initial = await jsonRequest(testEnv, '/api/market/listings?kind=item&sort=price_asc');
  assert.equal(initial.response.status, 200);
  assert.equal(initial.body.items.find(x => x.id === 'system:credential:F').remaining_quantity, 10);

  async function purchase(headers, tradeId, quantity) {
    return jsonRequest(testEnv, '/api/market/listings/system%3Acredential%3AF/buy', {
      method: 'POST', headers, body: JSON.stringify({ trade_id: tradeId, quantity }),
    });
  }
  assert.equal((await purchase(headersA, 'stock-trade-six', 6)).response.status, 200);
  assert.equal((await purchase(headersB, 'stock-trade-four', 4)).response.status, 200);
  const empty = await jsonRequest(testEnv, '/api/market/listings?kind=item&sort=price_asc');
  assert.equal(empty.body.items.some(item => item.id === 'system:credential:F'), false);
  assert.equal((await purchase(headersB, 'stock-trade-over', 1)).response.status, 409,
    'a sold-out shared voucher may not be bought by a different user');
  const row = testEnv.DB.db.prepare("SELECT total_quantity, remaining_quantity, restock_day FROM market_listings WHERE id='system:credential:F'").get();
  assert.equal(row.total_quantity, 10);
  assert.equal(row.remaining_quantity, 0);

  // Simulate yesterday's stock to exercise next-day replenishment. A fresh D1
  // binding also exercises the daily seed path rather than its in-isolate cache.
  testEnv.DB.db.prepare("UPDATE market_listings SET restock_day='2000-01-01' WHERE id='system:credential:F'").run();
  const nextDayEnv = { ...testEnv, DB: new Proxy(testEnv.DB, {}) };
  const replenished = await jsonRequest(nextDayEnv, '/api/market/listings?kind=item&sort=price_asc');
  assert.equal(replenished.response.status, 200);
  assert.equal(replenished.body.items.find(item => item.id === 'system:credential:F').remaining_quantity, 10);
  assert.equal(testEnv.DB.db.prepare("SELECT total_quantity FROM market_listings WHERE id='system:credential:F'").get().total_quantity, 10);
});

test('bloodlines forms and teammates survive listing, purchase and logical-kind filtering', async () => {
  const testEnv = env();
  const seller = createUser(testEnv, '900', 'Expanded Seller');
  const buyer = createUser(testEnv, '901', 'Expanded Buyer');
  const sellerHeaders = authHeaders(testEnv, seller, 'expanded-seller-token');
  const buyerHeaders = authHeaders(testEnv, buyer, 'expanded-buyer-token');

  const assets = [
    {
      id: 'listing-bloodline-1',
      kind: 'bloodline',
      name: '龙血',
      data: { 品质: 'D', 标签: ['血统'], 描述: '测试血统' },
    },
    {
      id: 'listing-form-1',
      kind: 'form',
      name: '超载',
      data: { 层级: 'Ⅲ', 标签: ['形态'], 状态: '完好' },
    },
    {
      id: 'listing-teammate-1',
      kind: 'teammate',
      name: '旅伴',
      data: { 是否队友: true, 层级: 'Ⅱ', 好感度: 50, 种族: '人类' },
    },
  ];

  for (const asset of assets) {
    const created = await jsonRequest(testEnv, '/api/market/listings', {
      method: 'POST',
      headers: sellerHeaders,
      body: JSON.stringify({
        id: asset.id,
        duration_hours: 24,
        asset: {
          kind: asset.kind,
          name: asset.name,
          quantity: 1,
          data: asset.data,
        },
        unit_price: 100,
      }),
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.listing.asset.kind, asset.kind);
  }

  const forms = await jsonRequest(testEnv, '/api/market/listings?kind=form&sort=latest');
  assert.equal(forms.response.status, 200);
  assert.ok(forms.body.items.some(item => item.id === 'listing-form-1'));
  assert.ok(forms.body.items.every(item => item.asset.kind === 'form'));

  const purchase = await jsonRequest(testEnv, '/api/market/listings/listing-teammate-1/buy', {
    method: 'POST',
    headers: buyerHeaders,
    body: JSON.stringify({ trade_id: 'trade-expanded-teammate', quantity: 1 }),
  });
  assert.equal(purchase.response.status, 200);
  assert.equal(purchase.body.trade.asset.kind, 'teammate');
  assert.equal(purchase.body.trade.asset.name, '旅伴');
});

test('system buyback accepts stacked items and ranked teammates with the same quality economy', async () => {
  const testEnv = env();
  const seller = createUser(testEnv, '910', 'Universal Buyback Seller');
  const headers = authHeaders(testEnv, seller, 'universal-buyback-token');

  const itemBuyback = await jsonRequest(testEnv, '/api/market/buybacks', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: 'buyback-item-stack',
      asset: {
        kind: 'item',
        name: 'F级材料',
        quantity: 3,
        data: { 名称: 'F级材料', 品质: 'F', 类型: '材料', 数量: 3 },
      },
    }),
  });
  assert.equal(itemBuyback.response.status, 201);
  assert.equal(itemBuyback.body.buyback.asset.kind, 'item');
  assert.equal(itemBuyback.body.buyback.quantity, 3);
  assert.equal(itemBuyback.body.buyback.amount, 9);

  const teammateQuote = await jsonRequest(testEnv, '/api/market/quote', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'buyback',
      asset: {
        kind: 'teammate',
        name: 'Ⅱ级旅伴',
        quantity: 1,
        data: { 是否队友: true, 层级: 'Ⅱ' },
      },
    }),
  });
  assert.equal(teammateQuote.response.status, 200);
  assert.equal(teammateQuote.body.quote.quality, 'E');
  assert.equal(teammateQuote.body.quote.total_price, 35);
});


test('server catalog aggregates commodities without retaining trade histories', async () => {
  const testEnv = env();
  const sellerA = createUser(testEnv, '1000', 'Catalog Seller A');
  const sellerB = createUser(testEnv, '1001', 'Catalog Seller B');
  const buyer = createUser(testEnv, '1002', 'Catalog Buyer');
  const a = authHeaders(testEnv, sellerA, 'catalog-a');
  const b = authHeaders(testEnv, sellerB, 'catalog-b');
  const buyerHeaders = authHeaders(testEnv, buyer, 'catalog-buyer');

  for (const [headers, id, quantity, price] of [
    [a, 'catalog-listing-a', 2, 30],
    [b, 'catalog-listing-b', 3, 25],
  ]) {
    const created = await jsonRequest(testEnv, '/api/market/listings', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id,
        duration_hours: 24,
        asset: {
          kind: 'item',
          name: '目录测试灵药',
          quantity,
          data: { 名称: '目录测试灵药', 品质: 'E', 类型: '消耗品', 数量: quantity },
        },
        unit_price: price,
      }),
    });
    assert.equal(created.response.status, 201);
  }

  const catalog = await jsonRequest(
    testEnv,
    '/api/market/catalog?kind=item&quality=E&subtype=%E6%B6%88%E8%80%97%E5%93%81&min_price=20&max_price=35&sort=price_asc',
  );
  assert.equal(catalog.response.status, 200);
  const product = catalog.body.items.find(item => item.name === '目录测试灵药');
  assert.ok(product);
  assert.equal(product.lowest_price, 25);
  assert.equal(product.total_stock, 5);
  assert.equal(product.listing_count, 2);
  assert.equal(product.seller_count, 2);
  assert.ok(catalog.body.facets.qualities.some(item => item.value === 'E'));
  assert.ok(catalog.body.facets.subtypes.some(item => item.value === '消耗品'));

  let detail = await jsonRequest(testEnv, '/api/market/catalog/' + encodeURIComponent(product.key));
  assert.equal(detail.response.status, 200);
  assert.deepEqual(
    detail.body.ladder.slice(0, 2).map(level => [level.price, level.stock]),
    [[25, 3], [30, 2]],
  );

  const cheap = detail.body.listings.find(item => item.unit_price === 25);
  const bought = await jsonRequest(testEnv, '/api/market/listings/' + encodeURIComponent(cheap.id) + '/buy', {
    method: 'POST',
    headers: buyerHeaders,
    body: JSON.stringify({ trade_id: 'catalog-history-trade', quantity: 2 }),
  });
  assert.equal(bought.response.status, 200);

  detail = await jsonRequest(testEnv, '/api/market/catalog/' + encodeURIComponent(product.key));
  assert.equal(detail.body.catalog.total_stock, 3);
  assert.equal(detail.body.catalog.lowest_price, 25);
  assert.equal(Object.hasOwn(detail.body, 'history'), false);
});

test('buy orders escrow value, fill atomically, deliver to buyer and refund unused escrow', async () => {
  const testEnv = env();
  const buyer = createUser(testEnv, '1100', 'Order Buyer');
  const seller = createUser(testEnv, '1101', 'Order Seller');
  const buyerHeaders = authHeaders(testEnv, buyer, 'order-buyer');
  const sellerHeaders = authHeaders(testEnv, seller, 'order-seller');

  const created = await jsonRequest(testEnv, '/api/market/orders', {
    method: 'POST',
    headers: buyerHeaders,
    body: JSON.stringify({
      id: 'order-material-1',
      kind: 'item',
      name: '求购材料',
      quality: 'E',
      subtype: '材料',
      quantity: 3,
      unit_price: 50,
      duration_hours: 24,
    }),
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.order.escrow_balance, 150);

  const filled = await jsonRequest(testEnv, '/api/market/orders/order-material-1/fill', {
    method: 'POST',
    headers: sellerHeaders,
    body: JSON.stringify({
      fill_id: 'order-fill-material-1',
      asset: {
        kind: 'item',
        name: '求购材料',
        quantity: 2,
        data: { 名称: '求购材料', 品质: 'E', 类型: '材料', 数量: 2 },
      },
    }),
  });
  assert.equal(filled.response.status, 200);
  assert.equal(filled.body.fill.quantity, 2);
  assert.equal(filled.body.fill.total_price, 100);

  const repeated = await jsonRequest(testEnv, '/api/market/orders/order-material-1/fill', {
    method: 'POST',
    headers: sellerHeaders,
    body: JSON.stringify({
      fill_id: 'order-fill-material-1',
      asset: {
        kind: 'item',
        name: '求购材料',
        quantity: 2,
        data: { 名称: '求购材料', 品质: 'E', 类型: '材料', 数量: 2 },
      },
    }),
  });
  assert.equal(repeated.response.status, 200);

  let sellerMe = await jsonRequest(testEnv, '/api/market/me', { headers: sellerHeaders });
  assert.equal(sellerMe.body.wallet.balance, 100);

  let buyerMe = await jsonRequest(testEnv, '/api/market/me', { headers: buyerHeaders });
  assert.equal(buyerMe.body.pending_order_deliveries.length, 1);
  assert.equal(buyerMe.body.buy_orders[0].remaining_quantity, 1);
  assert.equal(buyerMe.body.buy_orders[0].escrow_balance, 50);

  const delivered = await jsonRequest(testEnv, '/api/market/order-fills/order-fill-material-1/delivered', {
    method: 'POST',
    headers: buyerHeaders,
  });
  assert.equal(delivered.response.status, 200);
  assert.ok(delivered.body.fill.delivered_at);

  const cancelled = await jsonRequest(testEnv, '/api/market/orders/order-material-1/cancel', {
    method: 'POST',
    headers: buyerHeaders,
  });
  assert.equal(cancelled.response.status, 200);
  assert.equal(cancelled.body.order.status, 'cancelled');
  assert.equal(cancelled.body.payout.amount, 50);

  buyerMe = await jsonRequest(testEnv, '/api/market/me', { headers: buyerHeaders });
  assert.ok(buyerMe.body.pending_payouts.some(item => item.amount === 50));
});

test('asset swaps transfer both escrowed sides once and reject a second concurrent acceptor', async () => {
  const testEnv = env();
  const owner = createUser(testEnv, '1200', 'Swap Owner');
  const acceptor = createUser(testEnv, '1201', 'Swap Acceptor');
  const loser = createUser(testEnv, '1202', 'Swap Loser');
  const ownerHeaders = authHeaders(testEnv, owner, 'swap-owner');
  const acceptHeaders = authHeaders(testEnv, acceptor, 'swap-accept');
  const loserHeaders = authHeaders(testEnv, loser, 'swap-loser');

  const created = await jsonRequest(testEnv, '/api/market/swaps', {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      id: 'swap-contract-1',
      offered: {
        kind: 'item',
        name: '交换药剂',
        quantity: 2,
        data: { 名称: '交换药剂', 品质: 'F', 类型: '消耗品', 数量: 2 },
      },
      wanted: {
        kind: 'item',
        name: '交换材料',
        quality: 'E',
        subtype: '材料',
        quantity: 1,
      },
      duration_hours: 24,
    }),
  });
  assert.equal(created.response.status, 201);

  const accepted = await jsonRequest(testEnv, '/api/market/swaps/swap-contract-1/accept', {
    method: 'POST',
    headers: acceptHeaders,
    body: JSON.stringify({
      asset: {
        kind: 'item',
        name: '交换材料',
        quantity: 1,
        data: { 名称: '交换材料', 品质: 'E', 类型: '材料', 数量: 1 },
      },
    }),
  });
  assert.equal(accepted.response.status, 200);
  assert.equal(accepted.body.swap.status, 'completed');

  const second = await jsonRequest(testEnv, '/api/market/swaps/swap-contract-1/accept', {
    method: 'POST',
    headers: loserHeaders,
    body: JSON.stringify({
      asset: {
        kind: 'item',
        name: '交换材料',
        quantity: 1,
        data: { 名称: '交换材料', 品质: 'E', 类型: '材料', 数量: 1 },
      },
    }),
  });
  assert.equal(second.response.status, 409);

  const acceptorMe = await jsonRequest(testEnv, '/api/market/me', { headers: acceptHeaders });
  const ownerMe = await jsonRequest(testEnv, '/api/market/me', { headers: ownerHeaders });
  assert.equal(acceptorMe.body.pending_swap_transfers.length, 1);
  assert.equal(acceptorMe.body.pending_swap_transfers[0].asset.name, '交换药剂');
  assert.equal(ownerMe.body.pending_swap_transfers.length, 1);
  assert.equal(ownerMe.body.pending_swap_transfers[0].asset.name, '交换材料');
});

test('market moderation has no trade-history endpoint but can still delist and suspend without blocking recovery', async () => {
  const testEnv = env();
  const admin = createUser(testEnv, '1300', 'Market Admin');
  testEnv.DB.db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(admin.id);
  const seller = createUser(testEnv, '1301', 'Moderated Seller');
  const buyer = createUser(testEnv, '1302', 'Risk Buyer');
  const adminHeaders = authHeaders(testEnv, admin, 'market-admin');
  const sellerHeaders = authHeaders(testEnv, seller, 'market-seller');
  const buyerHeaders = authHeaders(testEnv, buyer, 'risk-buyer');

  await jsonRequest(testEnv, '/api/market/listings', {
    method: 'POST',
    headers: sellerHeaders,
    body: JSON.stringify({
      id: 'moderation-listing-1',
      duration_hours: 24,
      asset: {
        kind: 'item',
        name: '异常价格材料',
        quantity: 2,
        data: { 名称: '异常价格材料', 品质: 'F', 类型: '材料', 数量: 2 },
      },
      unit_price: 5000,
    }),
  });

  await jsonRequest(testEnv, '/api/market/listings/moderation-listing-1/buy', {
    method: 'POST',
    headers: buyerHeaders,
    body: JSON.stringify({ trade_id: 'moderation-risk-trade', quantity: 1 }),
  });

  const risky = await jsonRequest(testEnv, '/api/admin/market?view=trades&risk=1', {
    headers: adminHeaders,
  });
  assert.equal(risky.response.status, 404);
  assert.equal(risky.body.code, 'market_history_removed');

  const delisted = await jsonRequest(testEnv, '/api/admin/market-listings/moderation-listing-1/cancel', {
    method: 'POST',
    headers: adminHeaders,
  });
  assert.equal(delisted.response.status, 200);

  let sellerMe = await jsonRequest(testEnv, '/api/market/me', { headers: sellerHeaders });
  assert.equal(sellerMe.body.pending_returns.length, 1);
  assert.equal(sellerMe.body.pending_returns[0].quantity, 1);

  const suspended = await jsonRequest(testEnv, '/api/admin/market-users/' + seller.id + '/state', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ suspended: true, note: '异常交易测试' }),
  });
  assert.equal(suspended.response.status, 200);

  const blocked = await jsonRequest(testEnv, '/api/market/listings', {
    method: 'POST',
    headers: sellerHeaders,
    body: JSON.stringify({
      id: 'moderation-listing-2',
      duration_hours: 24,
      asset: {
        kind: 'item',
        name: '应被阻止',
        quantity: 1,
        data: { 名称: '应被阻止', 品质: 'F', 类型: '材料', 数量: 1 },
      },
      unit_price: 10,
    }),
  });
  assert.equal(blocked.response.status, 403);
  assert.equal(blocked.body.code, 'market_suspended');

  const returned = sellerMe.body.pending_returns[0];
  const recovery = await jsonRequest(
    testEnv,
    '/api/market/returns/' + encodeURIComponent(returned.id) + '/confirmed',
    { method: 'POST', headers: sellerHeaders },
  );
  assert.equal(recovery.response.status, 200);
});


test('grouped catalog purchase atomically spans price levels and is idempotent', async () => {
  const testEnv = env();
  const sellerA = createUser(testEnv, '1400', 'Grouped Seller A');
  const sellerB = createUser(testEnv, '1401', 'Grouped Seller B');
  const buyer = createUser(testEnv, '1402', 'Grouped Buyer');
  const sellerAHeaders = authHeaders(testEnv, sellerA, 'grouped-seller-a');
  const sellerBHeaders = authHeaders(testEnv, sellerB, 'grouped-seller-b');
  const buyerHeaders = authHeaders(testEnv, buyer, 'grouped-buyer');

  for (const [headers, id, quantity, price] of [
    [sellerAHeaders, 'grouped-listing-a', 2, 30],
    [sellerBHeaders, 'grouped-listing-b', 3, 25],
  ]) {
    const created = await jsonRequest(testEnv, '/api/market/listings', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id,
        duration_hours: 24,
        asset: {
          kind: 'item',
          name: '批量成交药剂',
          quantity,
          data: { 名称: '批量成交药剂', 品质: 'E', 类型: '消耗品', 数量: quantity },
        },
        unit_price: price,
      }),
    });
    assert.equal(created.response.status, 201);
  }

  const catalog = await jsonRequest(testEnv, '/api/market/catalog?kind=item&q=' + encodeURIComponent('批量成交药剂'));
  const product = catalog.body.items.find(item => item.name === '批量成交药剂');
  assert.ok(product);

  const quote = await jsonRequest(
    testEnv,
    '/api/market/catalog/' + encodeURIComponent(product.key) + '/quote?quantity=4',
    { headers: buyerHeaders },
  );
  assert.equal(quote.response.status, 200);
  assert.equal(quote.body.quote.total_price, 105);
  assert.deepEqual(quote.body.quote.levels, [
    { price: 25, quantity: 3 },
    { price: 30, quantity: 1 },
  ]);

  const purchase = await jsonRequest(
    testEnv,
    '/api/market/catalog/' + encodeURIComponent(product.key) + '/buy',
    {
      method: 'POST',
      headers: buyerHeaders,
      body: JSON.stringify({
        purchase_id: 'grouped-purchase-1',
        quantity: 4,
        expected_total: 105,
      }),
    },
  );
  assert.equal(purchase.response.status, 200);
  assert.equal(purchase.body.purchase.status, 'completed');
  assert.equal(purchase.body.purchase.quantity, 4);
  assert.equal(purchase.body.purchase.total_price, 105);
  assert.equal(purchase.body.trades.length, 2);
  assert.deepEqual(
    purchase.body.trades.map(trade => [trade.unit_price, trade.quantity, trade.market_fee, trade.seller_proceeds]),
    [[25, 3, 0, 75], [30, 1, 0, 30]],
  );
  const sellerAAccount = await jsonRequest(testEnv, '/api/market/me', { headers: sellerAHeaders });
  const sellerBAccount = await jsonRequest(testEnv, '/api/market/me', { headers: sellerBHeaders });
  assert.equal(sellerAAccount.body.wallet.balance, 30);
  assert.equal(sellerBAccount.body.wallet.balance, 75);

  const remainingA = testEnv.DB.db.prepare(
    'SELECT remaining_quantity FROM market_listings WHERE id = ?',
  ).get('grouped-listing-a');
  const remainingB = testEnv.DB.db.prepare(
    'SELECT remaining_quantity FROM market_listings WHERE id = ?',
  ).get('grouped-listing-b');
  assert.equal(remainingA.remaining_quantity, 1);
  assert.equal(remainingB.remaining_quantity, 0);

  const repeated = await jsonRequest(
    testEnv,
    '/api/market/catalog/' + encodeURIComponent(product.key) + '/buy',
    {
      method: 'POST',
      headers: buyerHeaders,
      body: JSON.stringify({
        purchase_id: 'grouped-purchase-1',
        quantity: 4,
        expected_total: 105,
      }),
    },
  );
  assert.equal(repeated.response.status, 200);
  assert.equal(repeated.body.trades.length, 2);
  assert.equal(
    testEnv.DB.db.prepare('SELECT remaining_quantity FROM market_listings WHERE id = ?').get('grouped-listing-a').remaining_quantity,
    1,
  );

  const detail = await jsonRequest(testEnv, '/api/market/catalog/' + encodeURIComponent(product.key));
  assert.equal(detail.response.status, 200);
  assert.equal(Object.hasOwn(detail.body, 'history'), false);
});

test('grouped purchase rejects stale total without partial stock changes', async () => {
  const testEnv = env();
  const seller = createUser(testEnv, '1410', 'Stale Seller');
  const buyer = createUser(testEnv, '1411', 'Stale Buyer');
  const other = createUser(testEnv, '1412', 'Stale Other');
  const sellerHeaders = authHeaders(testEnv, seller, 'stale-seller');
  const buyerHeaders = authHeaders(testEnv, buyer, 'stale-buyer');
  const otherHeaders = authHeaders(testEnv, other, 'stale-other');

  await jsonRequest(testEnv, '/api/market/listings', {
    method: 'POST',
    headers: sellerHeaders,
    body: JSON.stringify({
      id: 'stale-listing-cheap',
      duration_hours: 24,
      asset: {
        kind: 'item',
        name: '价格变化材料',
        quantity: 1,
        data: { 名称: '价格变化材料', 品质: 'E', 类型: '材料', 数量: 1 },
      },
      unit_price: 10,
    }),
  });
  await jsonRequest(testEnv, '/api/market/listings', {
    method: 'POST',
    headers: sellerHeaders,
    body: JSON.stringify({
      id: 'stale-listing-next',
      duration_hours: 24,
      asset: {
        kind: 'item',
        name: '价格变化材料',
        quantity: 2,
        data: { 名称: '价格变化材料', 品质: 'E', 类型: '材料', 数量: 2 },
      },
      unit_price: 20,
    }),
  });

  const catalog = await jsonRequest(testEnv, '/api/market/catalog?kind=item&q=' + encodeURIComponent('价格变化材料'));
  const product = catalog.body.items.find(item => item.name === '价格变化材料');
  assert.ok(product);

  const oldQuote = await jsonRequest(
    testEnv,
    '/api/market/catalog/' + encodeURIComponent(product.key) + '/quote?quantity=1',
    { headers: buyerHeaders },
  );
  assert.equal(oldQuote.body.quote.total_price, 10);

  const consumed = await jsonRequest(testEnv, '/api/market/listings/stale-listing-cheap/buy', {
    method: 'POST',
    headers: otherHeaders,
    body: JSON.stringify({ trade_id: 'stale-consume-trade', quantity: 1 }),
  });
  assert.equal(consumed.response.status, 200);

  const failed = await jsonRequest(
    testEnv,
    '/api/market/catalog/' + encodeURIComponent(product.key) + '/buy',
    {
      method: 'POST',
      headers: buyerHeaders,
      body: JSON.stringify({
        purchase_id: 'stale-grouped-purchase',
        quantity: 1,
        expected_total: 10,
      }),
    },
  );
  assert.equal(failed.response.status, 409);
  assert.equal(failed.body.code, 'market_price_changed');
  assert.equal(failed.body.details.current_total, 20);
  assert.equal(
    testEnv.DB.db.prepare('SELECT remaining_quantity FROM market_listings WHERE id = ?').get('stale-listing-next').remaining_quantity,
    2,
  );
  assert.equal(
    testEnv.DB.db.prepare('SELECT COUNT(*) AS count FROM market_purchases WHERE id = ?').get('stale-grouped-purchase').count,
    0,
  );

  const current = await jsonRequest(testEnv, '/api/market/catalog/' + encodeURIComponent(product.key));
  assert.equal(Object.hasOwn(current.body, 'history'), false);
});


test('market suspension hides active offers but still lets owners recover escrow', async () => {
  const testEnv = env();
  const admin = createUser(testEnv, '1500', 'Suspension Admin');
  testEnv.DB.db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(admin.id);
  const owner = createUser(testEnv, '1501', 'Suspended Owner');
  const other = createUser(testEnv, '1502', 'Suspension Other');
  const adminHeaders = authHeaders(testEnv, admin, 'suspension-admin');
  const ownerHeaders = authHeaders(testEnv, owner, 'suspension-owner');
  const otherHeaders = authHeaders(testEnv, other, 'suspension-other');

  const listing = await jsonRequest(testEnv, '/api/market/listings', {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      id: 'suspension-listing',
      duration_hours: 24,
      asset: {
        kind: 'item',
        name: '冻结卖家材料',
        quantity: 2,
        data: { 名称: '冻结卖家材料', 品质: 'E', 类型: '材料', 数量: 2 },
      },
      unit_price: 40,
    }),
  });
  assert.equal(listing.response.status, 201);

  const order = await jsonRequest(testEnv, '/api/market/orders', {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      id: 'suspension-order',
      kind: 'item',
      name: '冻结求购材料',
      quality: 'E',
      subtype: '材料',
      quantity: 1,
      unit_price: 50,
      duration_hours: 24,
    }),
  });
  assert.equal(order.response.status, 201);

  const swap = await jsonRequest(testEnv, '/api/market/swaps', {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      id: 'suspension-swap',
      offered: {
        kind: 'item',
        name: '冻结交换药剂',
        quantity: 1,
        data: { 名称: '冻结交换药剂', 品质: 'F', 类型: '消耗品', 数量: 1 },
      },
      wanted: {
        kind: 'item',
        name: '冻结交换材料',
        quality: 'E',
        subtype: '材料',
        quantity: 1,
      },
      duration_hours: 24,
    }),
  });
  assert.equal(swap.response.status, 201);

  const suspended = await jsonRequest(testEnv, '/api/admin/market-users/' + owner.id + '/state', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ suspended: true, note: '冻结测试' }),
  });
  assert.equal(suspended.response.status, 200);

  const catalog = await jsonRequest(
    testEnv,
    '/api/market/catalog?kind=item&q=' + encodeURIComponent('冻结卖家材料'),
  );
  assert.equal(catalog.body.items.some(item => item.name === '冻结卖家材料'), false);

  const directBuy = await jsonRequest(testEnv, '/api/market/listings/suspension-listing/buy', {
    method: 'POST',
    headers: otherHeaders,
    body: JSON.stringify({ trade_id: 'suspension-buy', quantity: 1 }),
  });
  assert.equal(directBuy.response.status, 409);

  const orders = await jsonRequest(testEnv, '/api/market/orders?q=' + encodeURIComponent('冻结求购材料'));
  assert.equal(orders.body.items.some(item => item.id === 'suspension-order'), false);
  const orderFill = await jsonRequest(testEnv, '/api/market/orders/suspension-order/fill', {
    method: 'POST',
    headers: otherHeaders,
    body: JSON.stringify({
      fill_id: 'suspension-order-fill',
      asset: {
        kind: 'item',
        name: '冻结求购材料',
        quantity: 1,
        data: { 名称: '冻结求购材料', 品质: 'E', 类型: '材料', 数量: 1 },
      },
    }),
  });
  assert.equal(orderFill.response.status, 409);

  const swaps = await jsonRequest(testEnv, '/api/market/swaps?q=' + encodeURIComponent('冻结交换'));
  assert.equal(swaps.body.items.some(item => item.id === 'suspension-swap'), false);
  const swapAccept = await jsonRequest(testEnv, '/api/market/swaps/suspension-swap/accept', {
    method: 'POST',
    headers: otherHeaders,
    body: JSON.stringify({
      asset: {
        kind: 'item',
        name: '冻结交换材料',
        quantity: 1,
        data: { 名称: '冻结交换材料', 品质: 'E', 类型: '材料', 数量: 1 },
      },
    }),
  });
  assert.equal(swapAccept.response.status, 409);

  const listingCancel = await jsonRequest(testEnv, '/api/market/listings/suspension-listing/cancel', {
    method: 'POST',
    headers: ownerHeaders,
  });
  assert.equal(listingCancel.response.status, 200);
  assert.equal(listingCancel.body.return.quantity, 2);

  const orderCancel = await jsonRequest(testEnv, '/api/market/orders/suspension-order/cancel', {
    method: 'POST',
    headers: ownerHeaders,
  });
  assert.equal(orderCancel.response.status, 200);
  assert.equal(orderCancel.body.payout.amount, 50);

  const swapCancel = await jsonRequest(testEnv, '/api/market/swaps/suspension-swap/cancel', {
    method: 'POST',
    headers: ownerHeaders,
  });
  assert.equal(swapCancel.response.status, 200);
  assert.equal(swapCancel.body.swap.status, 'cancelled');

  const ownerMe = await jsonRequest(testEnv, '/api/market/me', { headers: ownerHeaders });
  assert.ok(ownerMe.body.pending_returns.some(item => item.listing_id === 'suspension-listing'));
  assert.ok(ownerMe.body.pending_payouts.some(item => item.amount === 50));
  assert.ok(ownerMe.body.pending_swap_transfers.some(item => item.swap_id === 'suspension-swap'));
});

test('one save cannot exceed ten active listings, including sequential submissions', async () => {
  const testEnv = env();
  const seller = createUser(testEnv, '20110', 'Limited Seller');
  const headers = authHeaders(testEnv, seller, 'limit-token');
  for (let i = 0; i < 10; i += 1) {
    const result = await jsonRequest(testEnv, '/api/market/listings', {
      method: 'POST', headers,
      body: JSON.stringify({
        id: 'limit-listing-' + i,
        asset: { kind: 'item', name: '测试挂单药剂', quantity: 1, data: { 名称: '测试挂单药剂', 品质: 'E', 数量: 1 } },
        unit_price: 10,
        duration_hours: 24,
      }),
    });
    assert.equal(result.response.status, 201);
  }
  const denied = await jsonRequest(testEnv, '/api/market/listings', {
    method: 'POST', headers,
    body: JSON.stringify({
      id: 'limit-listing-over',
      asset: { kind: 'item', name: '测试挂单药剂', quantity: 1, data: { 名称: '测试挂单药剂', 品质: 'E', 数量: 1 } },
      unit_price: 10,
    }),
  });
  assert.equal(denied.response.status, 409);
  assert.equal(denied.body.code, 'market_listing_limit');
  const me = await jsonRequest(testEnv, '/api/market/me', { headers });
  assert.equal(me.body.active_listing_count, 10);
  assert.equal(Object.hasOwn(me.body, 'active_listing_save_count'), false);
  assert.equal(Object.hasOwn(me.body, 'active_listing_other_save_count'), false);

  const cancel = await jsonRequest(testEnv, '/api/market/listings/limit-listing-0/cancel',
    { method: 'POST', headers });
  assert.equal(cancel.response.status, 200);
  const retry = await jsonRequest(testEnv, '/api/market/listings', {
    method: 'POST', headers,
    body: JSON.stringify({
      id: 'limit-listing-new',
      asset: { kind: 'item', name: '测试挂单药剂', quantity: 1, data: { 名称: '测试挂单药剂', 品质: 'E', 数量: 1 } },
      unit_price: 10,
    }),
  });
  assert.equal(retry.response.status, 201);
});

test('different saves cannot take another save market inventory or earnings', async () => {
  const testEnv = env();
  const seller = createUser(testEnv, '20320', 'Scoped Seller');
  const buyer = createUser(testEnv, '20321', 'Scoped Buyer');
  const sellerA = authHeaders(testEnv, seller, 'scope-seller', 'save:first-slot');
  const sellerB = authHeaders(testEnv, seller, 'scope-seller-other', 'save:second-slot');
  const buyerA = authHeaders(testEnv, buyer, 'scope-buyer', 'save:buyer-slot');
  const buyerB = authHeaders(testEnv, buyer, 'scope-buyer-other', 'save:other-slot');
  const created = await jsonRequest(testEnv, '/api/market/listings', {
    method: 'POST', headers: sellerA,
    body: JSON.stringify({
      id: 'scope-listing-1',
      asset: { kind: 'item', name: '存档药剂', quantity: 2, data: { 名称: '存档药剂', 品质: 'E', 数量: 2 } },
      unit_price: 15,
    }),
  });
  assert.equal(created.response.status, 201);
  const otherMe = await jsonRequest(testEnv, '/api/market/me', { headers: sellerB });
  assert.equal(otherMe.body.listings.length, 0);
  assert.equal(otherMe.body.active_listing_count, 0, 'other saves must never consume this save listing slots');
  assert.equal(Object.hasOwn(otherMe.body, 'active_listing_other_save_count'), false);
  const firstMe = await jsonRequest(testEnv, '/api/market/me', { headers: sellerA });
  assert.equal(firstMe.body.active_listing_count, 1);
  assert.equal(Object.hasOwn(firstMe.body, 'active_listing_save_count'), false);
  const wrongCancel = await jsonRequest(testEnv, '/api/market/listings/scope-listing-1/cancel',
    { method: 'POST', headers: sellerB });
  assert.equal(wrongCancel.response.status, 404);
  const trade = await jsonRequest(testEnv, '/api/market/listings/scope-listing-1/buy', {
    method: 'POST', headers: buyerA,
    body: JSON.stringify({ trade_id: 'scope-trade-1', quantity: 1 }),
  });
  assert.equal(trade.response.status, 200);
  assert.equal(trade.body.trade.buyer_save_id, 'save:buyer-slot');
  assert.equal((await jsonRequest(testEnv, '/api/market/me', { headers: buyerB })).body.pending_deliveries.length, 0);
  assert.equal((await jsonRequest(testEnv, '/api/market/me', { headers: buyerA })).body.pending_deliveries.length, 1);
  assert.equal((await jsonRequest(testEnv, '/api/market/me', { headers: sellerB })).body.wallet.balance, 0);
  assert.ok((await jsonRequest(testEnv, '/api/market/me', { headers: sellerA })).body.wallet.balance > 0);
});

test('completed market receipts are pruned, but anything awaiting delivery or refund survives', async () => {
  const testEnv = env();
  const seller = createUser(testEnv, 'cleanup-seller', 'Cleanup Seller');
  const buyer = createUser(testEnv, 'cleanup-buyer', 'Cleanup Buyer');
  const sellerHeaders = authHeaders(testEnv, seller, 'cleanup-seller-session');
  const buyerHeaders = authHeaders(testEnv, buyer, 'cleanup-buyer-session');
  const since = Date.now() - 3 * 24 * 60 * 60 * 1000;

  await jsonRequest(testEnv, '/api/market/listings', {
    method: 'POST', headers: sellerHeaders,
    body: JSON.stringify({
      id: 'cleanup-sale', asset: {
        kind: 'item', name: '清理货物', quantity: 2,
        data: { 名称: '清理货物', 品质: 'E', 数量: 2 },
      }, unit_price: 10,
    }),
  });
  for (const id of ['cleanup-delivered', 'cleanup-pending']) {
    const purchase = await jsonRequest(testEnv, '/api/market/listings/cleanup-sale/buy', {
      method: 'POST', headers: buyerHeaders,
      body: JSON.stringify({ trade_id: id, quantity: 1 }),
    });
    assert.equal(purchase.response.status, 200);
  }
  const ack = await jsonRequest(testEnv, '/api/market/trades/cleanup-delivered/delivered', {
    method: 'POST', headers: buyerHeaders,
  });
  assert.equal(ack.response.status, 200);
  const db = testEnv.DB.db;
  db.prepare("UPDATE market_trades SET delivered_at = ? WHERE id = 'cleanup-delivered'").run(since);
  db.prepare("UPDATE market_trades SET created_at = ? WHERE id IN ('cleanup-delivered','cleanup-pending')").run(since);

  const before = await jsonRequest(testEnv, '/api/market/me', { headers: buyerHeaders });
  assert.equal(before.body.pending_deliveries.length, 1);
  assert.equal(Object.hasOwn(before.body, 'purchases'), false);
  const removed = await cleanupCompletedMarketRecords(testEnv, { now: Date.now() });
  assert.equal(removed.trades, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM market_trades WHERE id = 'cleanup-delivered'").get().count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM market_trades WHERE id = 'cleanup-pending'").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM market_listings WHERE id = 'cleanup-sale'").get().count, 1);
  const after = await jsonRequest(testEnv, '/api/market/me', { headers: buyerHeaders });
  assert.equal(after.body.pending_deliveries[0].id, 'cleanup-pending');
});

test('completed buybacks can be pruned after confirmed payout; pending payouts never are', async () => {
  const testEnv = env();
  const user = createUser(testEnv, 'cleanup-payout-owner', 'Cleanup Owner');
  const headers = authHeaders(testEnv, user, 'cleanup-payout-token');
  const result = await jsonRequest(testEnv, '/api/market/buybacks', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: 'cleanup-buyback',
      asset: { kind: 'equipment', name: '待回收武器', quantity: 1,
        data: { 名称: '待回收武器', 品质: 'E', 状态: 0 } },
    }),
  });
  assert.equal(result.response.status, 201);
  const db = testEnv.DB.db;
  const old = Date.now() - 3 * 24 * 60 * 60 * 1000;
  db.prepare('UPDATE market_buybacks SET created_at = ? WHERE id = ?').run(old, 'cleanup-buyback');
  db.prepare('UPDATE market_payouts SET created_at = ? WHERE id = ?').run(old, 'cleanup-buyback');
  await cleanupCompletedMarketRecords(testEnv);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM market_buybacks').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM market_payouts').get().count, 1);
  const confirmed = await jsonRequest(testEnv, '/api/market/payouts/cleanup-buyback/confirmed', {
    method: 'POST', headers,
  });
  assert.equal(confirmed.response.status, 200);
  db.prepare('UPDATE market_payouts SET confirmed_at = ? WHERE id = ?').run(old, 'cleanup-buyback');
  const removed = await cleanupCompletedMarketRecords(testEnv);
  assert.equal(removed.buybacks, 1);
  assert.equal(removed.payouts, 1);
});

test('seller receives funds but no server-only sale narration or acknowledgement endpoint', async () => {
  const testEnv = env();
  const seller = createUser(testEnv, 'no-broadcast-seller', 'Seller');
  const buyer = createUser(testEnv, 'no-broadcast-buyer', 'Buyer');
  const sellerHeaders = authHeaders(testEnv, seller, 'no-broadcast-seller-token');
  const buyerHeaders = authHeaders(testEnv, buyer, 'no-broadcast-buyer-token');
  const created = await jsonRequest(testEnv, '/api/market/listings', {
    method: 'POST', headers: sellerHeaders,
    body: JSON.stringify({
      id: 'no-broadcast-listing', asset: { kind: 'item', name: '播报测试材料', quantity: 1,
        data: { 名称: '播报测试材料', 品质: 'E', 数量: 1 } }, unit_price: 100,
    }),
  });
  assert.equal(created.response.status, 201);
  const bought = await jsonRequest(testEnv, '/api/market/listings/no-broadcast-listing/buy', {
    method: 'POST', headers: buyerHeaders,
    body: JSON.stringify({ trade_id: 'no-broadcast-sale', quantity: 1 }),
  });
  assert.equal(bought.response.status, 200);
  const me = await jsonRequest(testEnv, '/api/market/me', { headers: sellerHeaders });
  assert.ok(me.body.wallet.balance > 0, 'seller must still receive their proceeds');
  assert.equal(Object.hasOwn(me.body, 'pending_sale_broadcasts'), false);
  assert.equal(Object.hasOwn(me.body, 'pending_recycle_broadcasts'), false);
  const deprecated = await jsonRequest(testEnv, '/api/market/trades/no-broadcast-sale/announced', {
    method: 'POST', headers: sellerHeaders,
  });
  assert.equal(deprecated.response.status, 404);

  const delivered = await jsonRequest(testEnv, '/api/market/trades/no-broadcast-sale/delivered', {
    method: 'POST', headers: buyerHeaders,
  });
  assert.equal(delivered.response.status, 200);
  const old = Date.now() - 3 * 24 * 60 * 60 * 1000;
  testEnv.DB.db.prepare('UPDATE market_trades SET delivered_at = ? WHERE id = ?')
    .run(old, 'no-broadcast-sale');
  const removed = await cleanupCompletedMarketRecords(testEnv);
  assert.equal(removed.trades, 1, 'completed sales should not wait for narration');
  assert.equal(testEnv.DB.db.prepare('SELECT COUNT(*) AS count FROM market_trades WHERE id = ?')
    .get('no-broadcast-sale').count, 0);
});

test('expired listing auto-recycle does not queue narration and cleanup remains unblocked', async () => {
  const testEnv = env();
  const seller = createUser(testEnv, 'no-broadcast-recycle', 'Recycle Owner');
  const headers = authHeaders(testEnv, seller, 'no-broadcast-recycle-token');
  const created = await jsonRequest(testEnv, '/api/market/listings', {
    method: 'POST', headers,
    body: JSON.stringify({
      id: 'no-broadcast-expiring',
      asset: { kind: 'item', name: '到期道具', quantity: 1,
        data: { 名称: '到期道具', 品质: 'E', 数量: 1 } },
      unit_price: 10,
    }),
  });
  assert.equal(created.response.status, 201);
  const old = Date.now() - 3 * 24 * 60 * 60 * 1000;
  testEnv.DB.db.prepare('UPDATE market_listings SET expires_at = ?, recycle_at = ? WHERE id = ?')
    .run(old, old, 'no-broadcast-expiring');
  const me = await jsonRequest(testEnv, '/api/market/me', { headers });
  assert.equal(Object.hasOwn(me.body, 'pending_recycle_broadcasts'), false);
  assert.ok(me.body.wallet.balance >= 0);
  const recycle = testEnv.DB.db.prepare('SELECT * FROM market_recycles WHERE listing_id = ?')
    .get('no-broadcast-expiring');
  assert.ok(recycle, 'recycling should still credit the owner');
  testEnv.DB.db.prepare('UPDATE market_recycles SET credited_at = ? WHERE id = ?')
    .run(old, recycle.id);
  const removed = await cleanupCompletedMarketRecords(testEnv);
  assert.equal(removed.recycles, 1);
  const deprecated = await jsonRequest(testEnv, '/api/market/recycles/' + encodeURIComponent(recycle.id) + '/announced', {
    method: 'POST', headers,
  });
  assert.equal(deprecated.response.status, 404);
});

test('every save independently gets ten slots, even when another save holds ten active listings', async () => {
  const testEnv = env();
  const seller = createUser(testEnv, 'independent-save-cap', 'Independent Seller');
  const first = authHeaders(testEnv, seller, 'cap-first', 'save:first');
  const second = authHeaders(testEnv, seller, 'cap-second', 'save:second');
  const listing = id => ({
    id,
    asset: { kind: 'item', name: '容量测试', quantity: 1, data: { 名称: '容量测试', 数量: 1, 品质: 'E' } },
    unit_price: 20,
    duration_hours: 24,
  });
  for (let i = 0; i < 10; i++) {
    assert.equal((await jsonRequest(testEnv, '/api/market/listings', {
      method: 'POST', headers: first,
      body: JSON.stringify(listing('first-' + i)),
    })).response.status, 201);
  }
  let me = await jsonRequest(testEnv, '/api/market/me', { headers: second });
  assert.equal(me.body.active_listing_count, 0);
  assert.equal((await jsonRequest(testEnv, '/api/market/listings', {
    method: 'POST', headers: second,
    body: JSON.stringify(listing('second-0')),
  })).response.status, 201, 'another save listing cannot block this save');
  me = await jsonRequest(testEnv, '/api/market/me', { headers: second });
  assert.equal(me.body.active_listing_count, 1);
  for (let i = 1; i < 10; i++) {
    assert.equal((await jsonRequest(testEnv, '/api/market/listings', {
      method: 'POST', headers: second,
      body: JSON.stringify(listing('second-' + i)),
    })).response.status, 201);
  }
  const firstFull = await jsonRequest(testEnv, '/api/market/listings', {
    method: 'POST', headers: first,
    body: JSON.stringify(listing('first-over')),
  });
  const secondFull = await jsonRequest(testEnv, '/api/market/listings', {
    method: 'POST', headers: second,
    body: JSON.stringify(listing('second-over')),
  });
  assert.equal(firstFull.response.status, 409);
  assert.equal(firstFull.body.code, 'market_listing_limit');
  assert.equal(secondFull.response.status, 409);
  assert.equal(secondFull.body.code, 'market_listing_limit');
  assert.equal((await jsonRequest(testEnv, '/api/market/me', { headers: first })).body.active_listing_count, 10);
  assert.equal((await jsonRequest(testEnv, '/api/market/me', { headers: second })).body.active_listing_count, 10);
});


test('legacy 30-unit voucher stock is reduced to ten without granting extra same-day units', async () => {
  const testEnv = env();
  const before = await jsonRequest(testEnv, '/api/market/listings?kind=item');
  assert.equal(before.response.status, 200);
  const db = testEnv.DB.db;
  db.prepare("UPDATE market_listings SET total_quantity = 30, remaining_quantity = 22, status = 'active' WHERE id = 'system:credential:F'").run();
  const reloaded = await jsonRequest({ ...testEnv, DB: new Proxy(testEnv.DB, {}) }, '/api/market/listings?kind=item');
  assert.equal(reloaded.response.status, 200);
  const fVoucher = reloaded.body.items.find(x => x.id === 'system:credential:F');
  assert.ok(fVoucher);
  assert.equal(fVoucher.remaining_quantity, 2, 'eight sold under the old pool leave only two under the new cap');
  const record = db.prepare("SELECT total_quantity, remaining_quantity FROM market_listings WHERE id = 'system:credential:F'").get();
  assert.equal(record.total_quantity, 10);
  assert.equal(record.remaining_quantity, 2);
});

test('one-time staging stock reset hides all old auctions but preserves workshop users and unsettled claims', async () => {
  const testEnv = env();
  const seller = createUser(testEnv, 'reset-seller', 'Reset Seller');
  const buyer = createUser(testEnv, 'reset-buyer', 'Reset Buyer');
  const sellerHeaders = authHeaders(testEnv, seller, 'reset-seller-token');
  const buyerHeaders = authHeaders(testEnv, buyer, 'reset-buyer-token');
  const oldListing = await jsonRequest(testEnv, '/api/market/listings', {
    method: 'POST', headers: sellerHeaders, body: JSON.stringify({
      id: 'reset-old-listing',
      asset: {kind:'item',name:'旧测试物品',quantity:2,data:{名称:'旧测试物品',品质:'E',数量:2}},
      unit_price:42,
    }),
  });
  assert.equal(oldListing.response.status, 201);
  const trade = await jsonRequest(testEnv, '/api/market/listings/reset-old-listing/buy', {
    method: 'POST', headers: buyerHeaders,
    body: JSON.stringify({trade_id:'reset-old-pending-trade',quantity:1}),
  });
  assert.equal(trade.response.status, 200);
  const db = testEnv.DB.db;
  const userCountBefore = db.prepare('SELECT COUNT(*) AS total FROM users').get().total;
  const sellerBalanceBefore = (await jsonRequest(testEnv, '/api/market/me', {headers:sellerHeaders})).body.wallet.balance;
  const stockBefore = db.prepare("SELECT COUNT(*) AS total FROM market_listings WHERE status = 'active' AND remaining_quantity > 0").get().total;
  assert.ok(stockBefore > 0);
  const sql = readFileSync(new URL('../migrations/0023_deactivate_old_market_inventory.sql', import.meta.url), 'utf8');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(sql);
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM market_listings WHERE status = 'active' AND remaining_quantity > 0").get().total, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM market_catalog WHERE total_stock > 0').get().total, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM users').get().total, userCountBefore);
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM market_trades WHERE id = 'reset-old-pending-trade'").get().total, 1);
  const afterSeller = (await jsonRequest(testEnv, '/api/market/me', {headers:sellerHeaders})).body;
  assert.equal(afterSeller.wallet.balance, sellerBalanceBefore);
  assert.equal(afterSeller.listings.some(item => item.id === 'reset-old-listing'), false,
    'archived testing listings must disappear from my auctions too');
  // A freshly deployed Worker has a new D1 binding; only its six legitimate
  // daily credential listings may reappear, and each starts at ten.
  const fresh = { ...testEnv, DB: new Proxy(testEnv.DB, {}) };
  const after = await jsonRequest(fresh, '/api/market/listings?limit=60');
  assert.equal(after.response.status, 200);
  assert.equal(after.body.items.length, 6);
  assert.ok(after.body.items.every(item => item.id.startsWith('system:credential:') && item.remaining_quantity === 10));
  assert.equal(after.body.items.some(item => item.id === 'reset-old-listing'), false);
  const buyerState = await jsonRequest(fresh, '/api/market/me', {headers:buyerHeaders});
  assert.equal(buyerState.body.pending_deliveries.length, 1, 'pending claims are still recoverable');
});

test('negotiated deal accepts exactly one of multiple escrowed bids and refunds the others', async () => {
  const testEnv=env();
  const owner=createUser(testEnv,'negotiated-owner','发布者');
  const bidderA=createUser(testEnv,'negotiated-A','竞价者甲');
  const bidderB=createUser(testEnv,'negotiated-B','竞价者乙');
  const hOwner=authHeaders(testEnv,owner,'negotiated-owner-session','save:owner');
  const hA=authHeaders(testEnv,bidderA,'negotiated-a-session','save:bidder-a');
  const hB=authHeaders(testEnv,bidderB,'negotiated-b-session','save:bidder-b');
  const item=(name,quantity=1)=>({kind:'item',name,quantity,data:{名称:name,品质:'D',数量:quantity}});
  const created=await jsonRequest(testEnv,'/api/market/deals',{method:'POST',headers:hOwner,body:JSON.stringify({
    id:'negotiated:deal1',title:'寻找有治疗能力的伙伴',wanted:'不限定姓名，只要求能治疗',
    offer:{coins:1000,assets:[item('星屑',2),{kind:'bloodline',name:'星灵血统',quantity:1,data:{名称:'星灵血统',品质:'D'}}]},
    duration_hours:48,
  })});
  assert.equal(created.response.status,201,JSON.stringify(created.body));
  const bidA=await jsonRequest(testEnv,'/api/market/deals/negotiated%3Adeal1/bids',{method:'POST',headers:hA,body:JSON.stringify({
    id:'negotiated:bidA',offer:{coins:500,assets:[item('治疗药剂',2)]},note:'附带治疗药剂',
  })});
  assert.equal(bidA.response.status,201);
  const bidB=await jsonRequest(testEnv,'/api/market/deals/negotiated%3Adeal1/bids',{method:'POST',headers:hB,body:JSON.stringify({
    id:'negotiated:bidB',offer:{coins:0,assets:[{kind:'teammate',name:'精灵医师',quantity:1,data:{是否队友:true,好感度:70,名称:'精灵医师'}}]},
    note:'可以群体治疗',
  })});
  assert.equal(bidB.response.status,201);
  const sameBidder=await jsonRequest(testEnv,'/api/market/deals/negotiated%3Adeal1/bids',{method:'POST',headers:hA,body:JSON.stringify({
    id:'negotiated:bidA2',offer:{coins:200},
  })});
  assert.equal(sameBidder.response.status,409,'a bidder can escrow only one pending bid per deal');
  const browse=await jsonRequest(testEnv,'/api/market/deals');
  assert.equal(browse.body.items[0].bid_count,2);
  const guestDetail=await jsonRequest(testEnv,'/api/market/deals/negotiated%3Adeal1',{headers:hA});
  assert.equal(guestDetail.body.bids.length,1,'other offers are private to the deal owner');
  const ownerDetail=await jsonRequest(testEnv,'/api/market/deals/negotiated%3Adeal1',{headers:hOwner});
  assert.equal(ownerDetail.body.bids.length,2);
  const unauthorized=await jsonRequest(testEnv,'/api/market/deals/negotiated%3Adeal1/bids/negotiated%3AbidA/accept',
    {method:'POST',headers:hA});
  assert.equal(unauthorized.response.status,404);

  const accepted=await jsonRequest(testEnv,'/api/market/deals/negotiated%3Adeal1/bids/negotiated%3AbidB/accept',
    {method:'POST',headers:hOwner});
  assert.equal(accepted.response.status,200);
  assert.equal(accepted.body.deal.accepted_bid_id,'negotiated:bidB');
  const repeat=await jsonRequest(testEnv,'/api/market/deals/negotiated%3Adeal1/bids/negotiated%3AbidB/accept',
    {method:'POST',headers:hOwner});
  assert.equal(repeat.response.status,200,'retrying accepted request is idempotent');
  const rejected=await jsonRequest(testEnv,'/api/market/deals/negotiated%3Adeal1/bids/negotiated%3AbidA/accept',
    {method:'POST',headers:hOwner});
  assert.equal(rejected.response.status,409,'only one bid wins');

  const ownerMe=await jsonRequest(testEnv,'/api/market/me',{headers:hOwner});
  const winnerMe=await jsonRequest(testEnv,'/api/market/me',{headers:hB});
  const loserMe=await jsonRequest(testEnv,'/api/market/me',{headers:hA});
  assert.equal(ownerMe.body.pending_deal_transfers.length,1);
  assert.equal(ownerMe.body.pending_deal_transfers[0].offer.assets[0].name,'精灵医师');
  assert.equal(winnerMe.body.pending_deal_transfers.length,1);
  assert.equal(winnerMe.body.pending_deal_transfers[0].offer.coins,1000);
  assert.equal(winnerMe.body.pending_deal_transfers[0].offer.assets.length,2);
  assert.equal(loserMe.body.pending_deal_transfers.length,1);
  assert.equal(loserMe.body.pending_deal_transfers[0].offer.coins,500);
  assert.equal(loserMe.body.pending_deal_transfers[0].offer.assets[0].name,'治疗药剂');

  const wrongSave=authHeaders(testEnv,bidderB,'negotiated-b-other-session','save:another');
  const id=encodeURIComponent(winnerMe.body.pending_deal_transfers[0].id);
  assert.equal((await jsonRequest(testEnv,'/api/market/deal-transfers/'+id+'/confirmed',
    {method:'POST',headers:wrongSave})).response.status,404,'claims belong to the originating save');
  assert.equal((await jsonRequest(testEnv,'/api/market/deal-transfers/'+id+'/confirmed',
    {method:'POST',headers:hB})).response.status,200);
  assert.equal((await jsonRequest(testEnv,'/api/market/deal-transfers/'+id+'/confirmed',
    {method:'POST',headers:hB})).response.status,200);
  assert.equal((await jsonRequest(testEnv,'/api/market/me',{headers:hB})).body.pending_deal_transfers.length,0);
  const transfers=testEnv.DB.db.prepare("SELECT COUNT(*) AS total FROM market_deal_transfers WHERE deal_id='negotiated:deal1'").get();
  assert.equal(transfers.total,3,'accept retry never duplicates winner or loser receipts');
});

test('negotiated deal cancellation and bid withdrawal refund all sides without an auto-trade', async () => {
  const testEnv=env();
  const owner=createUser(testEnv,'withdraw-owner','撤回发单');
  const bidder=createUser(testEnv,'withdraw-bidder','撤回报价');
  const hOwner=authHeaders(testEnv,owner,'withdraw-owner-session','save:owner');
  const hBidder=authHeaders(testEnv,bidder,'withdraw-bidder-session','save:bidder');
  const deal=await jsonRequest(testEnv,'/api/market/deals',{method:'POST',headers:hOwner,body:JSON.stringify({
    id:'withdraw:deal',title:'寻找装备',wanted:'任意具有防护能力的装备',
    offer:{coins:33},duration_hours:24,
  })});
  assert.equal(deal.response.status,201,JSON.stringify(deal.body));
  assert.equal((await jsonRequest(testEnv,'/api/market/deals/withdraw%3Adeal/bids',
    {method:'POST',headers:hBidder,body:JSON.stringify({
      id:'withdraw:bid1',offer:{coins:50},
    })})).response.status,201);
  const withdrawn=await jsonRequest(testEnv,'/api/market/deal-bids/withdraw%3Abid1/withdraw',
    {method:'POST',headers:hBidder});
  assert.equal(withdrawn.response.status,200);
  assert.equal(withdrawn.body.bid.status,'withdrawn');
  assert.equal((await jsonRequest(testEnv,'/api/market/me',{headers:hBidder}))
    .body.pending_deal_transfers[0].offer.coins,50);
  const closed=await jsonRequest(testEnv,'/api/market/deals/withdraw%3Adeal/cancel',
    {method:'POST',headers:hOwner});
  assert.equal(closed.response.status,200);
  assert.equal(closed.body.deal.status,'cancelled');
  const again=await jsonRequest(testEnv,'/api/market/deals/withdraw%3Adeal/cancel',
    {method:'POST',headers:hOwner});
  assert.equal(again.response.status,200);
  assert.equal((await jsonRequest(testEnv,'/api/market/me',{headers:hOwner}))
    .body.pending_deal_transfers[0].offer.coins,33);
  assert.equal(testEnv.DB.db.prepare("SELECT COUNT(*) AS count FROM market_deal_transfers WHERE deal_id='withdraw:deal'").get().count,2);
  const after=await jsonRequest(testEnv,'/api/market/deals/withdraw%3Adeal/bids',
    {method:'POST',headers:hBidder,body:JSON.stringify({id:'withdraw:late',offer:{coins:1}})});
  assert.equal(after.response.status,409);
});

test('negotiated orders expire and every unaccepted offer becomes a persistent refund claim',async()=>{
  const testEnv=env();
  const owner=createUser(testEnv,'expire-deal-owner','到期发单');
  const bidder=createUser(testEnv,'expire-deal-bidder','到期报价');
  const hOwner=authHeaders(testEnv,owner,'expire-deal-owner-session');
  const hBidder=authHeaders(testEnv,bidder,'expire-deal-bidder-session');
  const created=await jsonRequest(testEnv,'/api/market/deals',{method:'POST',headers:hOwner,body:JSON.stringify({
    id:'expire:deal',title:'招募伙伴',wanted:'寻找侦察型伙伴',offer:{coins:700},duration_hours:24,
  })});
  assert.equal(created.response.status,201,JSON.stringify(created.body));
  assert.equal((await jsonRequest(testEnv,'/api/market/deals/expire%3Adeal/bids',{method:'POST',headers:hBidder,body:JSON.stringify({
    id:'expire:bid',offer:{coins:10},note:'我想尝试',
  })})).response.status,201);
  testEnv.DB.db.prepare("UPDATE market_deals SET expires_at=? WHERE id='expire:deal'").run(Date.now()-1000);
  const browse=await jsonRequest(testEnv,'/api/market/deals');
  assert.equal(browse.body.items.length,0);
  const ownerMe=await jsonRequest(testEnv,'/api/market/me',{headers:hOwner});
  const bidderMe=await jsonRequest(testEnv,'/api/market/me',{headers:hBidder});
  assert.equal(ownerMe.body.pending_deal_transfers[0].offer.coins,700);
  assert.equal(bidderMe.body.pending_deal_transfers[0].offer.coins,10);
  assert.equal(testEnv.DB.db.prepare("SELECT status FROM market_deal_bids WHERE id='expire:bid'").get().status,'rejected');
});
