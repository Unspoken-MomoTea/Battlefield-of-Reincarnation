ALTER TABLE market_listings ADD COLUMN catalog_key TEXT NOT NULL DEFAULT '';
ALTER TABLE market_listings ADD COLUMN quality TEXT NOT NULL DEFAULT '';
ALTER TABLE market_listings ADD COLUMN subtype TEXT NOT NULL DEFAULT '';
ALTER TABLE market_trades ADD COLUMN purchase_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_market_listings_catalog
  ON market_listings(catalog_key, status, unit_price, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_listings_filters
  ON market_listings(status, market_kind, quality, subtype, unit_price);

CREATE INDEX IF NOT EXISTS idx_market_trades_purchase
  ON market_trades(purchase_id, buyer_user_id, created_at);

CREATE TABLE IF NOT EXISTS market_catalog (
  catalog_key TEXT PRIMARY KEY,
  asset_kind TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  quality TEXT NOT NULL DEFAULT '',
  subtype TEXT NOT NULL DEFAULT '',
  asset_json TEXT NOT NULL,
  lowest_price INTEGER NOT NULL DEFAULT 0,
  total_stock INTEGER NOT NULL DEFAULT 0,
  listing_count INTEGER NOT NULL DEFAULT 0,
  seller_count INTEGER NOT NULL DEFAULT 0,
  latest_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_market_catalog_filters
  ON market_catalog(asset_kind, quality, subtype, lowest_price);

CREATE INDEX IF NOT EXISTS idx_market_catalog_latest
  ON market_catalog(latest_at DESC);

CREATE TABLE IF NOT EXISTS market_price_daily (
  catalog_key TEXT NOT NULL,
  day_key TEXT NOT NULL,
  low_price INTEGER NOT NULL,
  high_price INTEGER NOT NULL,
  last_price INTEGER NOT NULL,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  total_notional INTEGER NOT NULL DEFAULT 0,
  trade_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (catalog_key, day_key)
);

CREATE INDEX IF NOT EXISTS idx_market_price_daily_key
  ON market_price_daily(catalog_key, day_key DESC);

CREATE TABLE IF NOT EXISTS market_purchases (
  id TEXT PRIMARY KEY,
  buyer_user_id INTEGER NOT NULL,
  catalog_key TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  total_price INTEGER NOT NULL CHECK (total_price > 0),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (buyer_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_purchases_buyer
  ON market_purchases(buyer_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS market_buy_orders (
  id TEXT PRIMARY KEY,
  buyer_user_id INTEGER NOT NULL,
  asset_kind TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  quality TEXT NOT NULL DEFAULT '',
  subtype TEXT NOT NULL DEFAULT '',
  unit_price INTEGER NOT NULL CHECK (unit_price > 0),
  total_quantity INTEGER NOT NULL CHECK (total_quantity > 0),
  remaining_quantity INTEGER NOT NULL CHECK (remaining_quantity >= 0),
  escrow_balance INTEGER NOT NULL CHECK (escrow_balance >= 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'filled', 'cancelled', 'expired')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (buyer_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_buy_orders_active
  ON market_buy_orders(status, asset_kind, quality, subtype, unit_price DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_buy_orders_buyer
  ON market_buy_orders(buyer_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS market_order_fills (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  seller_user_id INTEGER NOT NULL,
  buyer_user_id INTEGER NOT NULL,
  asset_kind TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  asset_json TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price > 0),
  total_price INTEGER NOT NULL CHECK (total_price > 0),
  delivered_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES market_buy_orders(id),
  FOREIGN KEY (seller_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (buyer_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_order_fills_buyer
  ON market_order_fills(buyer_user_id, delivered_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_order_fills_seller
  ON market_order_fills(seller_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS market_swaps (
  id TEXT PRIMARY KEY,
  owner_user_id INTEGER NOT NULL,
  offered_kind TEXT NOT NULL,
  offered_name TEXT NOT NULL,
  offered_json TEXT NOT NULL,
  offered_quantity INTEGER NOT NULL CHECK (offered_quantity > 0),
  wanted_kind TEXT NOT NULL,
  wanted_name TEXT NOT NULL,
  wanted_quality TEXT NOT NULL DEFAULT '',
  wanted_subtype TEXT NOT NULL DEFAULT '',
  wanted_quantity INTEGER NOT NULL CHECK (wanted_quantity > 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled', 'expired')),
  accepted_by_user_id INTEGER,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (accepted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_market_swaps_active
  ON market_swaps(status, wanted_kind, wanted_quality, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_swaps_owner
  ON market_swaps(owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS market_swap_transfers (
  id TEXT PRIMARY KEY,
  swap_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  asset_kind TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  asset_json TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  confirmed_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (swap_id) REFERENCES market_swaps(id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_swap_transfers_user
  ON market_swap_transfers(user_id, confirmed_at, created_at DESC);

CREATE TABLE IF NOT EXISTS market_user_controls (
  user_id INTEGER PRIMARY KEY,
  is_suspended INTEGER NOT NULL DEFAULT 0 CHECK (is_suspended IN (0, 1)),
  note TEXT NOT NULL DEFAULT '',
  updated_by_user_id INTEGER,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
