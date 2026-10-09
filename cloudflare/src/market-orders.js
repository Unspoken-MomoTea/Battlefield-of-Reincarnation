import { HttpError, json, readJson } from './http.js';
import { assertMarketActive } from './market-access.js';
import { marketCatalogMetadata } from './market-catalog.js';

const MARKET_ID_RE = /^[A-Za-z0-9:_-]{6,96}$/u;
const MARKET_KINDS = new Set(['equipment', 'item', 'skill', 'bloodline', 'form', 'teammate']);
const MAX_PRICE = 1_000_000_000;
const MAX_QUANTITY = 9999;
const MAX_ASSET_BYTES = 32 * 1024;
const ORDER_DURATIONS = new Set([24, 48, 72]);

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

function text(value, max = 120) {
  return String(value ?? '').trim().slice(0, max);
}

function assetFromBody(input) {
  const kind = String(input?.kind || '').trim();
  if (!MARKET_KINDS.has(kind)) throw new HttpError(400, 'market_invalid_kind', '资产类型无效');
  const name = text(input?.name);
  if (!name) throw new HttpError(400, 'market_invalid_name', '资产名称不能为空');
  const data = input?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpError(400, 'market_invalid_asset', '资产数据无效');
  }
  const quantity = kind === 'item'
    ? positiveInteger(input?.quantity, { max: MAX_QUANTITY, label: '数量' })
    : 1;
  const assetJson = JSON.stringify(data);
  if (new TextEncoder().encode(assetJson).byteLength > MAX_ASSET_BYTES) {
    throw new HttpError(413, 'market_asset_too_large', '单件交易资产数据过大');
  }
  return { kind, name, data, quantity, assetJson };
}

function parseJson(value, fallback = {}) {
  try { return JSON.parse(String(value || '')); } catch { return fallback; }
}

function orderFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    asset_kind: row.asset_kind,
    asset_name: row.asset_name,
    quality: row.quality || '',
    subtype: row.subtype || '',
    unit_price: integer(row.unit_price),
    total_quantity: integer(row.total_quantity),
    remaining_quantity: integer(row.remaining_quantity),
    escrow_balance: integer(row.escrow_balance),
    status: row.status,
    expires_at: integer(row.expires_at),
    created_at: integer(row.created_at),
    updated_at: integer(row.updated_at),
    buyer: row.buyer_user_id ? {
      id: integer(row.buyer_user_id),
      display_name: row.buyer_display_name || row.buyer_username || '匿名轮回者',
      username: row.buyer_username || '',
    } : undefined,
  };
}

function orderFillFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    order_id: row.order_id,
    buyer_save_id: row.buyer_save_id || '',
    seller_save_id: row.seller_save_id || '',
    asset: {
      kind: row.asset_kind,
      name: row.asset_name,
      quantity: integer(row.quantity, 1),
      data: parseJson(row.asset_json, {}),
    },
    quantity: integer(row.quantity),
    unit_price: integer(row.unit_price),
    total_price: integer(row.total_price),
    delivered_at: row.delivered_at == null ? null : integer(row.delivered_at),
    created_at: integer(row.created_at),
    seller: {
      id: integer(row.seller_user_id),
      display_name: row.seller_display_name || row.seller_username || '匿名轮回者',
    },
    buyer: {
      id: integer(row.buyer_user_id),
      display_name: row.buyer_display_name || row.buyer_username || '匿名轮回者',
    },
  };
}

function swapFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    offered: {
      kind: row.offered_kind,
      name: row.offered_name,
      quantity: integer(row.offered_quantity, 1),
      data: parseJson(row.offered_json, {}),
    },
    wanted: {
      kind: row.wanted_kind,
      name: row.wanted_name,
      quality: row.wanted_quality || '',
      subtype: row.wanted_subtype || '',
      quantity: integer(row.wanted_quantity, 1),
    },
    status: row.status,
    expires_at: integer(row.expires_at),
    accepted_by_user_id: row.accepted_by_user_id == null ? null : integer(row.accepted_by_user_id),
    created_at: integer(row.created_at),
    updated_at: integer(row.updated_at),
    owner: {
      id: integer(row.owner_user_id),
      display_name: row.owner_display_name || row.owner_username || '匿名轮回者',
      username: row.owner_username || '',
    },
  };
}

function swapTransferFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    swap_id: row.swap_id,
    save_id: row.save_id || '',
    asset: {
      kind: row.asset_kind,
      name: row.asset_name,
      quantity: integer(row.quantity, 1),
      data: parseJson(row.asset_json, {}),
    },
    quantity: integer(row.quantity),
    confirmed_at: row.confirmed_at == null ? null : integer(row.confirmed_at),
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

async function runBatch(env, statements) {
  if (typeof env.DB.batch === 'function') return env.DB.batch(statements);
  const results = [];
  for (const statement of statements) results.push(await statement.run());
  return results;
}

function durationHours(value) {
  const hours = positiveInteger(value ?? 24, { min: 24, max: 72, label: '时长' });
  if (!ORDER_DURATIONS.has(hours)) {
    throw new HttpError(400, 'market_invalid_duration', '只支持24、48或72小时');
  }
  return hours;
}

function wantedFromBody(input) {
  const kind = String(input?.kind || '').trim();
  if (!MARKET_KINDS.has(kind)) throw new HttpError(400, 'market_invalid_kind', '需求资产类型无效');
  const name = text(input?.name);
  if (!name) throw new HttpError(400, 'market_invalid_name', '需求资产名称不能为空');
  const quality = text(input?.quality, 16).toUpperCase();
  const subtype = text(input?.subtype, 64);
  const quantity = kind === 'item'
    ? positiveInteger(input?.quantity ?? 1, { max: MAX_QUANTITY, label: '数量' })
    : 1;
  return { kind, name, quality, subtype, quantity };
}

function assetMatchesWanted(asset, wanted) {
  if (asset.kind !== wanted.kind) return false;
  if (asset.name !== wanted.name) return false;
  const meta = marketCatalogMetadata(asset);
  if (wanted.quality && meta.quality !== wanted.quality) return false;
  if (wanted.subtype && meta.subtype !== wanted.subtype) return false;
  return true;
}

export async function listMarketBuyOrders(request, env) {
  const url = new URL(request.url);
  const kind = text(url.searchParams.get('kind'), 32);
  const quality = text(url.searchParams.get('quality'), 16).toUpperCase();
  const query = text(url.searchParams.get('q'), 80);
  const limit = Math.max(1, Math.min(80, integer(url.searchParams.get('limit'), 40)));
  const offset = Math.max(0, integer(url.searchParams.get('offset'), 0));
  const clauses = [
    "o.status = 'active'",
    'o.remaining_quantity > 0',
    'o.expires_at > ?',
    'COALESCE(mc.is_suspended, 0) = 0',
  ];
  const args = [Date.now()];
  if (kind) { clauses.push('o.asset_kind = ?'); args.push(kind); }
  if (quality) { clauses.push('o.quality = ?'); args.push(quality); }
  if (query) { clauses.push('o.asset_name LIKE ?'); args.push('%' + query + '%'); }

  const rows = await all(
    env,
    `SELECT o.*, u.username AS buyer_username, u.display_name AS buyer_display_name
     FROM market_buy_orders o
     JOIN users u ON u.id = o.buyer_user_id
     LEFT JOIN market_user_controls mc ON mc.user_id = o.buyer_user_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY o.unit_price DESC, o.created_at DESC
     LIMIT ? OFFSET ?`,
    [...args, limit + 1, offset],
  );
  const hasMore = rows.length > limit;
  return json({
    items: (hasMore ? rows.slice(0, limit) : rows).map(orderFromRow),
    next_offset: hasMore ? offset + limit : null,
  });
}

