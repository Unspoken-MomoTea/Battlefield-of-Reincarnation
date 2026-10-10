import { HttpError, json, readJson } from './http.js';
import { assertMarketActive } from './market-access.js';

// One deep transaction module: only the owner can select a bid, while every
// escrow/refund outcome is a save-scoped, retryable claim (never an off-save write).
const idRe = /^[a-zA-Z0-9:_-]{6,96}$/u;
const kinds = new Set(['item', 'equipment', 'skill', 'bloodline', 'form', 'teammate']);
const hours = new Set([24, 48, 72]);
const maxCoins = 1_000_000_000;
const now = () => Date.now();
const sql = (...lines) => lines.join(' ');
const db = (env, statement, ...params) => env.DB.prepare(statement).bind(...params);
const first = (env, statement, ...params) => db(env, statement, ...params).first();
const all = async (env, statement, ...params) => (await db(env, statement, ...params).all()).results || [];
const parse = value => { try { return JSON.parse(value); } catch { return []; } };
const number = (value, max = maxCoins) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > max)
    throw new HttpError(400, 'deal_invalid_quantity', '数量或空间币金额无效');
  return value;
};
function id(value) {
  const s = String(value || '');
  if (!idRe.test(s)) throw new HttpError(400, 'deal_invalid_id', '订单或报价 ID 格式错误');
  return s;
}
function description(value, max = 300) {
  const s = String(value || '').trim().slice(0, max);
  if (!s) throw new HttpError(400, 'deal_description_required', '请填写需求描述');
  return s;
}
function escrow(input) {
  const coins = number(input?.coins ?? 0);
  const source = input?.assets || [];
  if (!Array.isArray(source) || source.length > 6)
    throw new HttpError(400, 'deal_assets_limit', '最多提供六种资产');
  const assets = source.map(item => {
    const kind = String(item?.kind || '');
    const name = String(item?.name || '').trim().slice(0, 120);
    const quantity = number(item?.quantity, 9999);
    const data = item?.data;
    if (!kinds.has(kind) || !name || quantity < 1 || (kind !== 'item' && quantity !== 1)
      || !data || typeof data !== 'object' || Array.isArray(data))
      throw new HttpError(400, 'deal_asset_invalid', '托管资产类型、数量或资料无效');
    if (new TextEncoder().encode(JSON.stringify(data)).byteLength > 32 * 1024)
      throw new HttpError(413, 'deal_asset_large', '单件资产数据超过限制');
    return { kind, name, quantity, data };
  });
  if (!coins && !assets.length) throw new HttpError(400, 'deal_empty_escrow', '至少提供一种资产或空间币');
  return { coins, assets };
}
function decodeDeal(row) {
  if (!row) return null;
  return {
    id: row.id, title: row.title, wanted: row.wanted,
    offer: { coins: row.offer_coins, assets: parse(row.offer_assets_json) },
    owner: { id: row.owner_user_id, display_name: row.owner_name || '匿名轮回者' },
    status: row.status, accepted_bid_id: row.accepted_bid_id,
    bid_count: Number(row.bid_count || 0), expires_at: row.expires_at,
    created_at: row.created_at,
  };
}
function decodeBid(row) {
  return {
    id: row.id, deal_id: row.deal_id,
    bidder: { id: row.bidder_user_id, display_name: row.bidder_name || '匿名轮回者' },
    offer: { coins: row.offer_coins, assets: parse(row.offer_assets_json) },
    note: row.note, status: row.status, created_at: row.created_at,
  };
}
function decodeTransfer(row) {
  return {
    id: row.id, deal_id: row.deal_id, save_id: row.save_id,
    offer: { coins: row.coins, assets: parse(row.assets_json) },
    confirmed_at: row.confirmed_at, created_at: row.created_at,
  };
}
const dealSelect = sql(
  'SELECT d.*, u.display_name AS owner_name,',
  '(SELECT COUNT(*) FROM market_deal_bids b WHERE b.deal_id=d.id AND b.status=\'pending\') AS bid_count',
  'FROM market_deals d JOIN users u ON u.id=d.owner_user_id'
);
const bidSelect = sql(
  'SELECT b.*, u.display_name AS bidder_name FROM market_deal_bids b',
  'JOIN users u ON u.id=b.bidder_user_id'
);
const receipt = (env, receiptId, dealId, userId, saveId, assets, coins, timestamp) =>
  db(env, sql('INSERT OR IGNORE INTO market_deal_transfers',
    '(id,deal_id,user_id,save_id,assets_json,coins,confirmed_at,created_at)',
    'VALUES (?,?,?,?,?,?,NULL,?)'), receiptId,dealId,userId,saveId,assets,coins,timestamp);
