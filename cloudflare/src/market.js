import { HttpError, json, readJson } from './http.js';
import { assertMarketUserAllowed } from './market-access.js';
import {
  ensureMarketCatalog,
  getMarketPriceHistory,
  getMarketProduct,
  listMarketProducts,
  listProductRows,
  marketAssetKey,
  recordMarketTrade,
  referenceForAsset,
  refreshMarketProduct,
} from './market-catalog.js';
import { marketOrderStateForUser } from './market-orders.js';
import { marketBarterStateForUser } from './market-barter.js';
import {
  MARKET_AUCTION_DURATIONS,
  marketAuctionQuote,
  marketBuybackQuote,
  marketCredentialSpecs,
  marketDayKey,
  marketRecycleAt,
  marketSaleSettlement,
} from './market-economy.js';

const MARKET_KINDS = new Set(['equipment', 'item', 'skill', 'bloodline', 'form', 'teammate']);
const MARKET_ID_RE = /^[A-Za-z0-9:_-]{6,96}$/u;
const MAX_ASSET_BYTES = 32 * 1024;
const MAX_NAME_LENGTH = 120;
const MAX_PRICE = 1_000_000_000;
const MAX_QUANTITY = 9999;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;
const TEST_VENDOR_DISCORD_ID = '__market_test_vendor__';
const TEST_VENDOR_USERNAME = 'market-test-vendor';
const TEST_VENDOR_DISPLAY_NAME = '轮回集市测试员 · 虚拟账号';
const SYSTEM_VENDOR_DISCORD_ID = '__market_system_vendor__';
const SYSTEM_VENDOR_USERNAME = 'market-system-vendor';
const SYSTEM_VENDOR_DISPLAY_NAME = '悖论公证所 · 系统柜台';
const TEST_VENDOR_FIXTURES = [
  {
    id: 'test-vendor:item:healing-potion',
    kind: 'item',
    name: '测试用恢复药剂',
    quantity: 20,
    unitPrice: 25,
    data: {
      品质: 'F', 类型: '消耗品', 数量: 20, 标签: ['测试商品'],
      效果: { 恢复: '用于验证空间集市购买与堆叠写回' },
      描述: '虚拟卖家测试商品。价格刻意设置很低。', 状态: 0,
    },
  },
  {
    id: 'test-vendor:item:rare-material',
    kind: 'item',
    name: '测试用稀有材料',
    quantity: 12,
    unitPrice: 40,
    data: {
      品质: 'E', 类型: '材料', 数量: 12, 标签: ['测试商品'],
      效果: {}, 描述: '用于测试多数量购买与剩余库存。', 状态: 0,
    },
  },
  {
    id: 'test-vendor:equipment:iron-sword',
    kind: 'equipment',
    name: '测试铁剑',
    quantity: 1,
    unitPrice: 60,
    data: {
      类型: 0, 状态: 0, 品质: 'F', 标签: ['测试商品'],
      原始属性: { 攻击: 1 }, 效果: {},
      描述: '用于测试装备购买、入包与同名冲突。', 消耗: '',
    },
  },
  {
    id: 'test-vendor:equipment:guard-cloak',
    kind: 'equipment',
    name: '测试守护披风',
    quantity: 1,
    unitPrice: 70,
    data: {
      类型: 4, 状态: 0, 品质: 'F', 标签: ['测试商品'],
      原始属性: { 防御: 1 }, 效果: {},
      描述: '第二件测试装备，避免单件买完后无法继续测。', 消耗: '',
    },
  },
  {
    id: 'test-vendor:skill:quick-step',
    kind: 'skill',
    name: '测试技能·疾步',
    quantity: 1,
    unitPrice: 50,
    data: {
      等级: 1, 品质: 'F', 类型: 0, 消耗: '少量体力',
      效果: { 说明: '短时间提升移动能力' },
      描述: '用于测试技能购买与写入。', 标签: ['测试商品'],
    },
  },
  {
    id: 'test-vendor:skill:focus',
    kind: 'skill',
    name: '测试技能·专注',
    quantity: 1,
    unitPrice: 55,
    data: {
      等级: 1, 品质: 'F', 类型: 1, 消耗: '少量精神',
      效果: { 说明: '短时间提升专注能力' },
      描述: '第二个测试技能。', 标签: ['测试商品'],
    },
  },
];

function nowMs() {
  return Date.now();
}

function integer(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function positiveInteger(value, { min = 1, max = Number.MAX_SAFE_INTEGER, code = 'invalid_number', label = '数值' } = {}) {
  const number = integer(value, NaN);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new HttpError(400, code, `${label}必须是 ${min}-${max} 的整数`);
  }
  return number;
}

function marketId(value, label = 'ID') {
  const id = String(value || '').trim();
  if (!MARKET_ID_RE.test(id)) {
    throw new HttpError(400, 'market_invalid_id', `${label} 格式无效`);
  }
  return id;
}

function text(value, maxLength = MAX_NAME_LENGTH) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function parseJson(value, fallback = {}) {
  try { return JSON.parse(String(value || '')); } catch { return fallback; }
}

function storageKind(kind, { buyback = false } = {}) {
  if (buyback) return 'equipment';
  return ['equipment', 'item', 'skill'].includes(kind) ? kind : 'item';
}

