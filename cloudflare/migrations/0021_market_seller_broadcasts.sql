-- A sale is a pending narration event until its seller's original save receives it.
-- Old testing sales are marked as handled; the migration must not replay historical sales.
ALTER TABLE market_trades ADD COLUMN seller_announced_at INTEGER;
UPDATE market_trades SET seller_announced_at = created_at WHERE seller_announced_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_market_trades_pending_seller_broadcast
  ON market_trades(seller_user_id, seller_announced_at, created_at);
