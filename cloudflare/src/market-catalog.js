import { json } from './http.js';
import { marketQuality } from './market-economy.js';

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 80;
const MASK_64 = (1n << 64n) - 1n;
const FNV_OFFSET = 1469598103934665603n;
const FNV_PRIME = 1099511628211n;

function integer(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function parseJson(value, fallback = {}) {
  try { return JSON.parse(String(value || '')); } catch { return fallback; }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (key === '数量') continue;
    out[key] = stable(value[key]);
  }
  return out;
}

function fnv64(text) {
  let hash = FNV_OFFSET;
  const bytes = new TextEncoder().encode(String(text || ''));
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, '0');
}

function subtypeOf(asset) {
  const raw = asset?.data?.类型 ?? asset?.data?.子类型 ?? '';
  if (raw == null || typeof raw === 'object') return '';
  return String(raw).trim().slice(0, 64);
}

export function marketCatalogMetadata(asset) {
  const kind = String(asset?.kind || '').trim();
  const name = String(asset?.name || '').trim();
  const data = asset?.data && typeof asset.data === 'object' && !Array.isArray(asset.data)
    ? asset.data
    : {};
  const normalized = JSON.stringify({ kind, name, data: stable(data) });
  return {
    catalog_key: 'catalog:' + kind + ':' + fnv64(normalized),
    quality: marketQuality(data.品质 || data.层级 || asset?.quality || 'F'),
    subtype: subtypeOf(asset),
  };
}

function logicalKind(row) {
  return String(row?.market_kind || row?.asset_kind || '');
}

function listingAsset(row) {
  return {
    kind: logicalKind(row),
    name: String(row?.asset_name || ''),
    quantity: integer(row?.remaining_quantity, 1),
    data: parseJson(row?.asset_json, {}),
  };
}

async function all(env, sql, args = []) {
  const response = await env.DB.prepare(sql).bind(...args).all();
  return response?.results || [];
}

async function first(env, sql, args = []) {
  return env.DB.prepare(sql).bind(...args).first();
}

export async function backfillMarketCatalogMetadata(env, { limit = 250 } = {}) {
  const rows = await all(
    env,
    `SELECT id, asset_kind, market_kind, asset_name, asset_json, remaining_quantity
     FROM market_listings
     WHERE catalog_key = ''
     ORDER BY created_at ASC
     LIMIT ?`,
    [Math.max(1, Math.min(1000, integer(limit, 250)))],
  );
  const keys = new Set();
  for (const row of rows) {
    const meta = marketCatalogMetadata(listingAsset(row));
    keys.add(meta.catalog_key);
    await env.DB.prepare(
      `UPDATE market_listings
       SET catalog_key = ?, quality = ?, subtype = ?
       WHERE id = ? AND catalog_key = ''`,
    ).bind(meta.catalog_key, meta.quality, meta.subtype, row.id).run();
  }
  return [...keys];
}

export async function refreshMarketCatalogKey(env, catalogKey) {
  const key = String(catalogKey || '').trim();
  if (!key) return null;
  const now = Date.now();
  const condition = `FROM market_listings l
     LEFT JOIN market_user_controls mc ON mc.user_id = l.seller_user_id
     WHERE l.catalog_key = ?
       AND COALESCE(mc.is_suspended, 0) = 0
       AND l.status = 'active'
       AND l.remaining_quantity > 0
       AND (l.is_system = 1 OR l.expires_at = 0 OR l.expires_at > ?)`;
  const summary = await first(env,
    `SELECT COUNT(*) AS listing_count,
            COALESCE(SUM(l.remaining_quantity), 0) AS total_stock,
            COUNT(DISTINCT l.seller_user_id) AS seller_count,
            MAX(l.created_at) AS latest_at
     ${condition}`, [key, now]);
  if (!integer(summary?.listing_count)) {
    await env.DB.prepare('DELETE FROM market_catalog WHERE catalog_key = ?').bind(key).run();
    return null;
  }
  // Let indexed SQLite queries aggregate popular items; never materialize all listings in Worker memory.
  const cheapest = await first(env,
    `SELECT l.* ${condition}
     ORDER BY l.unit_price ASC, l.created_at DESC LIMIT 1`, [key, now]);
  await env.DB.prepare(
    `INSERT INTO market_catalog
      (catalog_key, asset_kind, asset_name, quality, subtype, asset_json,
       lowest_price, total_stock, listing_count, seller_count, latest_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(catalog_key) DO UPDATE SET
       asset_kind = excluded.asset_kind,
       asset_name = excluded.asset_name,
       quality = excluded.quality,
       subtype = excluded.subtype,
       asset_json = excluded.asset_json,
       lowest_price = excluded.lowest_price,
       total_stock = excluded.total_stock,
       listing_count = excluded.listing_count,
       seller_count = excluded.seller_count,
       latest_at = excluded.latest_at,
       updated_at = excluded.updated_at`,
  ).bind(
    key,
    logicalKind(cheapest),
    cheapest.asset_name,
    cheapest.quality || marketQuality(parseJson(cheapest.asset_json, {}).品质 || 'F'),
    cheapest.subtype || '',
    cheapest.asset_json,
    integer(cheapest.unit_price),
    integer(summary.total_stock),
    integer(summary.listing_count),
    integer(summary.seller_count),
    integer(summary.latest_at),
    now,
  ).run();

  return first(env, 'SELECT * FROM market_catalog WHERE catalog_key = ? LIMIT 1', [key]);
}

