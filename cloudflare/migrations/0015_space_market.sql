CREATE TABLE IF NOT EXISTS market_listings (
  id TEXT PRIMARY KEY,
  seller_user_id INTEGER NOT NULL,
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('equipment', 'item', 'skill')),
  asset_name TEXT NOT NULL,
  asset_json TEXT NOT NULL,
  unit_price INTEGER NOT NULL CHECK (unit_price > 0),
  total_quantity INTEGER NOT NULL CHECK (total_quantity > 0),
  remaining_quantity INTEGER NOT NULL CHECK (remaining_quantity >= 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'sold', 'cancelled')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (seller_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_listings_active
  ON market_listings(status, asset_kind, unit_price, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_listings_seller
  ON market_listings(seller_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS market_trades (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  seller_user_id INTEGER NOT NULL,
  buyer_user_id INTEGER NOT NULL,
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('equipment', 'item', 'skill')),
  asset_name TEXT NOT NULL,
  asset_json TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price > 0),
  total_price INTEGER NOT NULL CHECK (total_price > 0),
  delivered_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (listing_id) REFERENCES market_listings(id),
  FOREIGN KEY (seller_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (buyer_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_trades_buyer
  ON market_trades(buyer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_trades_seller
  ON market_trades(seller_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS market_wallets (
  user_id INTEGER PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS market_payouts (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  confirmed_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_payouts_user
  ON market_payouts(user_id, confirmed_at, created_at DESC);

CREATE TABLE IF NOT EXISTS market_returns (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('equipment', 'item', 'skill')),
  asset_name TEXT NOT NULL,
  asset_json TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  confirmed_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (listing_id) REFERENCES market_listings(id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_returns_user
  ON market_returns(user_id, confirmed_at, created_at DESC);