function logicalKind(row) {
  return String(row?.market_kind || row?.asset_kind || '');
}

function assetFromBody(input) {
  const kind = String(input?.kind || '').trim();
  if (!MARKET_KINDS.has(kind)) {
    throw new HttpError(400, 'market_invalid_kind', '资产类型无效');
  }

  const name = text(input?.name);
  if (!name) throw new HttpError(400, 'market_invalid_name', '资产名称不能为空');

  const data = input?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpError(400, 'market_invalid_asset', '资产数据无效');
  }

  const quantity = kind === 'item'
    ? positiveInteger(input?.quantity, { max: MAX_QUANTITY, code: 'market_invalid_quantity', label: '数量' })
    : 1;

  const assetJson = JSON.stringify(data);
  if (new TextEncoder().encode(assetJson).byteLength > MAX_ASSET_BYTES) {
    throw new HttpError(413, 'market_asset_too_large', '单件交易资产数据过大');
  }

  return { kind, name, quantity, data, assetJson };
}

function parseAsset(kind, name, assetJson, quantity) {
  return {
    kind: String(kind || ''),
    name: String(name || ''),
    quantity: integer(quantity, 1),
    data: parseJson(assetJson, {}),
  };
}

function listingFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    market_key: row.market_key || '',
    asset: parseAsset(logicalKind(row), row.asset_name, row.asset_json, row.remaining_quantity),
    unit_price: integer(row.unit_price),
    total_quantity: integer(row.total_quantity),
    remaining_quantity: integer(row.remaining_quantity),
    status: row.status,
    duration_hours: integer(row.duration_hours, 72),
    expires_at: integer(row.expires_at, 0),
    recycle_at: integer(row.recycle_at, 0),
    listing_fee: integer(row.listing_fee, 0),
    is_system: integer(row.is_system, 0) === 1,
    restock_day: row.restock_day || '',
    expired: integer(row.is_system, 0) !== 1
      && integer(row.expires_at, 0) > 0
      && integer(row.expires_at, 0) <= nowMs(),
    created_at: integer(row.created_at),
    updated_at: integer(row.updated_at),
    seller: {
      id: integer(row.seller_user_id),
      display_name: row.seller_display_name || row.seller_username || '匿名轮回者',
      username: row.seller_username || '',
    },
  };
}

function tradeFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    listing_id: row.listing_id,
    market_key: row.market_key || '',
    asset: parseAsset(logicalKind(row), row.asset_name, row.asset_json, row.quantity),
    quantity: integer(row.quantity),
    unit_price: integer(row.unit_price),
    total_price: integer(row.total_price),
    market_fee: integer(row.market_fee, 0),
    seller_proceeds: integer(row.seller_proceeds, integer(row.total_price)),
    delivered_at: row.delivered_at == null ? null : integer(row.delivered_at),
    created_at: integer(row.created_at),
    seller: {
      id: integer(row.seller_user_id),
      display_name: row.seller_display_name || row.seller_username || '匿名轮回者',
      username: row.seller_username || '',
    },
    buyer: {
      id: integer(row.buyer_user_id),
      display_name: row.buyer_display_name || row.buyer_username || '匿名轮回者',
      username: row.buyer_username || '',
    },
  };
}

function returnFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    listing_id: row.listing_id,
    market_key: row.market_key || '',
    asset: parseAsset(logicalKind(row), row.asset_name, row.asset_json, row.quantity),
    quantity: integer(row.quantity),
    confirmed_at: row.confirmed_at == null ? null : integer(row.confirmed_at),
    created_at: integer(row.created_at),
  };
}

function payoutFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    amount: integer(row.amount),
    confirmed_at: row.confirmed_at == null ? null : integer(row.confirmed_at),
    created_at: integer(row.created_at),
  };
}

function recycleFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    listing_id: row.listing_id,
    market_key: row.market_key || '',
    asset: parseAsset(logicalKind(row), row.asset_name, row.asset_json, row.quantity),
    quantity: integer(row.quantity, 1),
    amount: integer(row.amount),
    credited_at: row.credited_at == null ? null : integer(row.credited_at),
    created_at: integer(row.created_at),
  };
}

async function all(env, sql, args = []) {
  const response = await env.DB.prepare(sql).bind(...args).all();
  return response?.results || [];
}

async function first(env, sql, args = []) {
  return env.DB.prepare(sql).bind(...args).first();
}

async function ensureSyntheticUser(env, { discordId, username, displayName }) {
  const now = nowMs();
  await env.DB.prepare(
    `INSERT INTO users
      (discord_id, username, display_name, avatar, is_admin, is_moderator, is_banned, ban_reason, created_at, updated_at)
     VALUES (?, ?, ?, NULL, 0, 0, 0, '', ?, ?)
     ON CONFLICT(discord_id) DO UPDATE SET
       username = excluded.username,
       display_name = excluded.display_name,
       updated_at = excluded.updated_at`,
  ).bind(discordId, username, displayName, now, now).run();

  return first(env, 'SELECT id FROM users WHERE discord_id = ? LIMIT 1', [discordId]);
}

