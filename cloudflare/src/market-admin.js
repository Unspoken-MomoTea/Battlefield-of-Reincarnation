import { HttpError, json, readJson } from './http.js';
import { refreshMarketProduct } from './market-catalog.js';
import { marketQualityHigh, marketQualityFromAsset } from './market-economy.js';
import { assertModerator } from './moderation/common.js';

function integer(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function parseJson(value, fallback = {}) {
  try { return JSON.parse(String(value || '')); } catch { return fallback; }
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

function logicalKind(row) {
  return String(row.market_kind || row.asset_kind || '');
}

function assetFromRow(row, quantity = 1) {
  return {
    kind: logicalKind(row),
    name: row.asset_name,
    quantity: integer(quantity, 1),
    data: parseJson(row.asset_json, {}),
  };
}

function listingAdminRow(row) {
  return {
    id: row.id,
    market_key: row.market_key || '',
    asset: assetFromRow(row, row.remaining_quantity),
    unit_price: integer(row.unit_price),
    remaining_quantity: integer(row.remaining_quantity),
    status: row.status,
    expires_at: integer(row.expires_at),
    created_at: integer(row.created_at),
    seller: {
      id: integer(row.seller_user_id),
      display_name: row.seller_display_name || row.seller_username || '匿名轮回者',
    },
  };
}

function tradeAdminRow(row) {
  const asset = assetFromRow(row, row.quantity);
  const quality = marketQualityFromAsset(asset);
  const high = marketQualityHigh(quality);
  const unitPrice = integer(row.unit_price);
  const ratio = high > 0 ? unitPrice / high : 0;
  return {
    id: row.id,
    market_key: row.market_key || '',
    asset,
    quantity: integer(row.quantity),
    unit_price: unitPrice,
    total_price: integer(row.total_price),
    market_fee: integer(row.market_fee),
    created_at: integer(row.created_at),
    seller: {
      id: integer(row.seller_user_id),
      display_name: row.seller_display_name || '匿名轮回者',
    },
    buyer: {
      id: integer(row.buyer_user_id),
      display_name: row.buyer_display_name || '匿名轮回者',
    },
    risk: {
      suspicious: ratio >= 5,
      price_ratio: Math.round(ratio * 100) / 100,
      reason: ratio >= 10
        ? '成交单价超过品质系统最高锚点 10 倍'
        : ratio >= 5
          ? '成交单价超过品质系统最高锚点 5 倍'
          : '',
    },
  };
}

async function audit(env, actorId, action, targetType, targetId, note = '') {
  await env.DB.prepare(
    `INSERT INTO market_admin_actions
      (actor_user_id, action, target_type, target_id, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(actorId, action, targetType, String(targetId), String(note || '').slice(0, 1000), Date.now()).run();
}

export async function listAdminMarket(request, env, user) {
  assertModerator(user);
  const url = new URL(request.url);
  const query = String(url.searchParams.get('q') || '').trim().slice(0, 80);
  const args = [];
  let where = "WHERE l.status = 'active' AND l.remaining_quantity > 0";
  if (query) {
    where += ' AND (l.asset_name LIKE ? OR seller.display_name LIKE ? OR seller.username LIKE ?)';
    args.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }

  const [listings, trades, blocks, actions] = await Promise.all([
    all(
      env,
      `SELECT l.*, seller.username AS seller_username, seller.display_name AS seller_display_name
       FROM market_listings l
       JOIN users seller ON seller.id = l.seller_user_id
       ${where}
       ORDER BY l.updated_at DESC
       LIMIT 100`,
      args,
    ),
    all(
      env,
      `SELECT t.*,
              seller.display_name AS seller_display_name,
              buyer.display_name AS buyer_display_name
       FROM market_trades t
       JOIN users seller ON seller.id = t.seller_user_id
       JOIN users buyer ON buyer.id = t.buyer_user_id
       ORDER BY t.created_at DESC
       LIMIT 120`,
    ),
    all(
      env,
      `SELECT b.user_id, b.reason, b.created_at, u.display_name, u.username
       FROM market_user_blocks b
       JOIN users u ON u.id = b.user_id
       ORDER BY b.created_at DESC
       LIMIT 100`,
    ),
    all(
      env,
      `SELECT a.*, u.display_name AS actor_display_name
       FROM market_admin_actions a
       JOIN users u ON u.id = a.actor_user_id
       ORDER BY a.created_at DESC
       LIMIT 80`,
    ),
  ]);

  const tradeItems = trades.map(tradeAdminRow);
  return json({
    listings: listings.map(listingAdminRow),
    trades: tradeItems,
    suspicious_trades: tradeItems.filter(item => item.risk.suspicious),
    blocks: blocks.map(row => ({
      user_id: integer(row.user_id),
      display_name: row.display_name || row.username || '匿名轮回者',
      reason: row.reason || '',
      created_at: integer(row.created_at),
    })),
    actions: actions.map(row => ({
      id: integer(row.id),
      action: row.action,
      target_type: row.target_type,
      target_id: row.target_id,
      note: row.note || '',
      created_at: integer(row.created_at),
      actor: row.actor_display_name || '管理员',
    })),
  });
}

export async function forceCancelMarketListing(request, env, user, listingId) {
  assertModerator(user);
  const body = await readJson(request, { maxBytes: 8 * 1024 }).catch(() => ({}));
  const note = String(body?.note || '').trim().slice(0, 1000);
  const row = await first(env, 'SELECT * FROM market_listings WHERE id = ? LIMIT 1', [listingId]);
  if (!row) throw new HttpError(404, 'market_listing_not_found', '挂单不存在');

  if (row.status === 'active' && integer(row.remaining_quantity) > 0) {
    const returnId = ('admret:' + row.id).slice(0, 96);
    const now = Date.now();
    await batch(env, [
      env.DB.prepare(
        `UPDATE market_listings
         SET status = 'cancelled', updated_at = ?
         WHERE id = ? AND status = 'active'`,
      ).bind(now, row.id),
      env.DB.prepare(
        `INSERT OR IGNORE INTO market_returns
          (id, listing_id, user_id, asset_kind, market_kind, market_key, asset_name, asset_json,
           quantity, confirmed_at, created_at)
         SELECT ?, id, seller_user_id, asset_kind, COALESCE(NULLIF(market_kind, ''), asset_kind),
                market_key, asset_name, asset_json, remaining_quantity, NULL, ?
         FROM market_listings
         WHERE id = ? AND status = 'cancelled' AND remaining_quantity > 0`,
      ).bind(returnId, now, row.id),
      env.DB.prepare(
        `UPDATE market_listings SET remaining_quantity = 0, updated_at = ?
         WHERE id = ? AND EXISTS (SELECT 1 FROM market_returns WHERE listing_id = ?)`,
      ).bind(now, row.id, row.id),
    ]);
    if (row.market_key) await refreshMarketProduct(env, row.market_key);
  }

  await audit(env, user.id, 'force_cancel_listing', 'listing', row.id, note);
  return json({ ok: true });
}

export async function setMarketUserBlock(request, env, user, userIdValue) {
  assertModerator(user);
  const userId = integer(userIdValue, 0);
  if (!userId) throw new HttpError(400, 'market_invalid_user', '用户 ID 无效');
  const target = await first(env, 'SELECT id, is_admin FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!target) throw new HttpError(404, 'user_not_found', '用户不存在');
  if (Number(target.is_admin)) throw new HttpError(409, 'market_admin_protected', '不能冻结主管理员的市场权限');

  const body = await readJson(request, { maxBytes: 8 * 1024 });
  const blocked = Boolean(body?.blocked);
  const reason = String(body?.reason || '').trim().slice(0, 500);
  if (blocked) {
    await env.DB.prepare(
      `INSERT INTO market_user_blocks (user_id, reason, created_by, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         reason = excluded.reason,
         created_by = excluded.created_by,
         created_at = excluded.created_at`,
    ).bind(userId, reason, user.id, Date.now()).run();
    await audit(env, user.id, 'block_user', 'user', String(userId), reason);
  } else {
    await env.DB.prepare('DELETE FROM market_user_blocks WHERE user_id = ?').bind(userId).run();
    await audit(env, user.id, 'unblock_user', 'user', String(userId), reason);
  }
  return json({ ok: true, blocked });
}
