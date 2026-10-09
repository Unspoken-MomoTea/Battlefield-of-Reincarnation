import { HttpError, json, readJson } from './http.js';
import { assertMarketUserAllowed } from './market-access.js';
import { marketAssetKey } from './market-catalog.js';

const MARKET_KINDS = new Set(['equipment', 'item', 'skill', 'bloodline', 'form', 'teammate']);
const MARKET_ID_RE = /^[A-Za-z0-9:_-]{6,96}$/u;
const MAX_ASSET_BYTES = 32 * 1024;
const MAX_QUANTITY = 9999;
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

function assetFromBody(input, label = '资产') {
  const kind = String(input?.kind || '').trim();
  if (!MARKET_KINDS.has(kind)) throw new HttpError(400, 'market_invalid_kind', label + '类型无效');
  const name = String(input?.name || '').trim().slice(0, 120);
  if (!name) throw new HttpError(400, 'market_invalid_name', label + '名称不能为空');
  if (!input?.data || typeof input.data !== 'object' || Array.isArray(input.data)) {
    throw new HttpError(400, 'market_invalid_asset', label + '数据无效');
  }
  const quantity = kind === 'item'
    ? positiveInteger(input?.quantity, { max: MAX_QUANTITY, label: label + '数量' })
    : 1;
  const assetJson = JSON.stringify(input.data);
  if (new TextEncoder().encode(assetJson).byteLength > MAX_ASSET_BYTES) {
    throw new HttpError(413, 'market_asset_too_large', label + '数据过大');
  }
  return { kind, name, quantity, data: input.data, assetJson };
}

function assetFromRow(kind, name, assetJson, quantity) {
  return {
    kind: String(kind || ''),
    name: String(name || ''),
    quantity: integer(quantity, 1),
    data: parseJson(assetJson, {}),
  };
}

function barterFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    offered_market_key: row.offered_market_key,
    wanted_market_key: row.wanted_market_key,
    offered: assetFromRow(
      row.offered_market_kind,
      row.offered_asset_name,
      row.offered_asset_json,
      row.offered_quantity,
    ),
    wanted: assetFromRow(
      row.wanted_market_kind,
      row.wanted_asset_name,
      row.wanted_asset_json,
      row.wanted_quantity,
    ),
    status: row.status,
    expires_at: integer(row.expires_at),
    created_at: integer(row.created_at),
    updated_at: integer(row.updated_at),
    owner: {
      id: integer(row.owner_user_id),
      display_name: row.owner_display_name || row.owner_username || '匿名轮回者',
      username: row.owner_username || '',
    },
    acceptor: row.acceptor_user_id == null ? null : {
      id: integer(row.acceptor_user_id),
      display_name: row.acceptor_display_name || row.acceptor_username || '匿名轮回者',
      username: row.acceptor_username || '',
    },
  };
}

function deliveryFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    barter_id: row.barter_id,
    market_key: row.market_key,
    asset: assetFromRow(row.market_kind, row.asset_name, row.asset_json, row.quantity),
    quantity: integer(row.quantity, 1),
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

async function batch(env, statements) {
  if (typeof env.DB?.batch === 'function') return env.DB.batch(statements);
  const out = [];
  for (const statement of statements) out.push(await statement.run());
  return out;
}

const BARTER_SELECT = `
  SELECT
    b.*,
    owner.username AS owner_username,
    owner.display_name AS owner_display_name,
    acceptor.username AS acceptor_username,
    acceptor.display_name AS acceptor_display_name
  FROM market_barters b
  JOIN users owner ON owner.id = b.owner_user_id
  LEFT JOIN users acceptor ON acceptor.id = b.acceptor_user_id
`;

function deliveryId(barterId, side) {
  return 'bd:' + side + ':' + String(barterId || '').slice(-82);
}

async function getBarter(env, id) {
  return barterFromRow(await first(env, `${BARTER_SELECT} WHERE b.id = ? LIMIT 1`, [id]));
}