async function ensureSystemCredentialListings(env) {
  const channel = String(env.CLIENT_UPDATE_CHANNEL || '').trim().toLowerCase();
  if (channel !== 'testing') return;

  const seller = await ensureSyntheticUser(env, {
    discordId: SYSTEM_VENDOR_DISCORD_ID,
    username: SYSTEM_VENDOR_USERNAME,
    displayName: SYSTEM_VENDOR_DISPLAY_NAME,
  });
  if (!seller?.id) return;

  const now = nowMs();
  const day = marketDayKey(now);
  await env.DB.prepare(
    `UPDATE market_listings
     SET status = 'cancelled', remaining_quantity = 0, updated_at = ?
     WHERE id IN ('system:credential:S', 'system:credential:SS', 'system:credential:SSS')
       AND is_system = 1`,
  ).bind(now).run();
  for (const spec of marketCredentialSpecs()) {
    const existing = await first(
      env,
      'SELECT id, restock_day, asset_json, unit_price FROM market_listings WHERE id = ? LIMIT 1',
      [spec.id],
    );
    const data = {
      名称: spec.name,
      品质: spec.quality,
      类型: '权限凭证',
      数量: spec.quantity,
      标签: ['主神空间', '权限凭证'],
      描述: '悖论公证所系统柜台每日限量补货。',
    };
    const assetJson = JSON.stringify(data);
    if (!existing) {
      await env.DB.prepare(
        `INSERT INTO market_listings
          (id, seller_user_id, asset_kind, asset_name, asset_json, unit_price,
           total_quantity, remaining_quantity, status, duration_hours, expires_at, recycle_at,
           listing_fee, is_system, restock_day, created_at, updated_at)
         VALUES (?, ?, 'item', ?, ?, ?, ?, ?, 'active', 0, 0, 0, 0, 1, ?, ?, ?)`,
      ).bind(
        spec.id,
        seller.id,
        spec.name,
        assetJson,
        spec.unit_price,
        spec.quantity,
        spec.quantity,
        day,
        now,
        now,
      ).run();
      continue;
    }

    if (String(existing.restock_day || '') !== day) {
      await env.DB.prepare(
        `UPDATE market_listings
         SET seller_user_id = ?,
             asset_name = ?,
             asset_json = ?,
             unit_price = ?,
             total_quantity = ?,
             remaining_quantity = ?,
             status = 'active',
             duration_hours = 0,
             expires_at = 0,
             recycle_at = 0,
             listing_fee = 0,
             is_system = 1,
             restock_day = ?,
             updated_at = ?
         WHERE id = ?`,
      ).bind(
        seller.id,
        spec.name,
        assetJson,
        spec.unit_price,
        spec.quantity,
        spec.quantity,
        day,
        now,
        spec.id,
      ).run();
      continue;
    }

    if (String(existing.asset_json || '') !== assetJson || integer(existing.unit_price) !== spec.unit_price) {
      await env.DB.prepare(
        `UPDATE market_listings
         SET asset_name = ?, asset_json = ?, unit_price = ?, updated_at = ?
         WHERE id = ?`,
      ).bind(spec.name, assetJson, spec.unit_price, now, spec.id).run();
    }
  }
}

