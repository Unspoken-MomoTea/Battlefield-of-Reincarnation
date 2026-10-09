import { HttpError, json, readJson } from './http.js';
import { marketQualityHigh, marketQuality } from './market-economy.js';
import { refreshMarketCatalogKey } from './market-catalog.js';
import { assertModerator, moderationText, writeModerationAudit } from './moderation/common.js';

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

async function runBatch(env, statements) {
  if (typeof env.DB.batch === 'function') return env.DB.batch(statements);
  const results = [];
  for (const statement of statements) results.push(await statement.run());
  return results;
}

function logicalKind(row) {
  return String(row?.market_kind || row?.asset_kind || '');
}

function asset(row, quantityField = 'remaining_quantity') {
  return {
    kind: logicalKind(row),
    name: String(row?.asset_name || ''),
    quantity: Math.max(1, integer(row?.[quantityField], 1)),
    data: parseJson(row?.asset_json, {}),
  };
}

function priceRisk(row) {
  const data = parseJson(row.asset_json, {});
  const quality = marketQuality(data.品质 || data.层级 || row.quality || 'F');
  const high = marketQualityHigh(quality);
  const unit = integer(row.unit_price);
  const total = integer(row.total_price, unit);
  const reasons = [];
  if (unit > high * 10) reasons.push('单价超过品质最高价10倍');
  if (total > high * 50) reasons.push('单笔成交额超过品质最高价50倍');
  return { quality, high, suspicious: reasons.length > 0, reasons };
}

export async function listAdminMarket(request, env, user) {
  assertModerator(user);
  const url = new URL(request.url);
  const view = String(url.searchParams.get('view') || 'listings');
  const query = String(url.searchParams.get('q') || '').trim().slice(0, 80);
  const status = String(url.searchParams.get('status') || '').trim();
  const riskOnly = url.searchParams.get('risk') === '1';
  const limit = Math.max(1, Math.min(100, integer(url.searchParams.get('limit'), 50)));
  const offset = Math.max(0, integer(url.searchParams.get('offset'), 0));

  if (view === 'trades') {
    const clauses = [];
    const args = [];
    if (query) {
      clauses.push('(t.asset_name LIKE ? OR su.display_name LIKE ? OR bu.display_name LIKE ?)');
      args.push('%' + query + '%', '%' + query + '%', '%' + query + '%');
    }
    const rows = await all(
      env,
      `SELECT t.*,
              su.display_name AS seller_display_name, su.username AS seller_username,
              bu.display_name AS buyer_display_name, bu.username AS buyer_username
       FROM market_trades t
       JOIN users su ON su.id = t.seller_user_id
       JOIN users bu ON bu.id = t.buyer_user_id
       ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''}
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...args, limit * (riskOnly ? 4 : 1), offset],
    );
    let items = rows.map(row => {
      const risk = priceRisk(row);
      return {
        id: row.id,
        listing_id: row.listing_id,
        asset: asset(row, 'quantity'),
        quantity: integer(row.quantity),
        unit_price: integer(row.unit_price),
        total_price: integer(row.total_price),
        created_at: integer(row.created_at),
        seller: { id: integer(row.seller_user_id), display_name: row.seller_display_name || row.seller_username },
        buyer: { id: integer(row.buyer_user_id), display_name: row.buyer_display_name || row.buyer_username },
        risk,
      };
    });
    if (riskOnly) items = items.filter(item => item.risk.suspicious).slice(0, limit);
    return json({ view, items, next_offset: rows.length >= limit ? offset + limit : null });
  }

  if (view === 'orders') {
    const clauses = [];
    const args = [];
    if (status) { clauses.push('o.status = ?'); args.push(status); }
    if (query) {
      clauses.push('(o.asset_name LIKE ? OR u.display_name LIKE ?)');
      args.push('%' + query + '%', '%' + query + '%');
    }
    const rows = await all(
      env,
      `SELECT o.*, u.display_name AS buyer_display_name, u.username AS buyer_username
       FROM market_buy_orders o JOIN users u ON u.id = o.buyer_user_id
       ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''}
       ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      [...args, limit, offset],
    );
    return json({
      view,
      items: rows.map(row => ({
        id: row.id,
        asset_kind: row.asset_kind,
        asset_name: row.asset_name,
        quality: row.quality,
        unit_price: integer(row.unit_price),
        remaining_quantity: integer(row.remaining_quantity),
        status: row.status,
        expires_at: integer(row.expires_at),
        buyer: { id: integer(row.buyer_user_id), display_name: row.buyer_display_name || row.buyer_username },
      })),
      next_offset: rows.length >= limit ? offset + limit : null,
    });
  }

  if (view === 'swaps') {
    const clauses = [];
    const args = [];
    if (status) { clauses.push('s.status = ?'); args.push(status); }
    if (query) {
      clauses.push('(s.offered_name LIKE ? OR s.wanted_name LIKE ? OR u.display_name LIKE ?)');
      args.push('%' + query + '%', '%' + query + '%', '%' + query + '%');
    }
    const rows = await all(
      env,
      `SELECT s.*, u.display_name AS owner_display_name, u.username AS owner_username
       FROM market_swaps s JOIN users u ON u.id = s.owner_user_id
       ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''}
       ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
      [...args, limit, offset],
    );
    return json({
      view,
      items: rows.map(row => ({
        id: row.id,
        offered: { kind: row.offered_kind, name: row.offered_name, quantity: integer(row.offered_quantity) },
        wanted: { kind: row.wanted_kind, name: row.wanted_name, quality: row.wanted_quality, quantity: integer(row.wanted_quantity) },
        status: row.status,
        expires_at: integer(row.expires_at),
        owner: { id: integer(row.owner_user_id), display_name: row.owner_display_name || row.owner_username },
      })),
      next_offset: rows.length >= limit ? offset + limit : null,
    });
  }

  const clauses = [];
  const args = [];
  if (status) { clauses.push('l.status = ?'); args.push(status); }
  if (query) {
    clauses.push('(l.asset_name LIKE ? OR u.display_name LIKE ?)');
    args.push('%' + query + '%', '%' + query + '%');
  }
  const rows = await all(
    env,
    `SELECT l.*, u.display_name AS seller_display_name, u.username AS seller_username,
            c.is_suspended AS market_suspended
     FROM market_listings l
     JOIN users u ON u.id = l.seller_user_id
     LEFT JOIN market_user_controls c ON c.user_id = l.seller_user_id
     ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''}
     ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
    [...args, limit, offset],
  );
  return json({
    view: 'listings',
    items: rows.map(row => ({
      id: row.id,
      asset: asset(row),
      unit_price: integer(row.unit_price),
      remaining_quantity: integer(row.remaining_quantity),
      status: row.status,
      expires_at: integer(row.expires_at),
      created_at: integer(row.created_at),
      seller: {
        id: integer(row.seller_user_id),
        display_name: row.seller_display_name || row.seller_username,
        market_suspended: Number(row.market_suspended || 0),
      },
      risk: priceRisk(row),
    })),
    next_offset: rows.length >= limit ? offset + limit : null,
  });
}

