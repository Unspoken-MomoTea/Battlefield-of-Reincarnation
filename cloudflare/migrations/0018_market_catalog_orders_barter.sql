ALTER TABLE market_listings ADD COLUMN market_key TEXT NOT NULL DEFAULT '';
ALTER TABLE market_trades ADD COLUMN market_key TEXT NOT NULL DEFAULT '';
ALTER TABLE market_returns ADD COLUMN market_key TEXT NOT NULL DEFAULT '';
ALTER TABLE market_recycles ADD COLUMN market_key TEXT NOT NULL DEFAULT '';
ALTER TABLE market_buybacks ADD COLUMN market_key TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_market_listings_market_key
  ON market_listings(status, market_key, unit_price, created_at DESC);

CREATE TABLE IF NOT EXISTS market_products (
  market_key TEXT PRIMARY KEY,
  market_kind TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  asset_json TEXT NOT NULL,
  quality TEXT NOT NULL DEFAULT '',
  subtype TEXT NOT NULL DEFAULT '',
  lowest_price INTEGER NOT NULL DEFAULT 0,
  total_stock INTEGER NOT NULL DEFAULT 0,
  listing_count INTEGER NOT NULL DEFAULT 0,
  seller_count INTEGER NOT NULL DEFAULT 0,
  latest_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_market_products_kind_price
  ON market_products(market_kind, lowest_price, updated_at DESC);

CREATE TABLE IF NOT EXISTS market_price_daily (
  market_key TEXT NOT NULL,
  day_key TEXT NOT NULL,
  market_kind TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  quality TEXT NOT NULL DEFAULT '',
  low_price INTEGER NOT NULL,
  high_price INTEGER NOT NULL,
  last_price INTEGER NOT NULL,
  volume INTEGER NOT NULL DEFAULT 0,
  turnover INTEGER NOT NULL DEFAULT 0,
  trade_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (market_key, day_key)
);

CREATE INDEX IF NOT EXISTS idx_market_price_daily_asset
  ON market_price_daily(market_key, day_key DESC);

CREATE TABLE IF NOT EXISTS market_orders (
  id TEXT PRIMARY KEY,
  buyer_user_id INTEGER NOT NULL,
  market_key TEXT NOT NULL,
  market_kind TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  asset_json TEXT NOT NULL,
  quantity_total INTEGER NOT NULL CHECK (quantity_total > 0),
  quantity_remaining INTEGER NOT NULL CHECK (quantity_remaining >= 0),
  unit_price INTEGER NOT NULL CHECK (unit_price > 0),
  escrow_balance INTEGER NOT NULL CHECK (escrow_balance >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'filled', 'cancelled', 'expired')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (buyer_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_orders_active_key
  ON market_orders(status, market_key, unit_price DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_market_orders_buyer
  ON market_orders(buyer_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS market_order_fills (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  buyer_user_id INTEGER NOT NULL,
  seller_user_id INTEGER NOT NULL,
  market_key TEXT NOT NULL,
  market_kind TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  asset_json TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price > 0),
  total_price INTEGER NOT NULL CHECK (total_price > 0),
  market_fee INTEGER NOT NULL DEFAULT 0,
  seller_proceeds INTEGER NOT NULL DEFAULT 0,
  seller_credited_at INTEGER,
  delivered_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES market_orders(id),
  FOREIGN KEY (buyer_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (seller_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_order_fills_buyer
  ON market_order_fills(buyer_user_id, delivered_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_order_fills_seller
  ON market_order_fills(seller_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS market_barters (
  id TEXT PRIMARY KEY,
  owner_user_id INTEGER NOT NULL,
  offered_market_key TEXT NOT NULL,
  offered_market_kind TEXT NOT NULL,
  offered_asset_name TEXT NOT NULL,
  offered_asset_json TEXT NOT NULL,
  offered_quantity INTEGER NOT NULL CHECK (offered_quantity > 0),
  wanted_market_key TEXT NOT NULL,
  wanted_market_kind TEXT NOT NULL,
  wanted_asset_name TEXT NOT NULL,
  wanted_asset_json TEXT NOT NULL,
  wanted_quantity INTEGER NOT NULL CHECK (wanted_quantity > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'expired')),
  acceptor_user_id INTEGER,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (acceptor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_market_barters_active
  ON market_barters(status, wanted_market_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_barters_owner
  ON market_barters(owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS market_barter_deliveries (
  id TEXT PRIMARY KEY,
  barter_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  market_key TEXT NOT NULL,
  market_kind TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  asset_json TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  confirmed_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (barter_id) REFERENCES market_barters(id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_barter_deliveries_user
  ON market_barter_deliveries(user_id, confirmed_at, created_at DESC);

CREATE TABLE IF NOT EXISTS market_user_blocks (
  user_id INTEGER PRIMARY KEY,
  reason TEXT NOT NULL DEFAULT '',
  created_by INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS market_admin_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_admin_actions_created
  ON market_admin_actions(created_at DESC);