export async function settleExpiredMarketListings(env, { limit = 100 } = {}) {
  const now = nowMs();
  const rows = await all(
    env,
    `SELECT *
     FROM market_listings
     WHERE is_system = 0
       AND status = 'active'
       AND remaining_quantity > 0
       AND recycle_at > 0
       AND recycle_at <= ?
     ORDER BY recycle_at ASC
     LIMIT ?`,
    [now, Math.max(1, Math.min(500, integer(limit, 100)))],
  );

  for (const row of rows) {
    const asset = parseAsset(logicalKind(row), row.asset_name, row.asset_json, row.remaining_quantity);
    const quote = marketBuybackQuote(asset, row.remaining_quantity);
    const recycleId = `recycle:${row.id}`;
    await runBatch(env, [
      env.DB.prepare(
        `INSERT OR IGNORE INTO market_recycles
          (id, listing_id, user_id, asset_kind, market_kind, asset_name, asset_json, quantity, amount, credited_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      ).bind(
        recycleId,
        row.id,
        row.seller_user_id,
        row.asset_kind,
        logicalKind(row),
        row.asset_name,
        row.asset_json,
        row.remaining_quantity,
        quote.total_price,
        now,
      ),
      env.DB.prepare(
        `INSERT INTO market_wallets (user_id, balance, updated_at)
         SELECT user_id, amount, ?
         FROM market_recycles
         WHERE listing_id = ? AND credited_at IS NULL
         ON CONFLICT(user_id) DO UPDATE SET
           balance = market_wallets.balance + excluded.balance,
           updated_at = excluded.updated_at`,
      ).bind(now, row.id),
      env.DB.prepare(
        `UPDATE market_recycles
         SET credited_at = COALESCE(credited_at, ?)
         WHERE listing_id = ?`,
      ).bind(now, row.id),
      env.DB.prepare(
        `UPDATE market_listings
         SET status = 'cancelled', remaining_quantity = 0, updated_at = ?
         WHERE id = ?
           AND EXISTS (
             SELECT 1 FROM market_recycles
             WHERE listing_id = ? AND credited_at IS NOT NULL
           )`,
      ).bind(now, row.id, row.id),
    ]);
  }

  return { processed: rows.length };
}

async function ensureTestingMarketFixtures(env) {
  const channel = String(env.CLIENT_UPDATE_CHANNEL || '').trim().toLowerCase();
  if (channel !== 'testing') return;

  const now = nowMs();
  await env.DB.prepare(
    `INSERT INTO users
      (discord_id, username, display_name, avatar, is_admin, is_moderator, is_banned, ban_reason, created_at, updated_at)
     VALUES (?, ?, ?, NULL, 0, 0, 0, '', ?, ?)
     ON CONFLICT(discord_id) DO UPDATE SET
       username = excluded.username,
       display_name = excluded.display_name,
       updated_at = excluded.updated_at`,
  ).bind(
    TEST_VENDOR_DISCORD_ID,
    TEST_VENDOR_USERNAME,
    TEST_VENDOR_DISPLAY_NAME,
    now,
    now,
  ).run();

  const seller = await first(
    env,
    'SELECT id FROM users WHERE discord_id = ? LIMIT 1',
    [TEST_VENDOR_DISCORD_ID],
  );
  if (!seller?.id) return;

  for (const fixture of TEST_VENDOR_FIXTURES) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO market_listings
        (id, seller_user_id, asset_kind, asset_name, asset_json, unit_price,
         total_quantity, remaining_quantity, status, duration_hours, expires_at, recycle_at,
         listing_fee, is_system, restock_day, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, 0, 0, 0, 1, '', ?, ?)`,
    ).bind(
      fixture.id,
      seller.id,
      fixture.kind,
      fixture.name,
      JSON.stringify(fixture.data),
      fixture.unitPrice,
      fixture.quantity,
      fixture.quantity,
      now,
      now,
    ).run();
    await env.DB.prepare(
      `UPDATE market_listings
       SET is_system = 1,
           duration_hours = 0,
           expires_at = 0,
           recycle_at = 0,
           listing_fee = 0,
           updated_at = ?
       WHERE id = ?`,
    ).bind(now, fixture.id).run();
  }
}

async function runBatch(env, statements) {
  if (typeof env.DB?.batch === 'function') return env.DB.batch(statements);
  const results = [];
  for (const statement of statements) results.push(await statement.run());
  return results;
}

const LISTING_SELECT = `
  SELECT
    l.*,
    seller.username AS seller_username,
    seller.display_name AS seller_display_name
  FROM market_listings l
  JOIN users seller ON seller.id = l.seller_user_id
`;

const TRADE_SELECT = `
  SELECT
    t.*,
    seller.username AS seller_username,
    seller.display_name AS seller_display_name,
    buyer.username AS buyer_username,
    buyer.display_name AS buyer_display_name
  FROM market_trades t
  JOIN users seller ON seller.id = t.seller_user_id
  JOIN users buyer ON buyer.id = t.buyer_user_id
`;

async function getListing(env, listingId) {
  return listingFromRow(await first(env, `${LISTING_SELECT} WHERE l.id = ? LIMIT 1`, [listingId]));
}

async function getTradeRow(env, tradeId) {
  return first(env, `${TRADE_SELECT} WHERE t.id = ? LIMIT 1`, [tradeId]);
}

export async function listMarketCatalog(request, env) {
  await settleExpiredMarketListings(env);
  await ensureTestingMarketFixtures(env);
  await ensureSystemCredentialListings(env);
  const url = new URL(request.url);
  const offset = Math.max(0, integer(url.searchParams.get('offset'), 0));
  const limit = Math.max(1, Math.min(500, integer(url.searchParams.get('limit'), 200)));
  return json(await listMarketProducts(env, { offset, limit }));
}

export async function getMarketCatalogProduct(env, marketKeyValue) {
  await settleExpiredMarketListings(env);
  await ensureTestingMarketFixtures(env);
  await ensureSystemCredentialListings(env);
  await ensureMarketCatalog(env);
  const marketKey = text(marketKeyValue, 80);
  const product = await getMarketProduct(env, marketKey);
  if (!product) throw new HttpError(404, 'market_product_not_found', '该商品已经没有有效挂单');
  const rows = await listProductRows(env, marketKey);
  const history = await getMarketPriceHistory(env, marketKey, { days: 14 });
  return json({
    product,
    listings: rows.map(listingFromRow),
    history,
  });
}

export async function listMarketListings(request, env) {
  await settleExpiredMarketListings(env);
  await ensureTestingMarketFixtures(env);
  await ensureSystemCredentialListings(env);
  const url = new URL(request.url);
  const kind = String(url.searchParams.get('kind') || '').trim();
  const query = text(url.searchParams.get('q') || '', 80);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, integer(url.searchParams.get('limit') || DEFAULT_LIMIT, DEFAULT_LIMIT)),
  );
  const offset = Math.max(0, integer(url.searchParams.get('offset'), 0));
  const sort = String(url.searchParams.get('sort') || 'latest');

  const clauses = [
    "l.status = 'active'",
    'l.remaining_quantity > 0',
    '(l.is_system = 1 OR l.expires_at = 0 OR l.expires_at > ?)',
  ];
  const args = [nowMs()];
  if (kind) {
    if (!MARKET_KINDS.has(kind)) throw new HttpError(400, 'market_invalid_kind', '资产类型无效');
    clauses.push("COALESCE(NULLIF(l.market_kind, ''), l.asset_kind) = ?");
    args.push(kind);
  }
  if (query) {
    clauses.push('l.asset_name LIKE ?');
    args.push(`%${query}%`);
  }

  const orderBy = {
    latest: 'l.created_at DESC',
    price_asc: 'l.unit_price ASC, l.created_at DESC',
    price_desc: 'l.unit_price DESC, l.created_at DESC',
  }[sort] || 'l.created_at DESC';

  const rows = await all(
    env,
    `${LISTING_SELECT}
     WHERE ${clauses.join(' AND ')}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...args, limit + 1, offset],
  );
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(listingFromRow);
  return json({
    items,
    next_offset: hasMore ? offset + limit : null,
  });
}

export async function quoteMarketAction(request, env, user) {
  void user;
  const body = await readJson(request, { maxBytes: 64 * 1024 });
  const asset = assetFromBody(body?.asset);
  const action = String(body?.action || 'auction');
  const reference = await referenceForAsset(env, asset);

  if (action === 'buyback') {
    return json({ quote: marketBuybackQuote(asset, asset.quantity), reference });
  }

  const durationHours = positiveInteger(body?.duration_hours ?? 24, {
    min: 24,
    max: 72,
    code: 'market_invalid_duration',
    label: '拍卖时长',
  });
  if (!MARKET_AUCTION_DURATIONS.includes(durationHours)) {
    throw new HttpError(400, 'market_invalid_duration', '拍卖时长只支持 24、48 或 72 小时');
  }
  return json({ quote: marketAuctionQuote(asset, asset.quantity, durationHours), reference });
}

export async function createMarketListing(request, env, user) {
  await assertMarketUserAllowed(env, user);
  const body = await readJson(request, { maxBytes: 64 * 1024 });
  const id = marketId(body?.id, '挂单 ID');
  const unitPrice = positiveInteger(body?.unit_price, {
    max: MAX_PRICE,
    code: 'market_invalid_price',
    label: '单价',
  });
  const asset = assetFromBody(body?.asset);
  const durationHours = positiveInteger(body?.duration_hours ?? 24, {
    min: 24,
    max: 72,
    code: 'market_invalid_duration',
    label: '拍卖时长',
  });
  if (!MARKET_AUCTION_DURATIONS.includes(durationHours)) {
    throw new HttpError(400, 'market_invalid_duration', '拍卖时长只支持 24、48 或 72 小时');
  }
  const quote = marketAuctionQuote(asset, asset.quantity, durationHours);
  const marketKey = marketAssetKey(asset);

  const existing = await getListing(env, id);
  if (existing) {
    if (existing.seller.id !== Number(user.id)) {
      throw new HttpError(409, 'market_id_conflict', '挂单 ID 已被占用');
    }
    return json({ listing: existing, quote });
  }

  const now = nowMs();
  const expiresAt = now + durationHours * 60 * 60 * 1000;
  const recycleAt = marketRecycleAt(expiresAt);
  await env.DB.prepare(
    `INSERT INTO market_listings
      (id, seller_user_id, asset_kind, market_kind, market_key, asset_name, asset_json, unit_price,
       total_quantity, remaining_quantity, status, duration_hours, expires_at, recycle_at,
       listing_fee, is_system, restock_day, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, 0, '', ?, ?)`,
  ).bind(
    id,
    user.id,
    storageKind(asset.kind),
    asset.kind,
    marketKey,
    asset.name,
    asset.assetJson,
    unitPrice,
    asset.quantity,
    asset.quantity,
    durationHours,
    expiresAt,
    recycleAt,
    quote.listing_fee,
    now,
    now,
  ).run();

  await refreshMarketProduct(env, marketKey);
  return json({ listing: await getListing(env, id), quote }, 201);
}

function buybackFromRow(row) {
  if (!row) return null;
  const quantity = integer(row.market_quantity, 0) || integer(row.quantity, 1);
  return {
    id: row.id,
    market_key: row.market_key || '',
    asset: parseAsset(logicalKind(row), row.asset_name, row.asset_json, quantity),
    quantity,
    amount: integer(row.amount),
    payout_id: row.payout_id,
    created_at: integer(row.created_at),
  };
}

export async function createMarketBuyback(request, env, user) {
  await assertMarketUserAllowed(env, user);
  const body = await readJson(request, { maxBytes: 64 * 1024 });
  const id = marketId(body?.id, '回收 ID');
  const asset = assetFromBody(body?.asset);

  const existing = await first(env, 'SELECT * FROM market_buybacks WHERE id = ? LIMIT 1', [id]);
  if (existing) {
    if (Number(existing.user_id) !== Number(user.id)) {
      throw new HttpError(409, 'market_buyback_id_conflict', '回收 ID 已被占用');
    }
    const payout = await first(env, 'SELECT * FROM market_payouts WHERE id = ? LIMIT 1', [existing.payout_id]);
    return json({ buyback: buybackFromRow(existing), payout: payoutFromRow(payout) });
  }

  const quote = marketBuybackQuote(asset, asset.quantity);
  const marketKey = marketAssetKey(asset);
  const payoutId = id;
  const now = nowMs();
  await runBatch(env, [
    env.DB.prepare(
      `INSERT INTO market_payouts (id, user_id, amount, confirmed_at, created_at)
       VALUES (?, ?, ?, NULL, ?)`,
    ).bind(payoutId, user.id, quote.total_price, now),
    env.DB.prepare(
      `INSERT INTO market_buybacks
        (id, user_id, asset_kind, market_kind, market_key, asset_name, asset_json, quantity, market_quantity, amount, payout_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    ).bind(
      id,
      user.id,
      storageKind(asset.kind, { buyback: true }),
      asset.kind,
      marketKey,
      asset.name,
      asset.assetJson,
      asset.quantity,
      quote.total_price,
      payoutId,
      now,
    ),
  ]);

  const row = await first(env, 'SELECT * FROM market_buybacks WHERE id = ? LIMIT 1', [id]);
  const payout = await first(env, 'SELECT * FROM market_payouts WHERE id = ? LIMIT 1', [payoutId]);
  return json({ buyback: buybackFromRow(row), payout: payoutFromRow(payout), quote }, 201);
}