export async function refreshMarketCatalogForListing(env, listingId) {
  const row = await first(env, 'SELECT catalog_key FROM market_listings WHERE id = ? LIMIT 1', [listingId]);
  if (!row?.catalog_key) return null;
  return refreshMarketCatalogKey(env, row.catalog_key);
}

export async function refreshExpiredMarketCatalogs(env, { limit = 100 } = {}) {
  const rows = await all(
    env,
    `SELECT DISTINCT catalog_key
     FROM market_listings
     WHERE status = 'active'
       AND is_system = 0
       AND remaining_quantity > 0
       AND expires_at > 0
       AND expires_at <= ?
       AND catalog_key <> ''
     ORDER BY expires_at ASC
     LIMIT ?`,
    [Date.now(), Math.max(1, Math.min(500, integer(limit, 100)))],
  );
  for (const row of rows) await refreshMarketCatalogKey(env, row.catalog_key);
  return rows.length;
}

export async function rebuildMarketCatalog(env, { limit = 500 } = {}) {
  const backfilled = await backfillMarketCatalogMetadata(env, { limit });
  const rows = await all(
    env,
    `SELECT DISTINCT catalog_key
     FROM market_listings
     WHERE catalog_key <> ''
       AND status = 'active'
       AND remaining_quantity > 0
     ORDER BY updated_at DESC
     LIMIT ?`,
    [Math.max(1, Math.min(1000, integer(limit, 500)))],
  );
  const keys = new Set([...backfilled, ...rows.map(row => row.catalog_key)]);
  for (const key of keys) await refreshMarketCatalogKey(env, key);
  return { refreshed: keys.size };
}

async function ensureMarketCatalogReady(env) {
  const row = await first(env, 'SELECT COUNT(*) AS count FROM market_catalog');
  if (!integer(row?.count)) {
    await rebuildMarketCatalog(env, { limit: 1000 });
    return;
  }
  const keys = await backfillMarketCatalogMetadata(env, { limit: 50 });
  for (const key of keys) await refreshMarketCatalogKey(env, key);
}

function catalogItem(row) {
  return {
    key: row.catalog_key,
    kind: row.asset_kind,
    name: row.asset_name,
    quality: row.quality || '',
    subtype: row.subtype || '',
    asset: {
      kind: row.asset_kind,
      name: row.asset_name,
      quantity: integer(row.total_stock, 1),
      data: parseJson(row.asset_json, {}),
    },
    lowest_price: integer(row.lowest_price),
    total_stock: integer(row.total_stock),
    listing_count: integer(row.listing_count),
    seller_count: integer(row.seller_count),
    latest_at: integer(row.latest_at),
    updated_at: integer(row.updated_at),
  };
}

function filterParams(request) {
  const url = new URL(request.url);
  const kind = String(url.searchParams.get('kind') || '').trim();
  const quality = String(url.searchParams.get('quality') || '').trim().toUpperCase();
  const subtype = String(url.searchParams.get('subtype') || '').trim();
  const query = String(url.searchParams.get('q') || '').trim().slice(0, 80);
  const minPrice = Math.max(0, integer(url.searchParams.get('min_price'), 0));
  const maxPrice = Math.max(0, integer(url.searchParams.get('max_price'), 0));
  const sort = String(url.searchParams.get('sort') || 'price_asc');
  const limit = Math.max(1, Math.min(MAX_LIMIT, integer(url.searchParams.get('limit'), DEFAULT_LIMIT)));
  const offset = Math.max(0, integer(url.searchParams.get('offset'), 0));
  return { kind, quality, subtype, query, minPrice, maxPrice, sort, limit, offset };
}

