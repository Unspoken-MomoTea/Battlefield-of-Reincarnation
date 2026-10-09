import { HttpError, json, readJson } from './http.js';
import { assertMarketUserAllowed } from './market-access.js';
import { marketAssetKey, recordMarketTrade } from './market-catalog.js';
import { marketSaleSettlement } from './market-economy.js';

const MARKET_KINDS = new Set(['equipment', 'item', 'skill', 'bloodline', 'form', 'teammate']);
const MARKET_ID_RE = /^[A-Za-z0-9:_-]{6,96}$/u;
const MAX_ASSET_BYTES = 32 * 1024;
const MAX_QUANTITY = 9999;
const MAX_PRICE = 1_000_000_000;
const DURATIONS = new Set([24, 48, 72]);

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
  if (!MARKET_ID_RE.test(id)) throw new HttpError(400, 'market_invalid_id', label + ' 格式无效');
  return id;
}

function parseJson(value, fallback = {}) {
  try { return JSON.parse(String(value || '')); } catch { return fallback; }
}

function assetFromBody(input) {
  const kind = String(input?.kind || '').trim();
  if (!MARKET_KINDS.has(kind)) throw new HttpError(400, 'market_invalid_kind', '资产类型无效');
  const name = String(input?.name || '').trim().slice(0, 120);
  if (!name) throw new HttpError(400, 'market_invalid_name', '资产名称不能为空');
  if (!input?.data || typeof input.data !== 'object' || Array.isArray(input.data)) {
    throw new HttpError(400, 'market_invalid_asset', '资产数据无效');
  }
  const quantity = kind === 'item'
    ? positiveInteger(input?.quantity, { max: MAX_QUANTITY, label: '数量' })
    : 1;
  const assetJson = JSON.stringify(input.data);
  if (new TextEncoder().encode(assetJson).byteLength > MAX_ASSET_BYTES) {
    throw new HttpError(413, 'market_asset_too_large', '单件交易资产数据过大');
  }
  return { kind, name, quantity, data: input.data, assetJson };
}

function assetFromRow(row, quantity) {
  return {
    kind: row.market_kind,
    name: row.asset_name,
    quantity: integer(quantity, 1),
    data: parseJson(row.asset_json, {}),
  };
}

function orderFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    market_key: row.market_key,
    asset: assetFromRow(row, row.quantity_remaining),
    quantity_total: integer(row.quantity_total),
    quantity_remaining: integer(row.quantity_remaining),
    unit_price: integer(row.unit_price),
    escrow_balance: integer(row.escrow_balance),
    status: row.status,
    expires_at: integer(row.expires_at),
    created_at: integer(row.created_at),
    updated_at: integer(row.updated_at),
    buyer: {
      id: integer(row.buyer_user_id),
      display_name: row.buyer_display_name || row.buyer_username || '匿名轮回者',
      username: row.buyer_username || '',
    },
  };
}

function fillFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    order_id: row.order_id,
    market_key: row.market_key,
    asset: assetFromRow(row, row.quantity),
    quantity: integer(row.quantity),
    unit_price: integer(row.unit_price),
    total_price: integer(row.total_price),
    market_fee: integer(row.market_fee),
    seller_proceeds: integer(row.seller_proceeds),
    delivered_at: row.delivered_at == null ? null : integer(row.delivered_at),
    created_at: integer(row.created_at),
    buyer: {
      id: integer(row.buyer_user_id),
      display_name: row.buyer_display_name || row.buyer_username || '匿名轮回者',
    },
    seller: {
      id: integer(row.seller_user_id),
      display_name: row.seller_display_name || row.seller_username || '匿名轮回者',
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

async function batch(env, statements) {
  if (typeof env.DB?.batch === 'function') return env.DB.batch(statements);
  const out = [];
  for (const statement of statements) out.push(await statement.run());
  return out;
}

const ORDER_SELECT = `
  SELECT
    o.*,
    buyer.username AS buyer_username,
    buyer.display_name AS buyer_display_name
  FROM market_orders o
  JOIN users buyer ON buyer.id = o.buyer_user_id
`;

const FILL_SELECT = `
  SELECT
    f.*,
    buyer.username AS buyer_username,
    buyer.display_name AS buyer_display_name,
    seller.username AS seller_username,
    seller.display_name AS seller_display_name
  FROM market_order_fills f
  JOIN users buyer ON buyer.id = f.buyer_user_id
  JOIN users seller ON seller.id = f.seller_user_id
`;

async function getOrder(env, id) {
  return orderFromRow(await first(env, `${ORDER_SELECT} WHERE o.id = ? LIMIT 1`, [id]));
}

async function getFillRow(env, id) {
  return first(env, `${FILL_SELECT} WHERE f.id = ? LIMIT 1`, [id]);
}

function refundId(orderId) {
  return 'or:' + String(orderId || '').slice(-88);
}

export async function createMarketOrder(request, env, user) {
  await assertMarketUserAllowed(env, user);
  const body = await readJson(request, { maxBytes: 64 * 1024 });
  const id = marketId(body?.id, '求购单 ID');
  const asset = assetFromBody(body?.asset);
  const quantity = asset.kind === 'item'
    ? positiveInteger(body?.quantity ?? asset.quantity, { max: MAX_QUANTITY, label: '求购数量' })
    : 1;
  const unitPrice = positiveInteger(body?.unit_price, { max: MAX_PRICE, label: '求购单价' });
  const durationHours = positiveInteger(body?.duration_hours ?? 24, { min: 24, max: 72, label: '求购时长' });
  if (!DURATIONS.has(durationHours)) {
    throw new HttpError(400, 'market_invalid_duration', '求购时长只支持 24、48 或 72 小时');
  }

  const existing = await getOrder(env, id);
  if (existing) {
    if (Number(existing.buyer.id) !== Number(user.id)) {
      throw new HttpError(409, 'market_order_id_conflict', '求购单 ID 已被占用');
    }
    return json({ order: existing });
  }

  const now = Date.now();
  const marketKey = marketAssetKey(asset);
  await env.DB.prepare(
    `INSERT INTO market_orders
      (id, buyer_user_id, market_key, market_kind, asset_name, asset_json,
       quantity_total, quantity_remaining, unit_price, escrow_balance, status,
       expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
  ).bind(
    id,
    user.id,
    marketKey,
    asset.kind,
    asset.name,
    asset.assetJson,
    quantity,
    quantity,
    unitPrice,
    unitPrice * quantity,
    now + durationHours * 60 * 60 * 1000,
    now,
    now,
  ).run();

  return json({ order: await getOrder(env, id) }, 201);
}

export async function getMarketOrder(env, user, idValue) {
  const id = marketId(idValue, '求购单 ID');
  const order = await getOrder(env, id);
  if (!order || Number(order.buyer.id) !== Number(user.id)) {
    throw new HttpError(404, 'market_order_not_found', '求购单不存在');
  }
  return json({ order });
}

async function cancelOrderRow(env, row, status = 'cancelled') {
  if (!row || row.status !== 'active') return;
  const refund = Math.max(0, integer(row.escrow_balance));
  const now = Date.now();
  const statements = [
    env.DB.prepare(
      `UPDATE market_orders
       SET status = ?, escrow_balance = 0, updated_at = ?
       WHERE id = ? AND status = 'active'`,
    ).bind(status, now, row.id),
  ];
  if (refund > 0) {
    statements.unshift(
      env.DB.prepare(
        `INSERT OR IGNORE INTO market_payouts (id, user_id, amount, confirmed_at, created_at)
         VALUES (?, ?, ?, NULL, ?)`,
      ).bind(refundId(row.id), row.buyer_user_id, refund, now),
    );
  }
  await batch(env, statements);
}

export async function cancelMarketOrder(env, user, idValue) {
  await assertMarketUserAllowed(env, user);
  const id = marketId(idValue, '求购单 ID');
  const row = await first(env, 'SELECT * FROM market_orders WHERE id = ? LIMIT 1', [id]);
  if (!row || Number(row.buyer_user_id) !== Number(user.id)) {
    throw new HttpError(404, 'market_order_not_found', '求购单不存在');
  }
  if (row.status === 'active') await cancelOrderRow(env, row, 'cancelled');
  const payout = await first(
    env,
    'SELECT * FROM market_payouts WHERE id = ? AND user_id = ? LIMIT 1',
    [refundId(id), user.id],
  );
  return json({
    order: await getOrder(env, id),
    payout: payout ? {
      id: payout.id,
      amount: integer(payout.amount),
      confirmed_at: payout.confirmed_at == null ? null : integer(payout.confirmed_at),
      created_at: integer(payout.created_at),
    } : null,
  });
}

export async function expireMarketOrders(env, { limit = 200 } = {}) {
  const now = Date.now();
  const rows = await all(
    env,
    `SELECT * FROM market_orders
     WHERE status = 'active' AND expires_at <= ?
     ORDER BY expires_at ASC
     LIMIT ?`,
    [now, Math.max(1, Math.min(500, integer(limit, 200)))],
  );
  for (const row of rows) await cancelOrderRow(env, row, 'expired');
  return { processed: rows.length };
}

export async function fillMarketOrder(request, env, user, idValue) {
  await assertMarketUserAllowed(env, user);
  const orderId = marketId(idValue, '求购单 ID');
  const body = await readJson(request, { maxBytes: 64 * 1024 });
  const fillId = marketId(body?.fill_id, '成交 ID');
  const asset = assetFromBody(body?.asset);
  const quantity = asset.kind === 'item'
    ? positiveInteger(body?.quantity ?? asset.quantity, { max: MAX_QUANTITY, label: '出售数量' })
    : 1;

  const existingFill = await getFillRow(env, fillId);
  if (existingFill) {
    if (Number(existingFill.seller_user_id) !== Number(user.id)) {
      throw new HttpError(409, 'market_fill_id_conflict', '成交 ID 已被占用');
    }
    return json({ fill: fillFromRow(existingFill), order: await getOrder(env, orderId) });
  }

  const row = await first(env, 'SELECT * FROM market_orders WHERE id = ? LIMIT 1', [orderId]);
  if (!row || row.status !== 'active' || integer(row.expires_at) <= Date.now()) {
    throw new HttpError(409, 'market_order_unavailable', '该求购单已经失效');
  }
  if (Number(row.buyer_user_id) === Number(user.id)) {
    throw new HttpError(409, 'market_own_order', '不能向自己的求购单出售');
  }
  const key = marketAssetKey(asset);
  if (key !== row.market_key) {
    throw new HttpError(409, 'market_order_asset_mismatch', '当前资产与求购目标不一致');
  }
  if (quantity > integer(row.quantity_remaining)) {
    throw new HttpError(409, 'market_order_quantity_unavailable', '求购剩余数量不足');
  }

  const total = integer(row.unit_price) * quantity;
  if (integer(row.escrow_balance) < total) {
    throw new HttpError(409, 'market_order_escrow_invalid', '求购托管余额不足');
  }
  const settlement = marketSaleSettlement(total);
  const now = Date.now();
  try {
    await batch(env, [
      env.DB.prepare(
        `INSERT INTO market_order_fills
          (id, order_id, buyer_user_id, seller_user_id, market_key, market_kind, asset_name,
           asset_json, quantity, unit_price, total_price, market_fee, seller_proceeds,
           seller_credited_at, delivered_at, created_at)
         SELECT ?, o.id, o.buyer_user_id, ?, o.market_key, o.market_kind, o.asset_name,
                ?, ?, o.unit_price, o.unit_price * ?, ?, ?, NULL, NULL, ?
         FROM market_orders o
         WHERE o.id = ? AND o.status = 'active' AND o.quantity_remaining >= ?
           AND o.escrow_balance >= o.unit_price * ? AND o.buyer_user_id <> ?`,
      ).bind(
        fillId,
        user.id,
        asset.assetJson,
        quantity,
        quantity,
        settlement.market_fee,
        settlement.seller_proceeds,
        now,
        orderId,
        quantity,
        quantity,
        user.id,
      ),
      env.DB.prepare(
        `UPDATE market_orders
         SET quantity_remaining = quantity_remaining - ?,
             escrow_balance = escrow_balance - unit_price * ?,
             status = CASE WHEN quantity_remaining - ? <= 0 THEN 'filled' ELSE 'active' END,
             updated_at = ?
         WHERE id = ?
           AND EXISTS (SELECT 1 FROM market_order_fills WHERE id = ?)`,
      ).bind(quantity, quantity, quantity, now, orderId, fillId),
      env.DB.prepare(
        `INSERT INTO market_wallets (user_id, balance, updated_at)
         SELECT seller_user_id, seller_proceeds, ?
         FROM market_order_fills
         WHERE id = ? AND seller_credited_at IS NULL
         ON CONFLICT(user_id) DO UPDATE SET
           balance = market_wallets.balance + excluded.balance,
           updated_at = excluded.updated_at`,
      ).bind(now, fillId),
      env.DB.prepare(
        `UPDATE market_order_fills SET seller_credited_at = COALESCE(seller_credited_at, ?)
         WHERE id = ?`,
      ).bind(now, fillId),
    ]);
  } catch (error) {
    const retry = await getFillRow(env, fillId);
    if (!retry) throw error;
  }

  const fillRow = await getFillRow(env, fillId);
  if (!fillRow) throw new HttpError(409, 'market_order_unavailable', '求购单刚刚发生变化，请刷新后重试');

  await recordMarketTrade(env, {
    marketKey: fillRow.market_key,
    kind: fillRow.market_kind,
    name: fillRow.asset_name,
    assetJson: fillRow.asset_json,
    unitPrice: fillRow.unit_price,
    quantity: fillRow.quantity,
    at: fillRow.created_at,
  });

  return json({ fill: fillFromRow(fillRow), order: await getOrder(env, orderId) });
}

export async function getMarketOrderFill(env, user, fillIdValue) {
  const id = marketId(fillIdValue, '成交 ID');
  const row = await getFillRow(env, id);
  if (!row || (Number(row.buyer_user_id) !== Number(user.id) && Number(row.seller_user_id) !== Number(user.id))) {
    throw new HttpError(404, 'market_order_fill_not_found', '求购成交不存在');
  }
  return json({ fill: fillFromRow(row) });
}

export async function confirmMarketOrderDelivery(env, user, fillIdValue) {
  const id = marketId(fillIdValue, '成交 ID');
  const now = Date.now();
  await env.DB.prepare(
    `UPDATE market_order_fills
     SET delivered_at = COALESCE(delivered_at, ?)
     WHERE id = ? AND buyer_user_id = ?`,
  ).bind(now, id, user.id).run();
  const row = await getFillRow(env, id);
  if (!row || Number(row.buyer_user_id) !== Number(user.id)) {
    throw new HttpError(404, 'market_order_fill_not_found', '求购成交不存在');
  }
  return json({ fill: fillFromRow(row) });
}

export async function marketOrderStateForUser(env, user) {
  await expireMarketOrders(env);
  const [orders, purchases, sales, pending] = await Promise.all([
    all(env, `${ORDER_SELECT} WHERE o.buyer_user_id = ? ORDER BY o.created_at DESC LIMIT 80`, [user.id]),
    all(env, `${FILL_SELECT} WHERE f.buyer_user_id = ? ORDER BY f.created_at DESC LIMIT 80`, [user.id]),
    all(env, `${FILL_SELECT} WHERE f.seller_user_id = ? ORDER BY f.created_at DESC LIMIT 80`, [user.id]),
    all(env, `${FILL_SELECT} WHERE f.buyer_user_id = ? AND f.delivered_at IS NULL ORDER BY f.created_at ASC LIMIT 80`, [user.id]),
  ]);
  return {
    orders: orders.map(orderFromRow),
    purchases: purchases.map(fillFromRow),
    sales: sales.map(fillFromRow),
    pending_deliveries: pending.map(fillFromRow),
  };
}