export async function getMarketBuyback(env, user, buybackIdValue) {
  const id = marketId(buybackIdValue, '回收 ID');
  const row = await first(env, 'SELECT * FROM market_buybacks WHERE id = ? LIMIT 1', [id]);
  if (!row || Number(row.user_id) !== Number(user.id)) {
    throw new HttpError(404, 'market_buyback_not_found', '系统回收记录不存在');
  }
  const payout = await first(env, 'SELECT * FROM market_payouts WHERE id = ? LIMIT 1', [row.payout_id]);
  return json({ buyback: buybackFromRow(row), payout: payoutFromRow(payout) });
}

export async function buyMarketListing(request, env, user, listingIdValue) {
  await assertMarketUserAllowed(env, user);
  await settleExpiredMarketListings(env);
  await ensureTestingMarketFixtures(env);
  await ensureSystemCredentialListings(env);
  const listingId = marketId(listingIdValue, '挂单 ID');
  const body = await readJson(request, { maxBytes: 16 * 1024 });
  const tradeId = marketId(body?.trade_id, '交易 ID');
  const requestedQuantity = positiveInteger(body?.quantity ?? 1, {
    max: MAX_QUANTITY,
    code: 'market_invalid_quantity',
    label: '购买数量',
  });

  const existingTradeRow = await getTradeRow(env, tradeId);
  if (existingTradeRow) {
    if (Number(existingTradeRow.buyer_user_id) !== Number(user.id)) {
      throw new HttpError(409, 'market_trade_id_conflict', '交易 ID 已被占用');
    }
    return json({
      trade: tradeFromRow(existingTradeRow),
      listing: await getListing(env, existingTradeRow.listing_id),
    });
  }

  const listing = await getListing(env, listingId);
  if (
    !listing
    || listing.status !== 'active'
    || listing.remaining_quantity <= 0
    || (!listing.is_system && listing.expires_at > 0 && listing.expires_at <= nowMs())
  ) {
    throw new HttpError(409, 'market_listing_unavailable', '该挂单已经到期或不可购买');
  }
  if (listing.seller.id === Number(user.id)) {
    throw new HttpError(409, 'market_own_listing', '不能购买自己的挂单');
  }

  const quantity = listing.asset.kind === 'item' ? requestedQuantity : 1;
  if (quantity > listing.remaining_quantity) {
    throw new HttpError(409, 'market_quantity_unavailable', '挂单剩余数量不足');
  }

  const now = nowMs();
  const settlement = listing.is_system
    ? { gross: listing.unit_price * quantity, market_fee: 0, seller_proceeds: 0 }
    : marketSaleSettlement(listing.unit_price * quantity);
  const statements = [
    env.DB.prepare(
      `INSERT INTO market_trades
        (id, listing_id, seller_user_id, buyer_user_id, asset_kind, market_kind, market_key, asset_name, asset_json,
         quantity, unit_price, total_price, market_fee, seller_proceeds, delivered_at, created_at)
       SELECT ?, l.id, l.seller_user_id, ?, l.asset_kind, COALESCE(NULLIF(l.market_kind, ''), l.asset_kind), l.market_key, l.asset_name, l.asset_json,
              ?, l.unit_price, l.unit_price * ?, ?, ?, NULL, ?
       FROM market_listings l
       WHERE l.id = ?
         AND l.status = 'active'
         AND l.remaining_quantity >= ?
         AND l.seller_user_id <> ?
         AND (l.is_system = 1 OR l.expires_at = 0 OR l.expires_at > ?)`,
    ).bind(
      tradeId,
      user.id,
      quantity,
      quantity,
      settlement.market_fee,
      settlement.seller_proceeds,
      now,
      listingId,
      quantity,
      user.id,
      now,
    ),
    env.DB.prepare(
      `UPDATE market_listings
       SET remaining_quantity = remaining_quantity - ?,
           status = CASE WHEN remaining_quantity - ? <= 0 THEN 'sold' ELSE 'active' END,
           updated_at = ?
       WHERE id = ?
         AND EXISTS (
           SELECT 1 FROM market_trades
           WHERE id = ? AND listing_id = ? AND buyer_user_id = ?
         )`,
    ).bind(quantity, quantity, now, listingId, tradeId, listingId, user.id),
    env.DB.prepare(
      `INSERT INTO market_wallets (user_id, balance, updated_at)
       SELECT t.seller_user_id, t.seller_proceeds, ?
       FROM market_trades t
       JOIN market_listings l ON l.id = t.listing_id
       WHERE t.id = ? AND l.is_system = 0 AND t.seller_proceeds > 0
       ON CONFLICT(user_id) DO UPDATE SET
         balance = market_wallets.balance + excluded.balance,
         updated_at = excluded.updated_at`,
    ).bind(now, tradeId),
  ];

  try {
    await runBatch(env, statements);
  } catch (error) {
    const retryTrade = await getTradeRow(env, tradeId);
    if (!retryTrade) throw error;
  }

  const tradeRow = await getTradeRow(env, tradeId);
  if (!tradeRow) {
    throw new HttpError(409, 'market_listing_unavailable', '该挂单刚刚被其他玩家买走或数量不足');
  }

  await recordMarketTrade(env, {
    marketKey: tradeRow.market_key,
    kind: logicalKind(tradeRow),
    name: tradeRow.asset_name,
    assetJson: tradeRow.asset_json,
    unitPrice: tradeRow.unit_price,
    quantity: tradeRow.quantity,
    at: tradeRow.created_at,
  });
  if (tradeRow.market_key) await refreshMarketProduct(env, tradeRow.market_key);

  return json({
    trade: tradeFromRow(tradeRow),
    listing: await getListing(env, listingId),
  });
}