function pendingRefunds(env, dealId, timestamp) {
  return db(env, sql(
    'INSERT OR IGNORE INTO market_deal_transfers',
    '(id,deal_id,user_id,save_id,assets_json,coins,confirmed_at,created_at)',
    'SELECT \'refund:bid:\'||b.id,b.deal_id,b.bidder_user_id,b.bidder_save_id,',
    'b.offer_assets_json,b.offer_coins,NULL,?',
    'FROM market_deal_bids b WHERE b.deal_id=?',
    'AND b.status IN (\'rejected\',\'withdrawn\')'
  ), timestamp,dealId);
}
function ownerRefund(env, dealId, timestamp) {
  return db(env, sql(
    'INSERT OR IGNORE INTO market_deal_transfers',
    '(id,deal_id,user_id,save_id,assets_json,coins,confirmed_at,created_at)',
    'SELECT \'refund:owner:\'||id,id,owner_user_id,owner_save_id,offer_assets_json,',
    'offer_coins,NULL,? FROM market_deals',
    'WHERE id=? AND status IN (\'cancelled\',\'expired\')'
  ), timestamp, dealId);
}
async function batch(env, statements) {
  // D1.batch runs the set as a single transaction; never send one-by-one when
  // money or items are involved.
  if (!env.DB.batch) throw new Error('D1 atomic batch is required for market deals');
  return env.DB.batch(statements);
}
async function mustOwn(env, user, dealId) {
  const row = await first(env, 'SELECT * FROM market_deals WHERE id=?', id(dealId));
  if (!row || row.owner_user_id !== user.id || row.owner_save_id !== user.market_save_id)
    throw new HttpError(404, 'deal_not_found', '当前存档没有这个订单');
  return row;
}
async function mustBid(env, user, bidId) {
  const row = await first(env, 'SELECT * FROM market_deal_bids WHERE id=?', id(bidId));
  if (!row || row.bidder_user_id !== user.id || row.bidder_save_id !== user.market_save_id)
    throw new HttpError(404, 'deal_bid_not_found', '当前存档没有这份报价');
  return row;
}
export async function listMarketDeals(request, env) {
  const params = new URL(request.url).searchParams;
  const q = String(params.get('q') || '').trim().slice(0, 80);
  const limit = Math.max(1, Math.min(50, Number.parseInt(params.get('limit') || '50', 10) || 50));
  const offset = Math.max(0, Math.min(100000, Number.parseInt(params.get('offset') || '0', 10) || 0));
  const rows = await all(env, dealSelect + sql(
    ' LEFT JOIN market_user_controls control ON control.user_id=d.owner_user_id',
    "WHERE d.status='active' AND d.expires_at>? AND COALESCE(control.is_suspended,0)=0",
    "AND (?='' OR d.title LIKE ? OR d.wanted LIKE ?)",
    'ORDER BY d.created_at DESC, d.id DESC LIMIT ? OFFSET ?'
  ), now(), q, '%' + q + '%', '%' + q + '%', limit + 1, offset);
  return json({ items: rows.slice(0, limit).map(decodeDeal),
    next_offset: rows.length > limit ? offset + limit : null });
}
export async function getMarketDeal(env, user, dealId) {
  const deal = await first(env, dealSelect + ' WHERE d.id=?', id(dealId));
  if (!deal) throw new HttpError(404, 'deal_not_found', '订单不存在');
  const owner = deal.owner_user_id === user.id && deal.owner_save_id === user.market_save_id;
  // Pending bids should not be hidden behind older rejected offers.
  const bids = owner
    ? await all(env, bidSelect +
        " WHERE b.deal_id=? ORDER BY CASE WHEN b.status='pending' THEN 0 ELSE 1 END, b.created_at DESC LIMIT 100", deal.id)
    : await all(env, bidSelect +
        ' WHERE b.deal_id=? AND b.bidder_user_id=? AND b.bidder_save_id=? ORDER BY b.created_at DESC LIMIT 100',
        deal.id,user.id,user.market_save_id);
  return json({ deal: decodeDeal(deal), bids: bids.map(decodeBid), owner });
}
export async function createMarketDeal(request, env, user) {
  await assertMarketActive(env,user);
  const body = await readJson(request,{maxBytes:240*1024});
  const dealId = id(body?.id);
  const exists = await first(env,'SELECT * FROM market_deals WHERE id=?',dealId);
  if (exists) {
    if (exists.owner_user_id !== user.id || exists.owner_save_id !== user.market_save_id)
      throw new HttpError(409,'deal_id_conflict','订单 ID 已占用');
    return getMarketDeal(env,user,dealId);
  }
  const offer = escrow(body?.offer);
  const title = description(body?.title,100);
  const wanted = description(body?.wanted);
  const duration = number(body?.duration_hours || 24,72);
  if (!hours.has(duration)) throw new HttpError(400,'deal_duration','只允许24、48或72小时');
  const timestamp=now();
  const inserted = await db(env,sql('INSERT INTO market_deals',
    '(id,owner_user_id,owner_save_id,title,wanted,offer_assets_json,offer_coins,status,expires_at,created_at,updated_at)',
    "SELECT ?,?,?,?,?,?,?,'active',?,?,?",
    "WHERE (SELECT COUNT(*) FROM market_deals WHERE owner_user_id=? AND owner_save_id=? AND status='active' AND expires_at>?)<10"),
    dealId,user.id,user.market_save_id,title,wanted,JSON.stringify(offer.assets),offer.coins,
    timestamp+duration*3600000,timestamp,timestamp,user.id,user.market_save_id,timestamp).run();
  if (!inserted.meta?.changes)
    throw new HttpError(409,'deal_active_limit','每份存档最多可发布10条进行中的自由订单');
  return json({ deal:decodeDeal(await first(env,dealSelect+' WHERE d.id=?',dealId)) },201);
}
export async function submitMarketBid(request,env,user,dealIdValue) {
  await assertMarketActive(env,user);
  const dealId=id(dealIdValue);
  const body=await readJson(request,{maxBytes:240*1024});
  const bidId=id(body?.id);
  const exists=await first(env,'SELECT * FROM market_deal_bids WHERE id=?',bidId);
  if (exists) {
    if (exists.bidder_user_id !== user.id || exists.bidder_save_id !== user.market_save_id
        || exists.deal_id !== dealId)
      throw new HttpError(409,'deal_id_conflict','报价 ID 已占用');
    return json({ bid:decodeBid(await first(env,bidSelect+' WHERE b.id=?',bidId)) });
  }
  const offer=escrow(body?.offer);
  const note=String(body?.note || '').trim().slice(0,300);
  const timestamp=now();
  const insert=await db(env,sql(
    'INSERT INTO market_deal_bids',
    '(id,deal_id,bidder_user_id,bidder_save_id,offer_assets_json,offer_coins,note,status,created_at,updated_at)',
    'SELECT ?,d.id,?,?,?, ?,?,\'pending\',?,? FROM market_deals d',
    'WHERE d.id=? AND d.status=\'active\' AND d.expires_at>? AND d.owner_user_id<>?',
    'AND NOT EXISTS (SELECT 1 FROM market_user_controls c WHERE c.user_id=d.owner_user_id AND c.is_suspended=1)',
    'AND (SELECT COUNT(*) FROM market_deal_bids WHERE deal_id=d.id AND status=\'pending\')<20',
    'AND NOT EXISTS (SELECT 1 FROM market_deal_bids WHERE deal_id=d.id AND bidder_user_id=? AND status=\'pending\')'
  ),bidId,user.id,user.market_save_id,JSON.stringify(offer.assets),offer.coins,note,
  timestamp,timestamp,dealId,timestamp,user.id,user.id).run();
  if (!insert.meta?.changes)
    throw new HttpError(409,'deal_bid_unavailable','订单已结束、报价已满或你已有待处理报价');
  return json({bid:decodeBid(await first(env,bidSelect+' WHERE b.id=?',bidId))},201);
}
export async function decideMarketBid(env,user,dealIdValue,bidIdValue,accept) {
  // Declining an offer releases escrow, including when trading is suspended.
  if (accept) await assertMarketActive(env,user);
  const dealId=id(dealIdValue), bidId=id(bidIdValue);
  const owner=await mustOwn(env,user,dealId);
  const target=await first(env,'SELECT * FROM market_deal_bids WHERE id=? AND deal_id=?',bidId,dealId);
  if (!target) throw new HttpError(404,'deal_bid_not_found','报价不存在');
  if (owner.status==='completed' && owner.accepted_bid_id===bidId && accept)
    return getMarketDeal(env,user,dealId);
  if (owner.status!=='active' || owner.expires_at<=now() || target.status!=='pending')
    throw new HttpError(409,'deal_changed','订单或报价已经失效');
  const timestamp=now();
  if (!accept) {
    const results=await batch(env,[
      db(env,sql('UPDATE market_deal_bids SET status=\'rejected\',updated_at=?',
        'WHERE id=? AND deal_id=? AND status=\'pending\'',
        'AND EXISTS(SELECT 1 FROM market_deals WHERE id=? AND status=\'active\' AND expires_at>?)'),
        timestamp,bidId,dealId,dealId,timestamp),
      pendingRefunds(env,dealId,timestamp),
    ]);
    if (!results[0].meta?.changes) throw new HttpError(409,'deal_changed','报价已变化');
    return getMarketDeal(env,user,dealId);
  }
  const results=await batch(env,[
    db(env,sql('UPDATE market_deals SET status=\'completed\',accepted_bid_id=?,updated_at=?',
      'WHERE id=? AND status=\'active\' AND expires_at>?',
      'AND EXISTS(SELECT 1 FROM market_deal_bids WHERE id=? AND deal_id=? AND status=\'pending\')'),
      bidId,timestamp,dealId,timestamp,bidId,dealId),
    db(env,sql('UPDATE market_deal_bids SET status=CASE WHEN id=? THEN \'accepted\' ELSE \'rejected\' END,updated_at=?',
      'WHERE deal_id=? AND status=\'pending\'',
      'AND EXISTS(SELECT 1 FROM market_deals WHERE id=? AND status=\'completed\' AND accepted_bid_id=?)'),
      bidId,timestamp,dealId,dealId,bidId),
    db(env,sql('INSERT OR IGNORE INTO market_deal_transfers',
      '(id,deal_id,user_id,save_id,assets_json,coins,confirmed_at,created_at)',
      'SELECT \'win:owner:\'||d.id,d.id,d.owner_user_id,d.owner_save_id,b.offer_assets_json,b.offer_coins,NULL,?',
      'FROM market_deals d JOIN market_deal_bids b ON b.id=d.accepted_bid_id',
      'WHERE d.id=? AND d.status=\'completed\' AND d.accepted_bid_id=?'),timestamp,dealId,bidId),
    db(env,sql('INSERT OR IGNORE INTO market_deal_transfers',
      '(id,deal_id,user_id,save_id,assets_json,coins,confirmed_at,created_at)',
      'SELECT \'win:bid:\'||b.id,d.id,b.bidder_user_id,b.bidder_save_id,d.offer_assets_json,d.offer_coins,NULL,?',
      'FROM market_deals d JOIN market_deal_bids b ON b.id=d.accepted_bid_id',
      'WHERE d.id=? AND d.status=\'completed\' AND d.accepted_bid_id=?'),timestamp,dealId,bidId),
    pendingRefunds(env,dealId,timestamp),
  ]);
  if (!results[0].meta?.changes) throw new HttpError(409,'deal_changed','其他报价已被选中');
  return getMarketDeal(env,user,dealId);
}
export async function withdrawMarketBid(env,user,bidIdValue) {
  // Withdrawal only returns escrow and stays available while suspended.
  const bid=await mustBid(env,user,bidIdValue);
  if (bid.status!=='pending') return json({bid:decodeBid(await first(env,bidSelect+' WHERE b.id=?',bid.id))});
  const timestamp=now();
  const results=await batch(env,[
    db(env,sql('UPDATE market_deal_bids SET status=\'withdrawn\',updated_at=?',
      'WHERE id=? AND status=\'pending\'',
      'AND EXISTS(SELECT 1 FROM market_deals WHERE id=market_deal_bids.deal_id AND status=\'active\')'),
      timestamp,bid.id),
    pendingRefunds(env,bid.deal_id,timestamp),
  ]);
  if (!results[0].meta?.changes) throw new HttpError(409,'deal_changed','报价已被接受或结束');
  return json({bid:decodeBid(await first(env,bidSelect+' WHERE b.id=?',bid.id))});
}
export async function closeMarketDeal(env,user,dealIdValue) {
  // Owner cancellation only returns escrow and stays available while suspended.
  const deal=await mustOwn(env,user,dealIdValue);
  if (deal.status!=='active') return getMarketDeal(env,user,deal.id);
  await cancelAndRefundDeal(env,deal.id);
  return getMarketDeal(env,user,deal.id);
}
async function cancelAndRefundDeal(env,dealId) {
  const timestamp=now();
  const result=await batch(env,[
    db(env,'UPDATE market_deals SET status=\'cancelled\',updated_at=? WHERE id=? AND status=\'active\'',
      timestamp,dealId),
    db(env,sql('UPDATE market_deal_bids SET status=\'rejected\',updated_at=? WHERE deal_id=? AND status=\'pending\'',
      'AND EXISTS(SELECT 1 FROM market_deals WHERE id=? AND status=\'cancelled\')'),
      timestamp,dealId,dealId),
    ownerRefund(env,dealId,timestamp),
    pendingRefunds(env,dealId,timestamp),
  ]);
  return Boolean(result[0]?.meta?.changes);
}
// Called only by the moderator route after assertModerator(). Shares the exact
// owner-cancel escrow transaction, including refunds for every losing bidder.
export async function cancelMarketDealForModerator(env,dealIdValue) {
  const dealId=id(dealIdValue);
  const deal=await first(env,'SELECT * FROM market_deals WHERE id=?',dealId);
  if(!deal)throw new HttpError(404,'deal_not_found','自由订单不存在');
  const changed=deal.status==='active' ? await cancelAndRefundDeal(env,dealId):false;
  return {id:dealId,owner_user_id:deal.owner_user_id,title:deal.title,changed};
}
async function expireDeal(env,dealId,timestamp) {
  await batch(env,[
    db(env,'UPDATE market_deals SET status=\'expired\',updated_at=? WHERE id=? AND status=\'active\' AND expires_at<=?',
      timestamp,dealId,timestamp),
    db(env,sql('UPDATE market_deal_bids SET status=\'rejected\',updated_at=? WHERE deal_id=? AND status=\'pending\'',
      'AND EXISTS(SELECT 1 FROM market_deals WHERE id=? AND status=\'expired\')'),
      timestamp,dealId,dealId),
    ownerRefund(env,dealId,timestamp),
    pendingRefunds(env,dealId,timestamp),
  ]);
}
export async function settleExpiredMarketDeals(env,{limit=100}={}) {
  const timestamp=now();
  const rows=await all(env,
    'SELECT id FROM market_deals WHERE status=\'active\' AND expires_at<=? ORDER BY expires_at LIMIT ?',
    timestamp,Math.min(500,Math.max(1,limit)));
  for(const row of rows)await expireDeal(env,row.id,timestamp);
  return {expired:rows.length};
}
export async function getMarketDealState(env,user) {
  // Orders is an active board, not a three-day transaction history. Settle
  // expirations first so their assets remain available in the claim queue.
  await settleExpiredMarketDeals(env);
  const timestamp=now();
  const [mine,participating,transfers]=await Promise.all([
    all(env,dealSelect+
      ' WHERE d.owner_user_id=? AND d.owner_save_id=? AND d.status=\'active\' AND d.expires_at>? ORDER BY d.created_at DESC LIMIT 100',
      user.id,user.market_save_id,timestamp),
    all(env, bidSelect +
      ' JOIN market_deals d ON d.id=b.deal_id WHERE b.bidder_user_id=? AND b.bidder_save_id=? AND b.status=\'pending\' AND d.status=\'active\' AND d.expires_at>? ORDER BY b.created_at DESC LIMIT 100',
      user.id,user.market_save_id,timestamp),
    all(env,sql('SELECT * FROM market_deal_transfers',
      'WHERE user_id=? AND save_id=? AND confirmed_at IS NULL ORDER BY created_at ASC LIMIT 200'),
      user.id,user.market_save_id),
  ]);
  return {
    deals:mine.map(decodeDeal), my_bids:participating.map(decodeBid),
    pending_deal_transfers:transfers.map(decodeTransfer),
  };
}
export async function confirmMarketDealTransfer(env,user,transferIdValue) {
  // Transfer IDs carry a fixed prefix plus a user-supplied deal/bid ID.
  // They can be longer than a standard 96-character order ID.
  const transferId=String(transferIdValue || '');
  if (!/^[A-Za-z0-9:_-]{6,128}$/u.test(transferId))
    throw new HttpError(400,'deal_transfer_invalid_id','订单领取凭证 ID 无效');
  const row=await first(env,'SELECT * FROM market_deal_transfers WHERE id=? AND user_id=? AND save_id=?',
    transferId,user.id,user.market_save_id);
  if (!row) throw new HttpError(404,'deal_transfer_not_found','领取凭证不存在');
  await db(env,'UPDATE market_deal_transfers SET confirmed_at=? WHERE id=? AND confirmed_at IS NULL',
    now(),transferId).run();
  return json({transfer:decodeTransfer(await first(env,
    'SELECT * FROM market_deal_transfers WHERE id=?',transferId))});
}
