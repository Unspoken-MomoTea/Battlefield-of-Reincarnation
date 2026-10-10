-- Unified consent-based orders. Funds and assets are escrowed when offered from MVU;
-- completion/withdrawal generates one-shot save-scoped claim receipts, never an
-- off-save MVU write. No old market tables are modified or deleted.
CREATE TABLE IF NOT EXISTS market_deals (
  id TEXT PRIMARY KEY,
  owner_user_id INTEGER NOT NULL REFERENCES users(id),
  owner_save_id TEXT NOT NULL,
  title TEXT NOT NULL,
  wanted TEXT NOT NULL,
  offer_assets_json TEXT NOT NULL,
  offer_coins INTEGER NOT NULL DEFAULT 0 CHECK (offer_coins >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','cancelled','expired')),
  accepted_bid_id TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_market_deals_public ON market_deals(status, expires_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_deals_owner ON market_deals(owner_user_id, owner_save_id, created_at DESC);
CREATE TABLE IF NOT EXISTS market_deal_bids (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES market_deals(id),
  bidder_user_id INTEGER NOT NULL REFERENCES users(id),
  bidder_save_id TEXT NOT NULL,
  offer_assets_json TEXT NOT NULL,
  offer_coins INTEGER NOT NULL DEFAULT 0 CHECK(offer_coins >= 0),
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','withdrawn')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_market_deal_bids_deal ON market_deal_bids(deal_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_deal_bids_user ON market_deal_bids(bidder_user_id,bidder_save_id,status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_deal_one_pending_bid
  ON market_deal_bids(deal_id,bidder_user_id) WHERE status='pending';
CREATE TABLE IF NOT EXISTS market_deal_transfers (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES market_deals(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  save_id TEXT NOT NULL,
  assets_json TEXT NOT NULL,
  coins INTEGER NOT NULL DEFAULT 0 CHECK(coins >= 0),
  confirmed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_market_deal_transfers_pending
  ON market_deal_transfers(user_id, save_id, confirmed_at, created_at);
