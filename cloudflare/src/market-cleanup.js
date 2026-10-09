// Marketplace rows are transaction receipts, not a user-facing sales history.
// Never touch unsettled money, items, escrow or undelivered transfers.
// A short recovery window protects retries after the client has confirmed delivery.
const RECEIPT_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;

async function prune(env, table, sql, values) {
  const result = await env.DB.prepare(sql).bind(...values).run();
  return Math.max(0, Number(result?.meta?.changes || 0));
}

export async function cleanupCompletedMarketRecords(env, { limit = 200, now = Date.now() } = {}) {
  const cutoff = Number(now) - RECEIPT_RETRY_WINDOW_MS;
  const batch = Math.max(1, Math.min(500, Math.trunc(Number(limit) || 200)));
  const removed = {};

  // Children first: the database has foreign keys from transfers/fills to parent orders.
  removed.swapTransfers = await prune(env, 'market_swap_transfers',
    `DELETE FROM market_swap_transfers WHERE id IN
      (SELECT id FROM market_swap_transfers
       WHERE confirmed_at IS NOT NULL AND confirmed_at < ? LIMIT ?)`, [cutoff, batch]);

  removed.swaps = await prune(env, 'market_swaps',
    `DELETE FROM market_swaps WHERE id IN
      (SELECT s.id FROM market_swaps s
       WHERE s.status <> 'active' AND s.updated_at < ?
         AND NOT EXISTS (SELECT 1 FROM market_swap_transfers t WHERE t.swap_id = s.id)
       LIMIT ?)`, [cutoff, batch]);

  removed.orderFills = await prune(env, 'market_order_fills',
    `DELETE FROM market_order_fills WHERE id IN
      (SELECT id FROM market_order_fills
       WHERE delivered_at IS NOT NULL AND delivered_at < ? LIMIT ?)`, [cutoff, batch]);

  removed.orders = await prune(env, 'market_buy_orders',
    `DELETE FROM market_buy_orders WHERE id IN
      (SELECT o.id FROM market_buy_orders o
       WHERE o.status IN ('filled', 'cancelled', 'expired') AND o.escrow_balance = 0
         AND o.updated_at < ?
         AND NOT EXISTS (SELECT 1 FROM market_order_fills f WHERE f.order_id = o.id)
       LIMIT ?)`, [cutoff, batch]);

  // Do not partially remove a grouped purchase: retries still need all of its receipts.
  removed.trades = await prune(env, 'market_trades',
    `DELETE FROM market_trades WHERE id IN
      (SELECT t.id FROM market_trades t
       WHERE t.delivered_at IS NOT NULL AND t.delivered_at < ?
         AND (t.seller_announced_at IS NOT NULL OR EXISTS (
           SELECT 1 FROM market_listings owner_listing
           WHERE owner_listing.id = t.listing_id AND owner_listing.is_system = 1
         ))
         AND (t.purchase_id = '' OR NOT EXISTS (
           SELECT 1 FROM market_trades sibling
           WHERE sibling.purchase_id = t.purchase_id
             AND (sibling.delivered_at IS NULL OR sibling.delivered_at >= ?)
         ))
       LIMIT ?)`, [cutoff, cutoff, batch]);

  removed.purchases = await prune(env, 'market_purchases',
    `DELETE FROM market_purchases WHERE id IN
      (SELECT p.id FROM market_purchases p
       WHERE p.status = 'completed' AND p.created_at < ?
         AND NOT EXISTS (SELECT 1 FROM market_trades t WHERE t.purchase_id = p.id)
       LIMIT ?)`, [cutoff, batch]);

  removed.returns = await prune(env, 'market_returns',
    `DELETE FROM market_returns WHERE id IN
      (SELECT id FROM market_returns WHERE confirmed_at IS NOT NULL
       AND confirmed_at < ? LIMIT ?)`, [cutoff, batch]);

  removed.buybacks = await prune(env, 'market_buybacks',
    `DELETE FROM market_buybacks WHERE id IN
      (SELECT b.id FROM market_buybacks b
       JOIN market_payouts p ON p.id = b.payout_id
       WHERE p.confirmed_at IS NOT NULL AND p.confirmed_at < ?
       LIMIT ?)`, [cutoff, batch]);

  removed.recycles = await prune(env, 'market_recycles',
    `DELETE FROM market_recycles WHERE id IN
      (SELECT id FROM market_recycles
       WHERE credited_at IS NOT NULL AND credited_at < ?
         AND broadcast_at IS NOT NULL LIMIT ?)`, [cutoff, batch]);

  removed.payouts = await prune(env, 'market_payouts',
    `DELETE FROM market_payouts WHERE id IN
      (SELECT p.id FROM market_payouts p
       WHERE p.confirmed_at IS NOT NULL AND p.confirmed_at < ?
         AND NOT EXISTS (SELECT 1 FROM market_buybacks b WHERE b.payout_id = p.id)
       LIMIT ?)`, [cutoff, batch]);

  // Completed listings can be discarded only after all linked delivery/return rows
  // have been cleaned. The seller's unpaid balance lives in market_save_wallets.
  removed.listings = await prune(env, 'market_listings',
    `DELETE FROM market_listings WHERE id IN
      (SELECT l.id FROM market_listings l
       WHERE l.is_system = 0 AND l.status IN ('sold', 'cancelled')
         AND l.updated_at < ?
         AND NOT EXISTS (SELECT 1 FROM market_trades t WHERE t.listing_id = l.id)
         AND NOT EXISTS (SELECT 1 FROM market_returns r WHERE r.listing_id = l.id)
         AND NOT EXISTS (SELECT 1 FROM market_recycles c WHERE c.listing_id = l.id)
       LIMIT ?)`, [cutoff, batch]);
  return removed;
}