export async function getMarketTrade(env, user, tradeIdValue) {
  const tradeId = marketId(tradeIdValue, '交易 ID');
  const row = await getTradeRow(env, tradeId);
  if (!row || (Number(row.buyer_user_id) !== Number(user.id) && Number(row.seller_user_id) !== Number(user.id))) {
    throw new HttpError(404, 'market_trade_not_found', '交易记录不存在');
  }
  return json({ trade: tradeFromRow(row) });
}

export async function confirmMarketDelivery(env, user, tradeIdValue) {
  const tradeId = marketId(tradeIdValue, '交易 ID');
  const now = nowMs();
  await env.DB.prepare(
    `UPDATE market_trades
     SET delivered_at = COALESCE(delivered_at, ?)
     WHERE id = ? AND buyer_user_id = ?`,
  ).bind(now, tradeId, user.id).run();

  const row = await getTradeRow(env, tradeId);
  if (!row || Number(row.buyer_user_id) !== Number(user.id)) {
    throw new HttpError(404, 'market_trade_not_found', '交易记录不存在');
  }
  return json({ trade: tradeFromRow(row) });
}

export async function cancelMarketListing(env, user, listingIdValue) {
  await settleExpiredMarketListings(env);
  const listingId = marketId(listingIdValue, '挂单 ID');
  const listing = await getListing(env, listingId);
  if (!listing || listing.seller.id !== Number(user.id)) {
    throw new HttpError(404, 'market_listing_not_found', '挂单不存在');
  }

  const existingReturn = await first(
    env,
    'SELECT * FROM market_returns WHERE listing_id = ? AND user_id = ? LIMIT 1',
    [listingId, user.id],
  );
  if (existingReturn) {
    return json({
      listing: await getListing(env, listingId),
      return: returnFromRow(existingReturn),
    });
  }

  if (listing.status !== 'active' || listing.remaining_quantity <= 0) {
    throw new HttpError(409, 'market_listing_not_cancellable', '该挂单已经无法撤回');
  }

  const returnId = `return:${listingId}`;
  const now = nowMs();
  await runBatch(env, [
    env.DB.prepare(
      `UPDATE market_listings
       SET status = 'cancelled', updated_at = ?
       WHERE id = ? AND seller_user_id = ? AND status = 'active' AND remaining_quantity > 0`,
    ).bind(now, listingId, user.id),
    env.DB.prepare(
      `INSERT OR IGNORE INTO market_returns
        (id, listing_id, user_id, asset_kind, market_kind, market_key, asset_name, asset_json, quantity, confirmed_at, created_at)
       SELECT ?, id, seller_user_id, asset_kind, COALESCE(NULLIF(market_kind, ''), asset_kind), market_key, asset_name, asset_json, remaining_quantity, NULL, ?
       FROM market_listings
       WHERE id = ? AND seller_user_id = ? AND status = 'cancelled' AND remaining_quantity > 0`,
    ).bind(returnId, now, listingId, user.id),
    env.DB.prepare(
      `UPDATE market_listings
       SET remaining_quantity = 0, updated_at = ?
       WHERE id = ?
         AND EXISTS (SELECT 1 FROM market_returns WHERE id = ? AND listing_id = ?)`,
    ).bind(now, listingId, returnId, listingId),
  ]);

  const returned = await first(env, 'SELECT * FROM market_returns WHERE id = ? LIMIT 1', [returnId]);
  if (!returned) {
    throw new HttpError(409, 'market_listing_not_cancellable', '挂单状态已经变化，请刷新后重试');
  }

  if (listing.market_key) await refreshMarketProduct(env, listing.market_key);
  return json({
    listing: await getListing(env, listingId),
    return: returnFromRow(returned),
  });
}

