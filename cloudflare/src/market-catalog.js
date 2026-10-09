const RANK_QUALITY = Object.freeze({
  'Ⅰ': 'F',
  'Ⅱ': 'E',
  'Ⅲ': 'D',
  'Ⅳ': 'C',
  'Ⅴ': 'B',
  'Ⅵ': 'A',
  'Ⅶ': 'S',
  'Ⅷ': 'SS',
  'Ⅸ': 'SSS',
});

const EQUIPMENT_TYPES = ['武器', '手部', '头部', '胸部', '腿部', '鞋子', '披风', '饰品', '世界遗物'];
const SKILL_TYPES = ['主动', '被动', '特殊'];

function integer(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function parseJson(value, fallback = {}) {
  try { return JSON.parse(String(value || '')); } catch { return fallback; }
}

function stable(value, key = '') {
  if (key === '数量') return undefined;
  if (Array.isArray(value)) return value.map(item => stable(item)).filter(item => item !== undefined);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const name of Object.keys(value).sort()) {
    const nested = stable(value[name], name);
    if (nested !== undefined) out[name] = nested;
  }
  return out;
}

function hash32(text, seed) {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function marketAssetKey(asset) {
  const kind = String(asset?.kind || '').trim();
  const name = String(asset?.name || '').trim();
  const payload = JSON.stringify(stable(asset?.data || {}));
  const source = kind + '\u0000' + name + '\u0000' + payload;
  return 'mk:' + hash32(source, 2166136261) + hash32(source, 2246822519);
}

export function marketAssetQuality(asset) {
  const raw = String(
    asset?.quality
      || asset?.data?.品质
      || asset?.data?.层级
      || asset?.data?.等级
      || '',
  ).trim();
  if (RANK_QUALITY[raw]) return RANK_QUALITY[raw];
  const upper = raw.toUpperCase();
  return /^(F|E|D|C|B|A|S|SS|SSS)$/u.test(upper) ? upper : '';
}

export function marketAssetSubtype(asset) {
  const kind = String(asset?.kind || '');
  const raw = asset?.data?.类型;
  const index = Number(raw);
  if (kind === 'equipment' && Number.isInteger(index) && EQUIPMENT_TYPES[index]) {
    return EQUIPMENT_TYPES[index];
  }
  if (kind === 'skill' && Number.isInteger(index) && SKILL_TYPES[index]) {
    return SKILL_TYPES[index];
  }
  if (raw != null && String(raw).trim()) return String(raw).trim();
  if (kind === 'teammate') return String(asset?.data?.种族 || '').trim();
  return '';
}

async function all(env, sql, args = []) {
  const response = await env.DB.prepare(sql).bind(...args).all();
  return response?.results || [];
}

async function first(env, sql, args = []) {
  return env.DB.prepare(sql).bind(...args).first();
}

function productFromRow(row) {
  if (!row) return null;
  return {
    key: row.market_key,
    kind: row.market_kind,
    name: row.asset_name,
    asset: {
      kind: row.market_kind,
      name: row.asset_name,
      quantity: integer(row.total_stock, 1),
      data: parseJson(row.asset_json, {}),
    },
    quality: row.quality || '',
    subtype: row.subtype || '',
    lowest_price: integer(row.lowest_price),
    total_stock: integer(row.total_stock),
    listing_count: integer(row.listing_count),
    seller_count: integer(row.seller_count),
    latest_at: integer(row.latest_at),
    updated_at: integer(row.updated_at),
  };
}

export async function refreshMarketProduct(env, marketKey) {
  const key = String(marketKey || '').trim();
  if (!key) return null;
  const now = Date.now();
  const aggregate = await first(
    env,
    `SELECT
       COUNT(*) AS listing_count,
       COUNT(DISTINCT seller_user_id) AS seller_count,
       COALESCE(SUM(remaining_quantity), 0) AS total_stock,
       COALESCE(MIN(unit_price), 0) AS lowest_price,
       COALESCE(MAX(created_at), 0) AS latest_at
     FROM market_listings
     WHERE market_key = ?
       AND status = 'active'
       AND remaining_quantity > 0
       AND (is_system = 1 OR expires_at = 0 OR expires_at > ?)`,
    [key, now],
  );
  if (!aggregate || integer(aggregate.total_stock) <= 0) {
    await env.DB.prepare('DELETE FROM market_products WHERE market_key = ?').bind(key).run();
    return null;
  }

  const sample = await first(
    env,
    `SELECT
       COALESCE(NULLIF(market_kind, ''), asset_kind) AS market_kind,
       asset_name,
       asset_json
     FROM market_listings
     WHERE market_key = ?
       AND status = 'active'
       AND remaining_quantity > 0
       AND (is_system = 1 OR expires_at = 0 OR expires_at > ?)
     ORDER BY unit_price ASC, created_at DESC
     LIMIT 1`,
    [key, now],
  );
  if (!sample) return null;

  const asset = {
    kind: sample.market_kind,
    name: sample.asset_name,
    data: parseJson(sample.asset_json, {}),
  };
  const quality = marketAssetQuality(asset);
  const subtype = marketAssetSubtype(asset);
  await env.DB.prepare(
    `INSERT INTO market_products
      (market_key, market_kind, asset_name, asset_json, quality, subtype, lowest_price,
       total_stock, listing_count, seller_count, latest_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(market_key) DO UPDATE SET
       market_kind = excluded.market_kind,
       asset_name = excluded.asset_name,
       asset_json = excluded.asset_json,
       quality = excluded.quality,
       subtype = excluded.subtype,
       lowest_price = excluded.lowest_price,
       total_stock = excluded.total_stock,
       listing_count = excluded.listing_count,
       seller_count = excluded.seller_count,
       latest_at = excluded.latest_at,
       updated_at = excluded.updated_at`,
  ).bind(
    key,
    sample.market_kind,
    sample.asset_name,
    sample.asset_json,
    quality,
    subtype,
    integer(aggregate.lowest_price),
    integer(aggregate.total_stock),
    integer(aggregate.listing_count),
    integer(aggregate.seller_count),
    integer(aggregate.latest_at),
    now,
  ).run();

  return productFromRow(await first(env, 'SELECT * FROM market_products WHERE market_key = ? LIMIT 1', [key]));
}

export async function ensureMarketCatalog(env, { batchSize = 500 } = {}) {
  const rows = await all(
    env,
    `SELECT id, asset_kind, market_kind, asset_name, asset_json, remaining_quantity
     FROM market_listings
     WHERE market_key = ''
     ORDER BY created_at ASC
     LIMIT ?`,
    [Math.max(1, Math.min(1000, integer(batchSize, 500)))],
  );
  const affected = new Set();
  for (const row of rows) {
    const kind = String(row.market_kind || row.asset_kind || '');
    const key = marketAssetKey({
      kind,
      name: row.asset_name,
      quantity: integer(row.remaining_quantity, 1),
      data: parseJson(row.asset_json, {}),
    });
    await env.DB.prepare(
      'UPDATE market_listings SET market_key = ? WHERE id = ? AND market_key = ?',
    ).bind(key, row.id, '').run();
    affected.add(key);
  }
  for (const key of affected) await refreshMarketProduct(env, key);
  return { keyed: rows.length, affected: affected.size };
}

export async function listMarketProducts(env, { offset = 0, limit = 200 } = {}) {
  await ensureMarketCatalog(env);
  const safeLimit = Math.max(1, Math.min(500, integer(limit, 200)));
  const safeOffset = Math.max(0, integer(offset, 0));
  const rows = await all(
    env,
    `SELECT *
     FROM market_products
     WHERE total_stock > 0
     ORDER BY lowest_price ASC, latest_at DESC
     LIMIT ? OFFSET ?`,
    [safeLimit + 1, safeOffset],
  );
  const hasMore = rows.length > safeLimit;
  return {
    items: rows.slice(0, safeLimit).map(productFromRow),
    next_offset: hasMore ? safeOffset + safeLimit : null,
  };
}

export async function getMarketProduct(env, marketKey) {
  await ensureMarketCatalog(env);
  const row = await first(env, 'SELECT * FROM market_products WHERE market_key = ? LIMIT 1', [String(marketKey || '')]);
  return productFromRow(row);
}

export async function listProductRows(env, marketKey) {
  const now = Date.now();
  return all(
    env,
    `SELECT
       l.*,
       seller.username AS seller_username,
       seller.display_name AS seller_display_name
     FROM market_listings l
     JOIN users seller ON seller.id = l.seller_user_id
     WHERE l.market_key = ?
       AND l.status = 'active'
       AND l.remaining_quantity > 0
       AND (l.is_system = 1 OR l.expires_at = 0 OR l.expires_at > ?)
     ORDER BY l.unit_price ASC, l.created_at ASC`,
    [String(marketKey || ''), now],
  );
}

export async function getMarketPriceHistory(env, marketKey, { days = 14 } = {}) {
  const limit = Math.max(1, Math.min(30, integer(days, 14)));
  const rows = await all(
    env,
    `SELECT *
     FROM market_price_daily
     WHERE market_key = ?
     ORDER BY day_key DESC
     LIMIT ?`,
    [String(marketKey || ''), limit],
  );
  return rows.reverse().map(row => ({
    day: row.day_key,
    low: integer(row.low_price),
    high: integer(row.high_price),
    last: integer(row.last_price),
    average: integer(row.volume) > 0 ? Math.round(integer(row.turnover) / integer(row.volume)) : integer(row.last_price),
    volume: integer(row.volume),
    turnover: integer(row.turnover),
    trades: integer(row.trade_count),
  }));
}

export async function recordMarketTrade(env, {
  marketKey,
  kind,
  name,
  assetJson,
  unitPrice,
  quantity,
  at = Date.now(),
}) {
  const key = String(marketKey || '').trim();
  if (!key) return;
  const price = Math.max(1, integer(unitPrice, 1));
  const amount = Math.max(1, integer(quantity, 1));
  const asset = { kind, name, data: parseJson(assetJson, {}) };
  const quality = marketAssetQuality(asset);
  const day = new Date(at).toISOString().slice(0, 10);
  await env.DB.prepare(
    `INSERT INTO market_price_daily
      (market_key, day_key, market_kind, asset_name, quality, low_price, high_price,
       last_price, volume, turnover, trade_count, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
     ON CONFLICT(market_key, day_key) DO UPDATE SET
       low_price = MIN(market_price_daily.low_price, excluded.low_price),
       high_price = MAX(market_price_daily.high_price, excluded.high_price),
       last_price = excluded.last_price,
       volume = market_price_daily.volume + excluded.volume,
       turnover = market_price_daily.turnover + excluded.turnover,
       trade_count = market_price_daily.trade_count + 1,
       updated_at = excluded.updated_at`,
  ).bind(
    key,
    day,
    kind,
    name,
    quality,
    price,
    price,
    price,
    amount,
    price * amount,
    at,
  ).run();
}

export async function referenceForAsset(env, asset) {
  const key = marketAssetKey(asset);
  const product = await getMarketProduct(env, key);
  const history = await getMarketPriceHistory(env, key, { days: 14 });
  const rows = product ? await listProductRows(env, key) : [];
  const levels = new Map();
  for (const row of rows) {
    const price = integer(row.unit_price);
    const stock = Math.max(0, integer(row.remaining_quantity));
    if (!price || !stock) continue;
    const level = levels.get(price) || { price, stock: 0, sellers: new Set() };
    level.stock += stock;
    level.sellers.add(integer(row.seller_user_id));
    levels.set(price, level);
  }
  const ladder = [...levels.values()]
    .sort((left, right) => left.price - right.price)
    .slice(0, 8)
    .map(level => ({
      price: level.price,
      stock: level.stock,
      seller_count: level.sellers.size,
    }));
  const orders = await all(
    env,
    `SELECT id, buyer_user_id, quantity_remaining, unit_price, expires_at, created_at
     FROM market_orders
     WHERE market_key = ? AND status = 'active' AND quantity_remaining > 0 AND expires_at > ?
     ORDER BY unit_price DESC, created_at ASC
     LIMIT 10`,
    [key, Date.now()],
  );
  return {
    market_key: key,
    product,
    ladder,
    history,
    orders: orders.map(row => ({
      id: row.id,
      buyer_user_id: integer(row.buyer_user_id),
      quantity_remaining: integer(row.quantity_remaining),
      unit_price: integer(row.unit_price),
      expires_at: integer(row.expires_at),
      created_at: integer(row.created_at),
    })),
  };
}