export async function adminCancelMarketListing(env, user, listingId) {
  assertModerator(user);
  const row = await first(env, 'SELECT * FROM market_listings WHERE id = ? LIMIT 1', [listingId]);
  if (!row) throw new HttpError(404, 'market_listing_not_found', '挂单不存在');
  if (row.status !== 'active' || integer(row.remaining_quantity) <= 0) return json({ ok: true });

  const now = Date.now();
  const returnId = ('admin-return:' + row.id).slice(0, 96);
  await runBatch(env, [
    env.DB.prepare(
      `UPDATE market_listings
       SET status = 'cancelled', remaining_quantity = 0, updated_at = ?
       WHERE id = ? AND status = 'active'`,
    ).bind(now, row.id),
    env.DB.prepare(
      `INSERT OR IGNORE INTO market_returns
        (id, listing_id, user_id, asset_kind, market_kind, asset_name, asset_json, quantity, confirmed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    ).bind(
      returnId, row.id, row.seller_user_id, row.asset_kind, logicalKind(row),
      row.asset_name, row.asset_json, row.remaining_quantity, now,
    ),
  ]);
  if (row.catalog_key) await refreshMarketCatalogKey(env, row.catalog_key);
  await writeModerationAudit(env, user, {
    action: 'market_listing_cancel',
    targetUserId: row.seller_user_id,
    note: '强制下架 ' + row.asset_name + ' (' + row.id + ')',
  });
  return json({ ok: true, return_id: returnId });
}

export async function adminSetMarketUserState(request, env, user, targetUserIdValue) {
  assertModerator(user);
  const targetUserId = integer(targetUserIdValue, 0);
  if (!targetUserId) throw new HttpError(400, 'invalid_user', '用户ID无效');
  const body = await readJson(request, { maxBytes: 8 * 1024 });
  const suspended = Boolean(body?.suspended);
  const note = moderationText(String(body?.note || ''), 'note', 500, { required: suspended });
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO market_user_controls (user_id, is_suspended, note, updated_by_user_id, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       is_suspended = excluded.is_suspended,
       note = excluded.note,
       updated_by_user_id = excluded.updated_by_user_id,
       updated_at = excluded.updated_at`,
  ).bind(targetUserId, suspended ? 1 : 0, note, user.id, now).run();
  await writeModerationAudit(env, user, {
    action: suspended ? 'market_user_suspend' : 'market_user_restore',
    targetUserId,
    note,
  });
  return json({ user_id: targetUserId, suspended, note, updated_at: now });
}
