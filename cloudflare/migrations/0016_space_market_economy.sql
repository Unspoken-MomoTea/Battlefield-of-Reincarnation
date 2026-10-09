ALTER TABLE market_listings ADD COLUMN duration_hours INTEGER NOT NULL DEFAULT 72;
ALTER TABLE market_listings ADD COLUMN expires_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE market_listings ADD COLUMN recycle_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE market_listings ADD COLUMN listing_fee INTEGER NOT NULL DEFAULT 0;
ALTER TABLE market_listings ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1));
ALTER TABLE market_listings ADD COLUMN restock_day TEXT NOT NULL DEFAULT '';

UPDATE market_listings
SET expires_at = CASE
      WHEN expires_at > 0 THEN expires_at
      ELSE created_at + 259200000
    END,
    recycle_at = CASE
      WHEN recycle_at > 0 THEN recycle_at
      ELSE created_at + 518400000
    END
WHERE is_system = 0;

ALTER TABLE market_trades ADD COLUMN market_fee INTEGER NOT NULL DEFAULT 0;
ALTER TABLE market_trades ADD COLUMN seller_proceeds INTEGER NOT NULL DEFAULT 0;

UPDATE market_trades
SET seller_proceeds = total_price
WHERE seller_proceeds = 0;

CREATE TABLE IF NOT EXISTS market_recycles (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('equipment', 'item', 'skill')),
  asset_name TEXT NOT NULL,
  asset_json TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  amount INTEGER NOT NULL CHECK (amount > 0),
  credited_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (listing_id) REFERENCES market_listings(id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_recycles_user
  ON market_recycles(user_id, credited_at, created_at DESC);

CREATE TABLE IF NOT EXISTS market_buybacks (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  asset_kind TEXT NOT NULL CHECK (asset_kind = 'equipment'),
  asset_name TEXT NOT NULL,
  asset_json TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity = 1),
  amount INTEGER NOT NULL CHECK (amount > 0),
  payout_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (payout_id) REFERENCES market_payouts(id)
);

CREATE INDEX IF NOT EXISTS idx_market_buybacks_user
  ON market_buybacks(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_listings_expiry
  ON market_listings(is_system, status, recycle_at, expires_at);