export async function confirmMarketReturn(env, user, returnIdValue) {
  const returnId = marketId(returnIdValue, '返还 ID');
  const now = nowMs();
  await env.DB.prepare(
    `UPDATE market_returns
     SET confirmed_at = COALESCE(confirmed_at, ?)
     WHERE id = ? AND user_id = ?`,
  ).bind(now, returnId, user.id).run();

  const row = await first(
    env,
    'SELECT * FROM market_returns WHERE id = ? AND user_id = ? LIMIT 1',
    [returnId, user.id],
  );
  if (!row) throw new HttpError(404, 'market_return_not_found', '返还记录不存在');
  return json({ return: returnFromRow(row) });
}

export async function claimMarketPayout(request, env, user) {
  const body = await readJson(request, { maxBytes: 8 * 1024 });
  const payoutId = marketId(body?.payout_id, '货款领取 ID');

  const existing = await first(
    env,
    'SELECT * FROM market_payouts WHERE id = ? LIMIT 1',
    [payoutId],
  );
  if (existing) {
    if (Number(existing.user_id) !== Number(user.id)) {
      throw new HttpError(409, 'market_payout_id_conflict', '货款领取 ID 已被占用');
    }
    return json({ payout: payoutFromRow(existing) });
  }

  const now = nowMs();
  await runBatch(env, [
    env.DB.prepare(
      `INSERT INTO market_payouts (id, user_id, amount, confirmed_at, created_at)
       SELECT ?, user_id, balance, NULL, ?
       FROM market_wallets
       WHERE user_id = ? AND balance > 0`,
    ).bind(payoutId, now, user.id),
    env.DB.prepare(
      `UPDATE market_wallets
       SET balance = balance - COALESCE((SELECT amount FROM market_payouts WHERE id = ? AND user_id = ?), 0),
           updated_at = ?
       WHERE user_id = ?`,
    ).bind(payoutId, user.id, now, user.id),
  ]);

  const payout = await first(
    env,
    'SELECT * FROM market_payouts WHERE id = ? AND user_id = ? LIMIT 1',
    [payoutId, user.id],
  );
  if (!payout) throw new HttpError(409, 'market_no_proceeds', '当前没有待领取货款');
  return json({ payout: payoutFromRow(payout) });
}

