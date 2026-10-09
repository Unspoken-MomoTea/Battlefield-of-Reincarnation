import { HttpError, json, readJson } from './http.js';
import { assertMarketActive } from './market-access.js';
import { refreshMarketCatalogKey } from './market-catalog.js';
import { marketSaleSettlement } from './market-economy.js';

const MARKET_ID_RE = /^[A-Za-z0-9:_-]{6,96}$/u;
const MAX_QUANTITY = 9999;
const MAX_LINES = 100;
const MASK_64 = (1n << 64n) - 1n;
const FNV_OFFSET = 1469598103934665603n;
const FNV_PRIME = 1099511628211n;

function integer(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function positiveInteger(value, { min = 1, max = Number.MAX_SAFE_INTEGER, label = '数值' } = {}) {
  const number = integer(value, NaN);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new HttpError(400, 'market_invalid_number', `${label}必须是 ${min}-${max} 的整数`);
  }
  return number;
}

function marketId(value, label = 'ID') {
  const id = String(value || '').trim();
  if (!MARKET_ID_RE.test(id)) throw new HttpError(400, 'market_invalid_id', `${label}格式无效`);
  return id;
}

function parseJson(value, fallback = {}) {
  try { return JSON.parse(String(value || '')); } catch { return fallback; }
}

function logicalKind(row) {
  return String(row?.market_kind || row?.asset_kind || '');
}

function purchaseFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    save_id: row.save_id || '',
    catalog_key: row.catalog_key,
    quantity: integer(row.quantity),
    total_price: integer(row.total_price),
    status: row.status,
    created_at: integer(row.created_at),
  };
}

function tradeFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    buyer_save_id: row.buyer_save_id || '',
    purchase_id: row.purchase_id || '',
    listing_id: row.listing_id,
    asset: {
      kind: logicalKind(row),
      name: String(row.asset_name || ''),
      quantity: integer(row.quantity, 1),
      data: parseJson(row.asset_json, {}),
    },
    quantity: integer(row.quantity),
    unit_price: integer(row.unit_price),
    total_price: integer(row.total_price),
    market_fee: integer(row.market_fee),
    seller_proceeds: integer(row.seller_proceeds),
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

async function all(env, sql, args = []) {
  const response = await env.DB.prepare(sql).bind(...args).all();
  return response?.results || [];
}

async function first(env, sql, args = []) {
  return env.DB.prepare(sql).bind(...args).first();
}

