ALTER TABLE market_listings ADD COLUMN market_kind TEXT NOT NULL DEFAULT '';
ALTER TABLE market_trades ADD COLUMN market_kind TEXT NOT NULL DEFAULT '';
ALTER TABLE market_returns ADD COLUMN market_kind TEXT NOT NULL DEFAULT '';
ALTER TABLE market_recycles ADD COLUMN market_kind TEXT NOT NULL DEFAULT '';
ALTER TABLE market_buybacks ADD COLUMN market_kind TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_market_listings_logical_kind
  ON market_listings(status, market_kind, unit_price, created_at DESC);
