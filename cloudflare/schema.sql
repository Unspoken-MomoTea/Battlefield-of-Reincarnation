PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  is_moderator INTEGER NOT NULL DEFAULT 0 CHECK (is_moderator IN (0, 1)),
  is_banned INTEGER NOT NULL DEFAULT 0 CHECK (is_banned IN (0, 1)),
  ban_reason TEXT NOT NULL DEFAULT '',
  banned_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  owner_user_id INTEGER NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  dependencies TEXT NOT NULL DEFAULT '[]',
  project_type TEXT NOT NULL DEFAULT 'extension'
    CHECK (project_type IN ('character', 'extension')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'published', 'rejected', 'archived')),
  owner_hidden INTEGER NOT NULL DEFAULT 0 CHECK (owner_hidden IN (0, 1)),
  latest_version INTEGER NOT NULL DEFAULT 0,
  published_version INTEGER NOT NULL DEFAULT 0,
  cover_key TEXT,
  downloads_count INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,
  favorites_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_projects_public
  ON projects(published_version, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_owner
  ON projects(owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_owner_visibility
  ON projects(owner_hidden, published_version, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_type_public
  ON projects(project_type, published_version, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS project_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  manifest_key TEXT NOT NULL,
  content_key TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  dependencies TEXT NOT NULL DEFAULT '[]',
  project_type TEXT NOT NULL DEFAULT 'extension'
    CHECK (project_type IN ('character', 'extension')),
  content_kind TEXT NOT NULL DEFAULT '',
  cover_key TEXT,
  changelog TEXT NOT NULL DEFAULT '',
  review_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft', 'pending', 'approved', 'rejected')),
  created_at INTEGER NOT NULL,
  submitted_at INTEGER,
  reviewed_at INTEGER,
  local_backup_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (local_backup_confirmed IN (0, 1)),
  UNIQUE(project_id, version),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_versions_review
  ON project_versions(review_status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_project_versions_content_kind
  ON project_versions(content_kind, project_id, version);

CREATE TABLE IF NOT EXISTS review_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  reviewer_user_id INTEGER NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_user_id) REFERENCES users(id)
);


CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER NOT NULL,
  project_id TEXT,
  project_version INTEGER,
  target_user_id INTEGER,
  action TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users(id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created
  ON admin_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_project
  ON admin_audit_logs(project_id, created_at DESC);


CREATE TABLE IF NOT EXISTS project_likes (
  project_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_favorites (
  project_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_likes_user
  ON project_likes(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_favorites_user
  ON project_favorites(user_id, created_at DESC);


CREATE TABLE IF NOT EXISTS project_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  project_version INTEGER NOT NULL,
  reporter_user_id INTEGER NOT NULL,
  reason TEXT NOT NULL
    CHECK (reason IN ('malicious', 'broken', 'inappropriate', 'stolen', 'other')),
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolution_note TEXT NOT NULL DEFAULT '',
  resolved_by_user_id INTEGER,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_reports_open_unique
  ON project_reports(project_id, reporter_user_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_project_reports_status
  ON project_reports(status, created_at DESC);

CREATE TABLE IF NOT EXISTS auth_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_store_expires
  ON auth_store(expires_at);

CREATE TABLE IF NOT EXISTS market_listings (
  id TEXT PRIMARY KEY,
  seller_user_id INTEGER NOT NULL,
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('equipment', 'item', 'skill')),
  market_kind TEXT NOT NULL DEFAULT '',
  asset_name TEXT NOT NULL,
  asset_json TEXT NOT NULL,
  unit_price INTEGER NOT NULL CHECK (unit_price > 0),
  total_quantity INTEGER NOT NULL CHECK (total_quantity > 0),
  remaining_quantity INTEGER NOT NULL CHECK (remaining_quantity >= 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'sold', 'cancelled')),
  duration_hours INTEGER NOT NULL DEFAULT 72,
  expires_at INTEGER NOT NULL DEFAULT 0,
  recycle_at INTEGER NOT NULL DEFAULT 0,
  listing_fee INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
  restock_day TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (seller_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_listings_active
  ON market_listings(status, asset_kind, unit_price, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_listings_seller
  ON market_listings(seller_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_listings_expiry
  ON market_listings(is_system, status, recycle_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_market_listings_logical_kind
  ON market_listings(status, market_kind, unit_price, created_at DESC);

CREATE TABLE IF NOT EXISTS market_trades (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  seller_user_id INTEGER NOT NULL,
  buyer_user_id INTEGER NOT NULL,
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('equipment', 'item', 'skill')),
  market_kind TEXT NOT NULL DEFAULT '',
  asset_name TEXT NOT NULL,
  asset_json TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price > 0),
  total_price INTEGER NOT NULL CHECK (total_price > 0),
  market_fee INTEGER NOT NULL DEFAULT 0,
  seller_proceeds INTEGER NOT NULL DEFAULT 0,
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
  market_kind TEXT NOT NULL DEFAULT '',
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

CREATE TABLE IF NOT EXISTS market_recycles (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('equipment', 'item', 'skill')),
  market_kind TEXT NOT NULL DEFAULT '',
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
  market_kind TEXT NOT NULL DEFAULT '',
  asset_name TEXT NOT NULL,
  asset_json TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity = 1),
  market_quantity INTEGER NOT NULL DEFAULT 0,
  amount INTEGER NOT NULL CHECK (amount > 0),
  payout_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (payout_id) REFERENCES market_payouts(id)
);

CREATE INDEX IF NOT EXISTS idx_market_buybacks_user
  ON market_buybacks(user_id, created_at DESC);


-- Space Bazaar scalable catalog / orders / swaps / moderation
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