export async function createMarketBuyOrder(request, env, user) {
  await assertMarketActive(env, user);
  const body = await readJson(request, { maxBytes: 32 * 1024 });
  const id = marketId(body?.id, '求购单ID');
  const existing = await first(env, 'SELECT * FROM market_buy_orders WHERE id = ? LIMIT 1', [id]);
  if (existing) {
    if (Number(existing.buyer_user_id) !== Number(user.id) || existing.save_id !== user.market_save_id) {
      throw new HttpError(409, 'market_id_conflict', '求购单ID已被占用');
    }
    return json({ order: orderFromRow(existing) });
  }

  const wanted = wantedFromBody(body);
  const unitPrice = positiveInteger(body?.unit_price, { max: MAX_PRICE, label: '单价' });
  const hours = durationHours(body?.duration_hours);
  const total = unitPrice * wanted.quantity;
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO market_buy_orders
      (id, buyer_user_id, save_id, asset_kind, asset_name, quality, subtype, unit_price,
       total_quantity, remaining_quantity, escrow_balance, status, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
  ).bind(
    id, user.id, user.market_save_id, wanted.kind, wanted.name, wanted.quality, wanted.subtype, unitPrice,
    wanted.quantity, wanted.quantity, total, now + hours * 60 * 60 * 1000, now, now,
  ).run();
  const row = await first(env, 'SELECT * FROM market_buy_orders WHERE id = ? LIMIT 1', [id]);
  return json({ order: orderFromRow(row) }, 201);
}

export async function getMarketBuyOrder(env, user, orderIdValue) {
  const id = marketId(orderIdValue, '求购单ID');
  const row = await first(env, 'SELECT * FROM market_buy_orders WHERE id = ? LIMIT 1', [id]);
  if (!row || Number(row.buyer_user_id) !== Number(user.id) || row.save_id !== user.market_save_id) {
    throw new HttpError(404, 'market_order_not_found', '求购单不存在');
  }
  return json({ order: orderFromRow(row) });
}

