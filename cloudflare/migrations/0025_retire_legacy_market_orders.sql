-- Retire the two abandoned exact-match order engines after negotiated deals
-- replaced them. Staging and stable deliberately share D1. NEVER drop escrow.
-- Old order refunds and offered swap assets remain claimable in the original
-- save via the existing /api/market/me pending-payout / pending-swap endpoints.
INSERT OR IGNORE INTO market_payouts
  (id, user_id, save_id, amount, confirmed_at, created_at)
SELECT 'order-refund:' || substr(id,1,83), buyer_user_id, save_id,
       escrow_balance, NULL, CAST(strftime('%s','now') AS INTEGER) * 1000
FROM market_buy_orders
WHERE status='active' AND escrow_balance>0;

UPDATE market_buy_orders
SET status='cancelled', escrow_balance=0,
    updated_at=CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE status='active' AND (
  escrow_balance=0 OR EXISTS (
    SELECT 1 FROM market_payouts p
    WHERE p.id='order-refund:' || substr(market_buy_orders.id,1,83)
      AND p.user_id=market_buy_orders.buyer_user_id
      AND p.save_id=market_buy_orders.save_id
      AND p.amount=market_buy_orders.escrow_balance
  )
);

INSERT OR IGNORE INTO market_swap_transfers
 (id,swap_id,user_id,save_id,asset_kind,asset_name,asset_json,quantity,confirmed_at,created_at)
SELECT 'swap-return:' || substr(id,1,84),id,owner_user_id,owner_save_id,
       offered_kind,offered_name,offered_json,offered_quantity,NULL,
       CAST(strftime('%s','now') AS INTEGER) * 1000
FROM market_swaps WHERE status='active';

UPDATE market_swaps
SET status='cancelled',updated_at=CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE status='active' AND EXISTS(
  SELECT 1 FROM market_swap_transfers t
  WHERE t.id='swap-return:' || substr(market_swaps.id,1,84)
    AND t.swap_id=market_swaps.id
    AND t.user_id=market_swaps.owner_user_id
    AND t.save_id=market_swaps.owner_save_id
);