async function runBatch(env, statements) {
  if (typeof env.DB?.batch === 'function') return env.DB.batch(statements);
  const results = [];
  for (const statement of statements) results.push(await statement.run());
  return results;
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

function tradeIdFor(purchaseId, index) {
  return `purchase-trade:${fnv64(purchaseId)}:${index}`;
}

async function purchaseRows(env, purchaseId) {
  const purchase = await first(env, 'SELECT * FROM market_purchases WHERE id = ? LIMIT 1', [purchaseId]);
  if (!purchase) return null;
  const trades = await all(
    env,
    `SELECT t.*,
            seller.username AS seller_username,
            seller.display_name AS seller_display_name,
            buyer.username AS buyer_username,
            buyer.display_name AS buyer_display_name
     FROM market_trades t
     JOIN users seller ON seller.id = t.seller_user_id
     JOIN users buyer ON buyer.id = t.buyer_user_id
     WHERE t.purchase_id = ?
     ORDER BY t.unit_price ASC, t.created_at ASC, t.id ASC`,
    [purchaseId],
  );
  return {
    purchase: purchaseFromRow(purchase),
    trades: trades.map(tradeFromRow),
  };
}

async function planCatalogPurchase(env, user, catalogKey, requestedQuantity) {
  const key = String(catalogKey || '').trim();
  if (!key) throw new HttpError(400, 'market_catalog_required', '商品目录ID不能为空');

  const now = Date.now();
  const rows = await all(
    env,
    `SELECT l.*
     FROM market_listings l
     LEFT JOIN market_user_controls seller_control ON seller_control.user_id = l.seller_user_id
     WHERE l.catalog_key = ?
       AND l.status = 'active'
       AND l.remaining_quantity > 0
       AND COALESCE(seller_control.is_suspended, 0) = 0
       AND l.seller_user_id <> ?
       AND (l.is_system = 1 OR l.expires_at = 0 OR l.expires_at > ?)
     ORDER BY l.unit_price ASC, l.created_at DESC, l.id ASC
     LIMIT ?`,
    [key, user.id, now, MAX_LINES],
  );
  if (!rows.length) {
    throw new HttpError(409, 'market_catalog_unavailable', '当前没有可购买库存', {
      catalog_key: key,
      available_quantity: 0,
    });
  }

  const stackable = logicalKind(rows[0]) === 'item';
  const quantity = stackable ? requestedQuantity : 1;
  let remaining = quantity;
  const lines = [];
  for (const row of rows) {
    if (remaining <= 0) break;
    const available = Math.max(0, integer(row.remaining_quantity));
    if (!available) continue;
    const take = stackable ? Math.min(remaining, available) : 1;
    const settlement = Number(row.is_system)
      ? { market_fee: 0, seller_proceeds: 0 }
      : marketSaleSettlement(integer(row.unit_price) * take);
    lines.push({
      listing: row,
      quantity: take,
      subtotal: integer(row.unit_price) * take,
      market_fee: integer(settlement.market_fee),
      seller_proceeds: integer(settlement.seller_proceeds),
    });
    remaining -= take;
    if (!stackable) break;
  }

  const availableQuantity = quantity - remaining;
  if (remaining > 0) {
    throw new HttpError(409, 'market_quantity_unavailable', '当前可购买库存不足', {
      catalog_key: key,
      requested_quantity: quantity,
      available_quantity: availableQuantity,
    });
  }

  const totalPrice = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const levels = [];
  for (const line of lines) {
    const price = integer(line.listing.unit_price);
    const previous = levels[levels.length - 1];
    if (previous?.price === price) previous.quantity += line.quantity;
    else levels.push({ price, quantity: line.quantity });
  }

  return {
    catalog_key: key,
    quantity,
    total_price: totalPrice,
    levels,
    lines,
  };
}

export async function quoteMarketCatalogPurchase(request, env, user, catalogKey) {
  await assertMarketActive(env, user);
  const url = new URL(request.url);
  const quantity = positiveInteger(url.searchParams.get('quantity') || 1, {
    max: MAX_QUANTITY,
    label: '购买数量',
  });
  const plan = await planCatalogPurchase(env, user, catalogKey, quantity);
  return json({
    quote: {
      catalog_key: plan.catalog_key,
      quantity: plan.quantity,
      total_price: plan.total_price,
      levels: plan.levels,
    },
  });
}

export async function buyMarketCatalog(request, env, user, catalogKey) {
  await assertMarketActive(env, user);
  const body = await readJson(request, { maxBytes: 16 * 1024 });
  const purchaseId = marketId(body?.purchase_id, '购买ID');
  const requestedQuantity = positiveInteger(body?.quantity ?? 1, {
    max: MAX_QUANTITY,
    label: '购买数量',
  });
  const expectedTotal = positiveInteger(body?.expected_total, {
    max: Number.MAX_SAFE_INTEGER,
    label: '预期总价',
  });

  const existing = await purchaseRows(env, purchaseId);
  if (existing) {
    const row = await first(env, 'SELECT buyer_user_id, save_id FROM market_purchases WHERE id = ? LIMIT 1', [purchaseId]);
    if (Number(row?.buyer_user_id) !== Number(user.id) || row?.save_id !== user.market_save_id) {
      throw new HttpError(409, 'market_purchase_id_conflict', '购买ID已被占用');
    }
    if (existing.purchase.status === 'completed') return json(existing);
  }

  const plan = await planCatalogPurchase(env, user, catalogKey, requestedQuantity);
  if (plan.total_price !== expectedTotal) {
    throw new HttpError(409, 'market_price_changed', '市场价格已经变化，请重新确认', {
      catalog_key: plan.catalog_key,
      quantity: plan.quantity,
      expected_total: expectedTotal,
      current_total: plan.total_price,
      levels: plan.levels,
    });
  }

  const now = Date.now();
  const statements = [
    env.DB.prepare(
      `INSERT OR IGNORE INTO market_purchases
        (id, buyer_user_id, save_id, catalog_key, quantity, total_price, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    ).bind(purchaseId, user.id, user.market_save_id, plan.catalog_key, plan.quantity, plan.total_price, now),
  ];

  plan.lines.forEach((line, index) => {
    const tradeId = tradeIdFor(purchaseId, index);
    const row = line.listing;
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO market_trades
          (id, listing_id, seller_user_id, buyer_user_id, buyer_save_id, asset_kind, market_kind, asset_name,
           asset_json, quantity, unit_price, total_price, market_fee, seller_proceeds,
           purchase_id, delivered_at, created_at)
         SELECT ?, l.id, l.seller_user_id, ?, ?, l.asset_kind,
                COALESCE(NULLIF(l.market_kind, ''), l.asset_kind), l.asset_name, l.asset_json,
                ?, l.unit_price, l.unit_price * ?, ?, ?, ?, NULL, ?
         FROM market_listings l
         LEFT JOIN market_user_controls seller_control ON seller_control.user_id = l.seller_user_id
         WHERE l.id = ?
           AND l.catalog_key = ?
           AND l.status = 'active'
           AND l.remaining_quantity >= ?
           AND l.unit_price = ?
           AND l.seller_user_id <> ?
           AND COALESCE(seller_control.is_suspended, 0) = 0
           AND (l.is_system = 1 OR l.expires_at = 0 OR l.expires_at > ?)
           AND EXISTS (
             SELECT 1 FROM market_purchases p
             WHERE p.id = ? AND p.buyer_user_id = ? AND p.status = 'pending'
           )`,
      ).bind(
        tradeId,
        user.id,
        user.market_save_id,
        line.quantity,
        line.quantity,
        line.market_fee,
        line.seller_proceeds,
        purchaseId,
        now,
        row.id,
        plan.catalog_key,
        line.quantity,
        row.unit_price,
        user.id,
        now,
        purchaseId,
        user.id,
      ),
      env.DB.prepare(
        `UPDATE market_listings
         SET remaining_quantity = remaining_quantity - ?,
             status = CASE WHEN remaining_quantity - ? <= 0 THEN 'sold' ELSE 'active' END,
             updated_at = ?
         WHERE id = ?
           AND EXISTS (
             SELECT 1 FROM market_trades
             WHERE id = ? AND purchase_id = ? AND buyer_user_id = ?
           )`,
      ).bind(line.quantity, line.quantity, now, row.id, tradeId, purchaseId, user.id),
    );
  });

  statements.push(
    env.DB.prepare(
      `UPDATE market_purchases
       SET status = 'completed'
       WHERE id = ?
         AND buyer_user_id = ?
         AND status = 'pending'
         AND COALESCE((SELECT SUM(quantity) FROM market_trades WHERE purchase_id = ?), 0) = ?
         AND COALESCE((SELECT SUM(total_price) FROM market_trades WHERE purchase_id = ?), 0) = ?`,
    ).bind(purchaseId, user.id, purchaseId, plan.quantity, purchaseId, plan.total_price),
    env.DB.prepare(
      `UPDATE market_listings
       SET remaining_quantity = remaining_quantity + COALESCE((
             SELECT SUM(t.quantity)
             FROM market_trades t
             WHERE t.purchase_id = ? AND t.listing_id = market_listings.id
           ), 0),
           status = 'active',
           updated_at = ?
       WHERE id IN (
         SELECT listing_id FROM market_trades WHERE purchase_id = ?
       )
         AND EXISTS (
           SELECT 1 FROM market_purchases
           WHERE id = ? AND buyer_user_id = ? AND status = 'pending'
         )`,
    ).bind(purchaseId, now, purchaseId, purchaseId, user.id),
    env.DB.prepare(
      `DELETE FROM market_trades
       WHERE purchase_id = ?
         AND EXISTS (
           SELECT 1 FROM market_purchases
           WHERE id = ? AND buyer_user_id = ? AND status = 'pending'
         )`,
    ).bind(purchaseId, purchaseId, user.id),
    env.DB.prepare(
      `DELETE FROM market_purchases
       WHERE id = ? AND buyer_user_id = ? AND status = 'pending'`,
    ).bind(purchaseId, user.id),
    env.DB.prepare(
      `INSERT INTO market_save_wallets (user_id, save_id, balance, updated_at)
       SELECT t.seller_user_id, l.save_id, SUM(t.seller_proceeds), ?
       FROM market_trades t
       JOIN market_purchases p ON p.id = t.purchase_id
       JOIN market_listings l ON l.id = t.listing_id
       WHERE t.purchase_id = ?
         AND p.status = 'completed'
         AND t.seller_proceeds > 0
       GROUP BY t.seller_user_id, l.save_id
       ON CONFLICT(user_id, save_id) DO UPDATE SET
         balance = market_save_wallets.balance + excluded.balance,
         updated_at = excluded.updated_at`,
    ).bind(now, purchaseId),
  );

  try {
    await runBatch(env, statements);
  } catch (error) {
    const recovered = await purchaseRows(env, purchaseId);
    const recoveredOwner = recovered?.purchase
      ? await first(env, 'SELECT buyer_user_id, save_id FROM market_purchases WHERE id = ? LIMIT 1', [purchaseId])
      : null;
    if (
      !recovered?.purchase
      || recovered.purchase.status !== 'completed'
      || Number(recoveredOwner?.buyer_user_id) !== Number(user.id)
      || recoveredOwner?.save_id !== user.market_save_id
    ) throw error;
  }

  const result = await purchaseRows(env, purchaseId);
  const resultOwner = result?.purchase
    ? await first(env, 'SELECT buyer_user_id, save_id FROM market_purchases WHERE id = ? LIMIT 1', [purchaseId])
    : null;
  if (
    !result?.purchase
    || result.purchase.status !== 'completed'
    || Number(resultOwner?.buyer_user_id) !== Number(user.id)
    || resultOwner?.save_id !== user.market_save_id
  ) {
    const current = await planCatalogPurchase(env, user, catalogKey, requestedQuantity).catch(() => null);
    throw new HttpError(409, 'market_purchase_changed', '市场库存或价格刚刚发生变化，请重新确认', {
      catalog_key: String(catalogKey || ''),
      quantity: requestedQuantity,
      current_total: current?.total_price || 0,
      levels: current?.levels || [],
    });
  }

  await refreshMarketCatalogKey(env, plan.catalog_key);
  return json(result);
}

export async function getMarketPurchase(env, user, purchaseIdValue) {
  const purchaseId = marketId(purchaseIdValue, '购买ID');
  const owner = await first(env, 'SELECT buyer_user_id, save_id FROM market_purchases WHERE id = ? LIMIT 1', [purchaseId]);
  if (!owner || Number(owner.buyer_user_id) !== Number(user.id) || owner.save_id !== user.market_save_id) {
    throw new HttpError(404, 'market_purchase_not_found', '购买记录不存在');
  }
  const result = await purchaseRows(env, purchaseId);
  return json(result);
}