export async function fillMarketBuyOrder(request, env, user, orderIdValue) {
  await assertMarketActive(env, user);
  const orderId = marketId(orderIdValue, '求购单ID');
  const body = await readJson(request, { maxBytes: 64 * 1024 });
  const fillId = marketId(body?.fill_id, '成交ID');
  const existingFill = await first(env, 'SELECT * FROM market_order_fills WHERE id = ? LIMIT 1', [fillId]);
  if (existingFill) {
    if (Number(existingFill.seller_user_id) !== Number(user.id)
      || existingFill.seller_save_id !== user.market_save_id) {
      throw new HttpError(409, 'market_id_conflict', '成交ID已被占用');
    }
    return json({ fill: orderFillFromRow(existingFill) });
  }

  const order = await first(
    env,
    `SELECT o.*, COALESCE(mc.is_suspended, 0) AS buyer_market_suspended
     FROM market_buy_orders o
     LEFT JOIN market_user_controls mc ON mc.user_id = o.buyer_user_id
     WHERE o.id = ? LIMIT 1`,
    [orderId],
  );
  if (
    !order
    || order.status !== 'active'
    || Number(order.buyer_market_suspended)
    || integer(order.remaining_quantity) <= 0
    || integer(order.expires_at) <= Date.now()
  ) {
    throw new HttpError(409, 'market_order_unavailable', '求购单已经不可成交');
  }
  if (Number(order.buyer_user_id) === Number(user.id)) {
    throw new HttpError(409, 'market_own_order', '不能完成自己的求购单');
  }

  const asset = assetFromBody(body?.asset);
  const quantity = asset.kind === 'item'
    ? Math.min(asset.quantity, integer(order.remaining_quantity))
    : 1;
  const wanted = {
    kind: order.asset_kind,
    name: order.asset_name,
    quality: order.quality || '',
    subtype: order.subtype || '',
  };
  if (!assetMatchesWanted(asset, wanted)) {
    throw new HttpError(409, 'market_order_mismatch', '该资产不符合求购条件');
  }
  if (quantity <= 0 || quantity > integer(order.remaining_quantity)) {
    throw new HttpError(409, 'market_order_quantity', '求购剩余数量不足');
  }

  const total = integer(order.unit_price) * quantity;
  if (integer(order.escrow_balance) < total) {
    throw new HttpError(409, 'market_order_escrow', '求购托管金额不足');
  }
  const now = Date.now();
  await runBatch(env, [
    env.DB.prepare(
      `INSERT INTO market_order_fills
        (id, order_id, seller_user_id, buyer_user_id, buyer_save_id, seller_save_id, asset_kind, asset_name, asset_json,
         quantity, unit_price, total_price, delivered_at, created_at)
       SELECT ?, o.id, ?, o.buyer_user_id, o.save_id, ?, ?, ?, ?, ?, o.unit_price, o.unit_price * ?, NULL, ?
       FROM market_buy_orders o
       LEFT JOIN market_user_controls buyer_control ON buyer_control.user_id = o.buyer_user_id
       WHERE o.id = ?
         AND o.status = 'active'
         AND COALESCE(buyer_control.is_suspended, 0) = 0
         AND o.expires_at > ?
         AND o.buyer_user_id <> ?
         AND o.remaining_quantity >= ?
         AND o.escrow_balance >= o.unit_price * ?`,
    ).bind(
      fillId,
      user.id,
      user.market_save_id,
      asset.kind,
      asset.name,
      asset.assetJson,
      quantity,
      quantity,
      now,
      orderId,
      now,
      user.id,
      quantity,
      quantity,
    ),
    env.DB.prepare(
      `UPDATE market_buy_orders
       SET remaining_quantity = remaining_quantity - ?,
           escrow_balance = escrow_balance - ?,
           status = CASE WHEN remaining_quantity - ? <= 0 THEN 'filled' ELSE 'active' END,
           updated_at = ?
       WHERE id = ?
         AND EXISTS (
           SELECT 1 FROM market_order_fills
           WHERE id = ? AND order_id = ? AND seller_user_id = ?
         )`,
    ).bind(quantity, total, quantity, now, orderId, fillId, orderId, user.id),
    env.DB.prepare(
      `INSERT INTO market_save_wallets (user_id, save_id, balance, updated_at)
       SELECT seller_user_id, seller_save_id, total_price, ?
       FROM market_order_fills
       WHERE id = ? AND seller_user_id = ? AND seller_save_id = ?
       ON CONFLICT(user_id, save_id) DO UPDATE SET
         balance = market_save_wallets.balance + excluded.balance,
         updated_at = excluded.updated_at`,
    ).bind(now, fillId, user.id, user.market_save_id),
  ]);
  const row = await first(env, 'SELECT * FROM market_order_fills WHERE id = ? LIMIT 1', [fillId]);
  if (!row) {
    throw new HttpError(409, 'market_order_changed', '求购单刚刚被其他玩家完成或剩余数量已变化');
  }
  return json({ fill: orderFillFromRow(row) });
}

export async function cancelMarketBuyOrder(env, user, orderIdValue) {
  const id = marketId(orderIdValue, '求购单ID');
  const order = await first(env, 'SELECT * FROM market_buy_orders WHERE id = ? LIMIT 1', [id]);
  if (!order || Number(order.buyer_user_id) !== Number(user.id)
    || order.save_id !== user.market_save_id) {
    throw new HttpError(404, 'market_order_not_found', '求购单不存在');
  }
  if (order.status !== 'active') return json({ order: orderFromRow(order), payout: null });

  const now = Date.now();
  const payoutId = ('order-refund:' + id).slice(0, 96);
  await runBatch(env, [
    env.DB.prepare(
      `INSERT OR IGNORE INTO market_payouts (id, user_id, save_id, amount, confirmed_at, created_at)
       SELECT ?, buyer_user_id, save_id, escrow_balance, NULL, ?
       FROM market_buy_orders
       WHERE id = ? AND buyer_user_id = ? AND status = 'active' AND escrow_balance > 0`,
    ).bind(payoutId, now, id, user.id),
    env.DB.prepare(
      `UPDATE market_buy_orders
       SET status = 'cancelled', escrow_balance = 0, updated_at = ?
       WHERE id = ? AND buyer_user_id = ? AND status = 'active'
         AND (
           escrow_balance = 0
           OR EXISTS (
             SELECT 1 FROM market_payouts
             WHERE id = ? AND user_id = ?
           )
         )`,
    ).bind(now, id, user.id, payoutId, user.id),
  ]);
  const updated = await first(env, 'SELECT * FROM market_buy_orders WHERE id = ? LIMIT 1', [id]);
  const payout = await first(env, 'SELECT * FROM market_payouts WHERE id = ? LIMIT 1', [payoutId]);
  return json({
    order: orderFromRow(updated),
    payout: payout ? {
      id: payout.id,
      amount: integer(payout.amount),
      confirmed_at: payout.confirmed_at == null ? null : integer(payout.confirmed_at),
      created_at: integer(payout.created_at),
    } : null,
  });
}