async function createReturnDelivery(env, row, status) {
  if (!row || row.status !== 'active') return;
  const now = Date.now();
  await batch(env, [
    env.DB.prepare(
      `INSERT OR IGNORE INTO market_barter_deliveries
        (id, barter_id, user_id, market_key, market_kind, asset_name, asset_json, quantity, confirmed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    ).bind(
      deliveryId(row.id, 'return'),
      row.id,
      row.owner_user_id,
      row.offered_market_key,
      row.offered_market_kind,
      row.offered_asset_name,
      row.offered_asset_json,
      row.offered_quantity,
      now,
    ),
    env.DB.prepare(
      `UPDATE market_barters
       SET status = ?, updated_at = ?
       WHERE id = ? AND status = 'active'`,
    ).bind(status, now, row.id),
  ]);
}

export async function createMarketBarter(request, env, user) {
  await assertMarketUserAllowed(env, user);
  const body = await readJson(request, { maxBytes: 96 * 1024 });
  const id = marketId(body?.id, '交换单 ID');
  const offered = assetFromBody(body?.offered_asset, '提供资产');
  const wanted = assetFromBody(body?.wanted_asset, '目标资产');
  const offeredQuantity = offered.kind === 'item'
    ? positiveInteger(body?.offered_quantity ?? offered.quantity, { max: MAX_QUANTITY, label: '提供数量' })
    : 1;
  const wantedQuantity = wanted.kind === 'item'
    ? positiveInteger(body?.wanted_quantity ?? wanted.quantity, { max: MAX_QUANTITY, label: '目标数量' })
    : 1;
  const durationHours = positiveInteger(body?.duration_hours ?? 24, { min: 24, max: 72, label: '交换时长' });
  if (!DURATIONS.has(durationHours)) {
    throw new HttpError(400, 'market_invalid_duration', '交换时长只支持 24、48 或 72 小时');
  }

  const existing = await getBarter(env, id);
  if (existing) {
    if (Number(existing.owner.id) !== Number(user.id)) {
      throw new HttpError(409, 'market_barter_id_conflict', '交换单 ID 已被占用');
    }
    return json({ barter: existing });
  }

  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO market_barters
      (id, owner_user_id, offered_market_key, offered_market_kind, offered_asset_name,
       offered_asset_json, offered_quantity, wanted_market_key, wanted_market_kind,
       wanted_asset_name, wanted_asset_json, wanted_quantity, status, acceptor_user_id,
       expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?, ?)`,
  ).bind(
    id,
    user.id,
    marketAssetKey(offered),
    offered.kind,
    offered.name,
    offered.assetJson,
    offeredQuantity,
    marketAssetKey(wanted),
    wanted.kind,
    wanted.name,
    wanted.assetJson,
    wantedQuantity,
    now + durationHours * 60 * 60 * 1000,
    now,
    now,
  ).run();

  return json({ barter: await getBarter(env, id) }, 201);
}

export async function listMarketBarters(request, env) {
  await expireMarketBarters(env);
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(100, integer(url.searchParams.get('limit'), 60)));
  const offset = Math.max(0, integer(url.searchParams.get('offset'), 0));
  const rows = await all(
    env,
    `${BARTER_SELECT}
     WHERE b.status = 'active' AND b.expires_at > ?
     ORDER BY b.created_at DESC
     LIMIT ? OFFSET ?`,
    [Date.now(), limit + 1, offset],
  );
  const more = rows.length > limit;
  return json({
    items: rows.slice(0, limit).map(barterFromRow),
    next_offset: more ? offset + limit : null,
  });
}

export async function getMarketBarter(env, user, idValue) {
  const id = marketId(idValue, '交换单 ID');
  const barter = await getBarter(env, id);
  if (!barter) throw new HttpError(404, 'market_barter_not_found', '交换单不存在');
  if (
    Number(barter.owner.id) !== Number(user.id)
    && Number(barter.acceptor?.id || 0) !== Number(user.id)
    && barter.status !== 'active'
  ) {
    throw new HttpError(404, 'market_barter_not_found', '交换单不存在');
  }
  return json({ barter });
}

export async function cancelMarketBarter(env, user, idValue) {
  await assertMarketUserAllowed(env, user);
  const id = marketId(idValue, '交换单 ID');
  const row = await first(env, 'SELECT * FROM market_barters WHERE id = ? LIMIT 1', [id]);
  if (!row || Number(row.owner_user_id) !== Number(user.id)) {
    throw new HttpError(404, 'market_barter_not_found', '交换单不存在');
  }
  if (row.status === 'active') await createReturnDelivery(env, row, 'cancelled');
  return json({
    barter: await getBarter(env, id),
    delivery: deliveryFromRow(await first(
      env,
      'SELECT * FROM market_barter_deliveries WHERE id = ? LIMIT 1',
      [deliveryId(id, 'return')],
    )),
  });
}

export async function expireMarketBarters(env, { limit = 200 } = {}) {
  const now = Date.now();
  const rows = await all(
    env,
    `SELECT * FROM market_barters
     WHERE status = 'active' AND expires_at <= ?
     ORDER BY expires_at ASC
     LIMIT ?`,
    [now, Math.max(1, Math.min(500, integer(limit, 200)))],
  );
  for (const row of rows) await createReturnDelivery(env, row, 'expired');
  return { processed: rows.length };
}

export async function acceptMarketBarter(request, env, user, idValue) {
  await assertMarketUserAllowed(env, user);
  const id = marketId(idValue, '交换单 ID');
  const body = await readJson(request, { maxBytes: 64 * 1024 });
  const asset = assetFromBody(body?.asset, '交换资产');
  const quantity = asset.kind === 'item'
    ? positiveInteger(body?.quantity ?? asset.quantity, { max: MAX_QUANTITY, label: '交换数量' })
    : 1;

  let row = await first(env, 'SELECT * FROM market_barters WHERE id = ? LIMIT 1', [id]);
  if (!row) throw new HttpError(404, 'market_barter_not_found', '交换单不存在');
  if (row.status === 'completed' && Number(row.acceptor_user_id) === Number(user.id)) {
    return json({
      barter: await getBarter(env, id),
      delivery: deliveryFromRow(await first(
        env,
        'SELECT * FROM market_barter_deliveries WHERE id = ? LIMIT 1',
        [deliveryId(id, 'acceptor')],
      )),
    });
  }
  if (row.status !== 'active' || integer(row.expires_at) <= Date.now()) {
    throw new HttpError(409, 'market_barter_unavailable', '该交换单已经失效');
  }
  if (Number(row.owner_user_id) === Number(user.id)) {
    throw new HttpError(409, 'market_own_barter', '不能接受自己的交换单');
  }
  if (marketAssetKey(asset) !== row.wanted_market_key || quantity !== integer(row.wanted_quantity)) {
    throw new HttpError(409, 'market_barter_asset_mismatch', '当前资产与交换目标不一致');
  }

  const now = Date.now();
  try {
    await batch(env, [
      env.DB.prepare(
        `UPDATE market_barters
         SET status = 'completed', acceptor_user_id = ?, updated_at = ?
         WHERE id = ? AND status = 'active' AND expires_at > ?`,
      ).bind(user.id, now, id, now),
      env.DB.prepare(
        `INSERT OR IGNORE INTO market_barter_deliveries
          (id, barter_id, user_id, market_key, market_kind, asset_name, asset_json, quantity, confirmed_at, created_at)
         SELECT ?, id, ?, offered_market_key, offered_market_kind, offered_asset_name,
                offered_asset_json, offered_quantity, NULL, ?
         FROM market_barters
         WHERE id = ? AND status = 'completed' AND acceptor_user_id = ?`,
      ).bind(deliveryId(id, 'acceptor'), user.id, now, id, user.id),
      env.DB.prepare(
        `INSERT OR IGNORE INTO market_barter_deliveries
          (id, barter_id, user_id, market_key, market_kind, asset_name, asset_json, quantity, confirmed_at, created_at)
         SELECT ?, id, owner_user_id, wanted_market_key, wanted_market_kind, wanted_asset_name,
                ?, wanted_quantity, NULL, ?
         FROM market_barters
         WHERE id = ? AND status = 'completed' AND acceptor_user_id = ?`,
      ).bind(deliveryId(id, 'owner'), asset.assetJson, now, id, user.id),
    ]);
  } catch (error) {
    row = await first(env, 'SELECT * FROM market_barters WHERE id = ? LIMIT 1', [id]);
    if (row?.status !== 'completed' || Number(row.acceptor_user_id) !== Number(user.id)) throw error;
  }

  return json({
    barter: await getBarter(env, id),
    delivery: deliveryFromRow(await first(
      env,
      'SELECT * FROM market_barter_deliveries WHERE id = ? LIMIT 1',
      [deliveryId(id, 'acceptor')],
    )),
  });
}

export async function confirmMarketBarterDelivery(env, user, deliveryIdValue) {
  const id = marketId(deliveryIdValue, '交换领取 ID');
  const now = Date.now();
  await env.DB.prepare(
    `UPDATE market_barter_deliveries
     SET confirmed_at = COALESCE(confirmed_at, ?)
     WHERE id = ? AND user_id = ?`,
  ).bind(now, id, user.id).run();
  const row = await first(env, 'SELECT * FROM market_barter_deliveries WHERE id = ? LIMIT 1', [id]);
  if (!row || Number(row.user_id) !== Number(user.id)) {
    throw new HttpError(404, 'market_barter_delivery_not_found', '交换领取记录不存在');
  }
  return json({ delivery: deliveryFromRow(row) });
}

export async function marketBarterStateForUser(env, user) {
  await expireMarketBarters(env);
  const [owned, accepted, pending] = await Promise.all([
    all(env, `${BARTER_SELECT} WHERE b.owner_user_id = ? ORDER BY b.created_at DESC LIMIT 80`, [user.id]),
    all(env, `${BARTER_SELECT} WHERE b.acceptor_user_id = ? ORDER BY b.created_at DESC LIMIT 80`, [user.id]),
    all(
      env,
      `SELECT * FROM market_barter_deliveries
       WHERE user_id = ? AND confirmed_at IS NULL
       ORDER BY created_at ASC LIMIT 80`,
      [user.id],
    ),
  ]);
  return {
    owned: owned.map(barterFromRow),
    accepted: accepted.map(barterFromRow),
    pending_deliveries: pending.map(deliveryFromRow),
  };
}