export async function confirmMarketPayout(env, user, payoutIdValue) {
  const payoutId = marketId(payoutIdValue, '货款领取 ID');
  const now = nowMs();
  await env.DB.prepare(
    `UPDATE market_payouts
     SET confirmed_at = COALESCE(confirmed_at, ?)
     WHERE id = ? AND user_id = ?`,
  ).bind(now, payoutId, user.id).run();

  const row = await first(
    env,
    'SELECT * FROM market_payouts WHERE id = ? AND user_id = ? LIMIT 1',
    [payoutId, user.id],
  );
  if (!row) throw new HttpError(404, 'market_payout_not_found', '货款领取记录不存在');
  return json({ payout: payoutFromRow(row) });
}

export async function getMarketMe(env, user) {
  await settleExpiredMarketListings(env);
  const wallet = await first(
    env,
    'SELECT balance, updated_at FROM market_wallets WHERE user_id = ? LIMIT 1',
    [user.id],
  );
  const listings = await all(
    env,
    `${LISTING_SELECT} WHERE l.seller_user_id = ? ORDER BY l.created_at DESC LIMIT 50`,
    [user.id],
  );
  const purchases = await all(
    env,
    `${TRADE_SELECT} WHERE t.buyer_user_id = ? ORDER BY t.created_at DESC LIMIT 50`,
    [user.id],
  );
  const sales = await all(
    env,
    `${TRADE_SELECT} WHERE t.seller_user_id = ? ORDER BY t.created_at DESC LIMIT 50`,
    [user.id],
  );
  const pendingReturns = await all(
    env,
    `SELECT * FROM market_returns
     WHERE user_id = ? AND confirmed_at IS NULL
     ORDER BY created_at ASC LIMIT 50`,
    [user.id],
  );
  const pendingPayouts = await all(
    env,
    `SELECT * FROM market_payouts
     WHERE user_id = ? AND confirmed_at IS NULL
     ORDER BY created_at ASC LIMIT 50`,
    [user.id],
  );
  const recycles = await all(
    env,
    `SELECT * FROM market_recycles
     WHERE user_id = ?
     ORDER BY created_at DESC LIMIT 50`,
    [user.id],
  );
  const buybacks = await all(
    env,
    `SELECT * FROM market_buybacks
     WHERE user_id = ?
     ORDER BY created_at DESC LIMIT 50`,
    [user.id],
  );

  return json({
    wallet: {
      balance: integer(wallet?.balance, 0),
      updated_at: integer(wallet?.updated_at, 0),
    },
    listings: listings.map(listingFromRow),
    purchases: purchases.map(tradeFromRow),
    sales: sales.map(tradeFromRow),
    pending_deliveries: purchases.filter(row => row.delivered_at == null).map(tradeFromRow),
    pending_returns: pendingReturns.map(returnFromRow),
    pending_payouts: pendingPayouts.map(payoutFromRow),
    recycles: recycles.map(recycleFromRow),
    buybacks: buybacks.map(buybackFromRow),
  });
}