export async function confirmMarketOrderFill(env, user, fillIdValue) {
  const id = marketId(fillIdValue, '成交ID');
  const row = await first(env, 'SELECT * FROM market_order_fills WHERE id = ? LIMIT 1', [id]);
  if (!row || Number(row.buyer_user_id) !== Number(user.id)
    || row.buyer_save_id !== user.market_save_id) {
    throw new HttpError(404, 'market_order_fill_not_found', '求购成交记录不存在');
  }
  if (row.delivered_at == null) {
    await env.DB.prepare('UPDATE market_order_fills SET delivered_at = ? WHERE id = ? AND buyer_save_id = ? AND delivered_at IS NULL')
      .bind(Date.now(), id, user.market_save_id).run();
  }
  const updated = await first(env, 'SELECT * FROM market_order_fills WHERE id = ? LIMIT 1', [id]);
  return json({ fill: orderFillFromRow(updated) });
}

export async function listMarketSwaps(request, env) {
  const url = new URL(request.url);
  const kind = text(url.searchParams.get('kind'), 32);
  const quality = text(url.searchParams.get('quality'), 16).toUpperCase();
  const query = text(url.searchParams.get('q'), 80);
  const limit = Math.max(1, Math.min(80, integer(url.searchParams.get('limit'), 40)));
  const offset = Math.max(0, integer(url.searchParams.get('offset'), 0));
  const clauses = [
    "s.status = 'active'",
    's.expires_at > ?',
    'COALESCE(mc.is_suspended, 0) = 0',
  ];
  const args = [Date.now()];
  if (kind) { clauses.push('s.wanted_kind = ?'); args.push(kind); }
  if (quality) { clauses.push('s.wanted_quality = ?'); args.push(quality); }
  if (query) {
    clauses.push('(s.offered_name LIKE ? OR s.wanted_name LIKE ?)');
    args.push('%' + query + '%', '%' + query + '%');
  }
  const rows = await all(
    env,
    `SELECT s.*, u.username AS owner_username, u.display_name AS owner_display_name
     FROM market_swaps s
     JOIN users u ON u.id = s.owner_user_id
     LEFT JOIN market_user_controls mc ON mc.user_id = s.owner_user_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?`,
    [...args, limit + 1, offset],
  );
  const hasMore = rows.length > limit;
  return json({
    items: (hasMore ? rows.slice(0, limit) : rows).map(swapFromRow),
    next_offset: hasMore ? offset + limit : null,
  });
}

