-- A sale is a pending narration event until its seller's original save receives it.
-- Old testing sales are marked as handled; the migration must not replay historical sales.
ALTER TABLE market_trades ADD COLUMN seller_announced_at INTEGER;
UPDATE market_trades SET seller_announced_at = created_at WHERE seller_announced_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_market_trades_pending_seller_broadcast
  ON market_trades(seller_user_id, seller_announced_at, created_at);

ALTER TABLE market_recycles ADD COLUMN broadcast_at INTEGER;
UPDATE market_recycles SET broadcast_at = credited_at WHERE credited_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_market_recycles_pending_broadcast
  ON market_recycles(user_id, save_id, broadcast_at, credited_at);