export async function listMarketCatalog(request, env) {
  await ensureMarketCatalogReady(env);
  const params = filterParams(request);
  const clauses = ['total_stock > 0'];
  const args = [];
  if (params.kind) {
    clauses.push('asset_kind = ?');
    args.push(params.kind);
  }
  if (params.quality) {
    clauses.push('quality = ?');
    args.push(params.quality);
  }
  if (params.subtype) {
    clauses.push('subtype = ?');
    args.push(params.subtype);
  }
  if (params.query) {
    clauses.push('asset_name LIKE ?');
    args.push('%' + params.query + '%');
  }
  if (params.minPrice > 0) {
    clauses.push('lowest_price >= ?');
    args.push(params.minPrice);
  }
  if (params.maxPrice > 0) {
    clauses.push('lowest_price <= ?');
    args.push(params.maxPrice);
  }

  const order = params.sort === 'latest'
    ? 'latest_at DESC, asset_name ASC'
    : params.sort === 'price_desc'
      ? 'lowest_price DESC, asset_name ASC'
      : 'lowest_price ASC, asset_name ASC';
  const where = clauses.join(' AND ');
  const rows = await all(
    env,
    `SELECT * FROM market_catalog
     WHERE ${where}
     ORDER BY ${order}
     LIMIT ? OFFSET ?`,
    [...args, params.limit + 1, params.offset],
  );
  const hasMore = rows.length > params.limit;
  const page = hasMore ? rows.slice(0, params.limit) : rows;

  // Facets only matter on the first page. Recalculating all catalog counts
  // for every subsequent 80-row page exhausts D1 read quotas as the market grows.
  const includeFacets = params.offset === 0;
  let counts = {};
  let qualityRows = [];
  let subtypeRows = [];
  if (includeFacets) {
    const countRows = await all(
      env,
      `SELECT asset_kind, SUM(listing_count) AS count
       FROM market_catalog
       WHERE total_stock > 0
       GROUP BY asset_kind`,
    );
    counts = Object.fromEntries(countRows.map(row => [String(row.asset_kind), integer(row.count)]));
    const facetClauses = ['total_stock > 0'];
    const facetArgs = [];
    if (params.kind) {
      facetClauses.push('asset_kind = ?');
      facetArgs.push(params.kind);
    }
    const facetWhere = facetClauses.join(' AND ');
    qualityRows = await all(
      env,
      `SELECT quality, SUM(listing_count) AS count
       FROM market_catalog
       WHERE ${facetWhere} AND quality <> ''
       GROUP BY quality`,
      facetArgs,
    );
    subtypeRows = await all(
      env,
      `SELECT subtype, SUM(listing_count) AS count
       FROM market_catalog
       WHERE ${facetWhere} AND subtype <> ''
       GROUP BY subtype ORDER BY count DESC LIMIT 40`,
      facetArgs,
    );
  
  
  }
  return json({
    items: page.map(catalogItem),
    counts,
    facets: {
      qualities: qualityRows.map(row => ({ value: row.quality, count: integer(row.count) })),
      subtypes: subtypeRows.map(row => ({ value: row.subtype, count: integer(row.count) })),
    },
    next_offset: hasMore ? params.offset + params.limit : null,
  });
}

function listingView(row) {
  return {
    id: row.id,
    asset: listingAsset(row),
    catalog_key: row.catalog_key,
    unit_price: integer(row.unit_price),
    remaining_quantity: integer(row.remaining_quantity),
    expires_at: integer(row.expires_at),
    is_system: integer(row.is_system) === 1,
    created_at: integer(row.created_at),
    seller: {
      id: integer(row.seller_user_id),
      display_name: row.seller_display_name || row.seller_username || '匿名轮回者',
      username: row.seller_username || '',
    },
  };
}

export async function getMarketCatalogDetail(env, catalogKey, currentUserId = 0) {
  const key = String(catalogKey || '').trim();
  await refreshMarketCatalogKey(env, key);
  const catalog = await first(env, 'SELECT * FROM market_catalog WHERE catalog_key = ? LIMIT 1', [key]);
  if (!catalog) return json({ error: '商品已经下架', code: 'market_catalog_not_found' }, 404);

  const now = Date.now();
  const listings = await all(
    env,
    `SELECT l.*,
            u.username AS seller_username,
            u.display_name AS seller_display_name
     FROM market_listings l
     JOIN users u ON u.id = l.seller_user_id
     LEFT JOIN market_user_controls mc ON mc.user_id = l.seller_user_id
     WHERE l.catalog_key = ?
       AND COALESCE(mc.is_suspended, 0) = 0
       AND l.status = 'active'
       AND l.remaining_quantity > 0
       AND (l.is_system = 1 OR l.expires_at = 0 OR l.expires_at > ?)
     ORDER BY l.unit_price ASC, l.created_at DESC`,
    [key, now],
  );

  const ladderRows = await all(
    env,
    `SELECT l.unit_price AS price,
            SUM(l.remaining_quantity) AS stock,
            COUNT(DISTINCT l.seller_user_id) AS seller_count
     FROM market_listings l
     LEFT JOIN market_user_controls mc ON mc.user_id = l.seller_user_id
     WHERE l.catalog_key = ?
       AND COALESCE(mc.is_suspended, 0) = 0
       AND l.status = 'active'
       AND l.remaining_quantity > 0
       AND (l.is_system = 1 OR l.expires_at = 0 OR l.expires_at > ?)
       AND l.seller_user_id <> ?
     GROUP BY l.unit_price
     ORDER BY l.unit_price ASC
     LIMIT 20`,
    [key, now, integer(currentUserId)],
  );
  return json({
    catalog: catalogItem(catalog),
    listings: listings.map(listingView),
    ladder: ladderRows.map(row => ({
      price: integer(row.price),
      stock: integer(row.stock),
      seller_count: integer(row.seller_count),
    })),
  });
}