export async function createMarketSwap(request, env, user) {
  await assertMarketActive(env, user);
  const body = await readJson(request, { maxBytes: 64 * 1024 });
  const id = marketId(body?.id, '交换单ID');
  const existing = await first(env, 'SELECT * FROM market_swaps WHERE id = ? LIMIT 1', [id]);
  if (existing) {
    if (Number(existing.owner_user_id) !== Number(user.id) || existing.owner_save_id !== user.market_save_id) {
      throw new HttpError(409, 'market_id_conflict', '交换单ID已被占用');
    }
    return json({ swap: swapFromRow(existing) });
  }
  const offered = assetFromBody(body?.offered);
  const wanted = wantedFromBody(body?.wanted);
  const hours = durationHours(body?.duration_hours);
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO market_swaps
      (id, owner_user_id, owner_save_id, offered_kind, offered_name, offered_json, offered_quantity,
       wanted_kind, wanted_name, wanted_quality, wanted_subtype, wanted_quantity,
       status, accepted_by_user_id, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?, ?)`,
  ).bind(
    id, user.id, user.market_save_id, offered.kind, offered.name, offered.assetJson, offered.quantity,
    wanted.kind, wanted.name, wanted.quality, wanted.subtype, wanted.quantity,
    now + hours * 60 * 60 * 1000, now, now,
  ).run();
  const row = await first(env, 'SELECT * FROM market_swaps WHERE id = ? LIMIT 1', [id]);
  return json({ swap: swapFromRow(row) }, 201);
}

export async function getMarketSwap(env, user, swapIdValue) {
  const id = marketId(swapIdValue, '交换单ID');
  const row = await first(env, 'SELECT * FROM market_swaps WHERE id = ? LIMIT 1', [id]);
  if (!row || Number(row.owner_user_id) !== Number(user.id) || row.owner_save_id !== user.market_save_id) {
    throw new HttpError(404, 'market_swap_not_found', '交换单不存在');
  }
  return json({ swap: swapFromRow(row) });
}

export async function acceptMarketSwap(request, env, user, swapIdValue) {
  await assertMarketActive(env, user);
  const id = marketId(swapIdValue, '交换单ID');
  const body = await readJson(request, { maxBytes: 64 * 1024 });
  const asset = assetFromBody(body?.asset);
  const swap = await first(
    env,
    `SELECT s.*, COALESCE(mc.is_suspended, 0) AS owner_market_suspended
     FROM market_swaps s
     LEFT JOIN market_user_controls mc ON mc.user_id = s.owner_user_id
     WHERE s.id = ? LIMIT 1`,
    [id],
  );
  if (
    !swap
    || swap.status !== 'active'
    || Number(swap.owner_market_suspended)
    || integer(swap.expires_at) <= Date.now()
  ) {
    throw new HttpError(409, 'market_swap_unavailable', '交换单已经不可成交');
  }
  if (Number(swap.owner_user_id) === Number(user.id)) {
    throw new HttpError(409, 'market_own_swap', '不能接受自己的交换单');
  }
  const wanted = {
    kind: swap.wanted_kind,
    name: swap.wanted_name,
    quality: swap.wanted_quality || '',
    subtype: swap.wanted_subtype || '',
  };
  if (!assetMatchesWanted(asset, wanted) || asset.quantity < integer(swap.wanted_quantity)) {
    throw new HttpError(409, 'market_swap_mismatch', '提供的资产不符合交换条件');
  }

  const now = Date.now();
  const offeredTransferId = ('swap-offer:' + id).slice(0, 96);
  const wantedTransferId = ('swap-wanted:' + id).slice(0, 96);
  await runBatch(env, [
    env.DB.prepare(
      `UPDATE market_swaps
       SET status = 'completed', accepted_by_user_id = ?, accepted_save_id = ?, updated_at = ?
       WHERE id = ?
         AND status = 'active'
         AND expires_at > ?
         AND owner_user_id <> ?
         AND NOT EXISTS (
           SELECT 1 FROM market_user_controls mc
           WHERE mc.user_id = market_swaps.owner_user_id AND mc.is_suspended = 1
         )`,
    ).bind(user.id, user.market_save_id, now, id, now, user.id),
    env.DB.prepare(
      `INSERT OR IGNORE INTO market_swap_transfers
        (id, swap_id, user_id, save_id, asset_kind, asset_name, asset_json, quantity, confirmed_at, created_at)
       SELECT ?, id, ?, accepted_save_id, offered_kind, offered_name, offered_json, offered_quantity, NULL, ?
       FROM market_swaps
       WHERE id = ? AND status = 'completed' AND accepted_by_user_id = ?`,
    ).bind(offeredTransferId, user.id, now, id, user.id),
    env.DB.prepare(
      `INSERT OR IGNORE INTO market_swap_transfers
        (id, swap_id, user_id, save_id, asset_kind, asset_name, asset_json, quantity, confirmed_at, created_at)
       SELECT ?, id, owner_user_id, owner_save_id, ?, ?, ?, ?, NULL, ?
       FROM market_swaps
       WHERE id = ? AND status = 'completed' AND accepted_by_user_id = ?`,
    ).bind(
      wantedTransferId,
      asset.kind,
      asset.name,
      asset.assetJson,
      swap.wanted_quantity,
      now,
      id,
      user.id,
    ),
  ]);
  const updated = await first(
    env,
    `SELECT s.*, u.username AS owner_username, u.display_name AS owner_display_name
     FROM market_swaps s JOIN users u ON u.id = s.owner_user_id WHERE s.id = ? LIMIT 1`,
    [id],
  );
  if (!updated || Number(updated.accepted_by_user_id) !== Number(user.id)
    || updated.accepted_save_id !== user.market_save_id) {
    throw new HttpError(409, 'market_swap_changed', '交换单刚刚被其他玩家接受或已失效');
  }
  return json({ swap: swapFromRow(updated) });
}

export async function cancelMarketSwap(env, user, swapIdValue) {
  const id = marketId(swapIdValue, '交换单ID');
  const swap = await first(env, 'SELECT * FROM market_swaps WHERE id = ? LIMIT 1', [id]);
  if (!swap || Number(swap.owner_user_id) !== Number(user.id)
    || swap.owner_save_id !== user.market_save_id) {
    throw new HttpError(404, 'market_swap_not_found', '交换单不存在');
  }
  if (swap.status !== 'active') return json({ swap: swapFromRow(swap) });

  const now = Date.now();
  const transferId = ('swap-return:' + id).slice(0, 96);
  await runBatch(env, [
    env.DB.prepare(
      `UPDATE market_swaps
       SET status = 'cancelled', updated_at = ?
       WHERE id = ? AND owner_user_id = ? AND status = 'active'`,
    ).bind(now, id, user.id),
    env.DB.prepare(
      `INSERT OR IGNORE INTO market_swap_transfers
        (id, swap_id, user_id, save_id, asset_kind, asset_name, asset_json, quantity, confirmed_at, created_at)
       SELECT ?, id, owner_user_id, owner_save_id, offered_kind, offered_name, offered_json, offered_quantity, NULL, ?
       FROM market_swaps
       WHERE id = ? AND owner_user_id = ? AND status = 'cancelled'`,
    ).bind(transferId, now, id, user.id),
  ]);
  const updated = await first(env, 'SELECT * FROM market_swaps WHERE id = ? LIMIT 1', [id]);
  return json({ swap: swapFromRow(updated) });
}

export async function confirmMarketSwapTransfer(env, user, transferIdValue) {
  const id = marketId(transferIdValue, '交换交付ID');
  const row = await first(env, 'SELECT * FROM market_swap_transfers WHERE id = ? LIMIT 1', [id]);
  if (!row || Number(row.user_id) !== Number(user.id) || row.save_id !== user.market_save_id) {
    throw new HttpError(404, 'market_swap_transfer_not_found', '交换交付记录不存在');
  }
  if (row.confirmed_at == null) {
    await env.DB.prepare(
      'UPDATE market_swap_transfers SET confirmed_at = ? WHERE id = ? AND save_id = ? AND confirmed_at IS NULL',
    ).bind(Date.now(), id, user.market_save_id).run();
  }
  const updated = await first(env, 'SELECT * FROM market_swap_transfers WHERE id = ? LIMIT 1', [id]);
  return json({ transfer: swapTransferFromRow(updated) });
}

export async function settleExpiredMarketOrders(env, { limit = 100 } = {}) {
  const now = Date.now();
  const orders = await all(
    env,
    `SELECT * FROM market_buy_orders
     WHERE status = 'active' AND expires_at <= ?
     ORDER BY expires_at ASC LIMIT ?`,
    [now, Math.max(1, Math.min(500, integer(limit, 100)))],
  );
  for (const order of orders) {
    const payoutId = ('order-expired:' + order.id).slice(0, 96);
    await runBatch(env, [
      env.DB.prepare(
        `INSERT OR IGNORE INTO market_payouts (id, user_id, save_id, amount, confirmed_at, created_at)
         SELECT ?, buyer_user_id, save_id, escrow_balance, NULL, ?
         FROM market_buy_orders
         WHERE id = ? AND status = 'active' AND expires_at <= ? AND escrow_balance > 0`,
      ).bind(payoutId, now, order.id, now),
      env.DB.prepare(
        `UPDATE market_buy_orders
         SET status = 'expired', escrow_balance = 0, updated_at = ?
         WHERE id = ? AND status = 'active' AND expires_at <= ?
           AND (
             escrow_balance = 0
             OR EXISTS (SELECT 1 FROM market_payouts WHERE id = ?)
           )`,
      ).bind(now, order.id, now, payoutId),
    ]);
  }

  const swaps = await all(
    env,
    `SELECT * FROM market_swaps
     WHERE status = 'active' AND expires_at <= ?
     ORDER BY expires_at ASC LIMIT ?`,
    [now, Math.max(1, Math.min(500, integer(limit, 100)))],
  );
  for (const swap of swaps) {
    const transferId = ('swap-expired:' + swap.id).slice(0, 96);
    await runBatch(env, [
      env.DB.prepare(
        `UPDATE market_swaps
         SET status = 'expired', updated_at = ?
         WHERE id = ? AND status = 'active' AND expires_at <= ?`,
      ).bind(now, swap.id, now),
      env.DB.prepare(
        `INSERT OR IGNORE INTO market_swap_transfers
          (id, swap_id, user_id, save_id, asset_kind, asset_name, asset_json, quantity, confirmed_at, created_at)
         SELECT ?, id, owner_user_id, owner_save_id, offered_kind, offered_name, offered_json, offered_quantity, NULL, ?
         FROM market_swaps
         WHERE id = ? AND status = 'expired'`,
      ).bind(transferId, now, swap.id),
    ]);
  }
  return { orders: orders.length, swaps: swaps.length };
}

export async function getMarketOrderState(env, user) {
  const [orders, fills, swaps, transfers] = await Promise.all([
    all(env, 'SELECT * FROM market_buy_orders WHERE buyer_user_id = ? AND save_id = ? ORDER BY created_at DESC LIMIT 100',
      [user.id, user.market_save_id]),
    all(
      env,
      `SELECT f.*,
              su.display_name AS seller_display_name, su.username AS seller_username,
              bu.display_name AS buyer_display_name, bu.username AS buyer_username
       FROM market_order_fills f
       JOIN users su ON su.id = f.seller_user_id
       JOIN users bu ON bu.id = f.buyer_user_id
       WHERE (f.buyer_user_id = ? AND f.buyer_save_id = ?)
          OR (f.seller_user_id = ? AND f.seller_save_id = ?)
       ORDER BY f.created_at DESC LIMIT 100`,
      [user.id, user.market_save_id, user.id, user.market_save_id],
    ),
    all(
      env,
      `SELECT s.*, u.display_name AS owner_display_name, u.username AS owner_username
       FROM market_swaps s
       JOIN users u ON u.id = s.owner_user_id
       WHERE (s.owner_user_id = ? AND s.owner_save_id = ?)
          OR (s.accepted_by_user_id = ? AND s.accepted_save_id = ?)
       ORDER BY s.created_at DESC LIMIT 100`,
      [user.id, user.market_save_id, user.id, user.market_save_id],
    ),
    all(
      env,
      `SELECT * FROM market_swap_transfers
       WHERE user_id = ? AND save_id = ?
       ORDER BY created_at DESC LIMIT 100`,
      [user.id, user.market_save_id],
    ),
  ]);
  return {
    buy_orders: orders.map(orderFromRow),
    order_fills: fills.map(orderFillFromRow),
    pending_order_deliveries: fills.filter(row => Number(row.buyer_user_id) === Number(user.id) && row.delivered_at == null).map(orderFillFromRow),
    swaps: swaps.map(swapFromRow),
    swap_transfers: transfers.map(swapTransferFromRow),
    pending_swap_transfers: transfers.filter(row => row.confirmed_at == null).map(swapTransferFromRow),
  };
}
