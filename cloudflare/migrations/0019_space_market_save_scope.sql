-- Space market save scopes. Existing testing records are deliberately left unscoped;
-- the user will wipe pre-release testing market data before stable release.
ALTER TABLE market_listings ADD COLUMN save_id TEXT NOT NULL DEFAULT '';
ALTER TABLE market_trades ADD COLUMN buyer_save_id TEXT NOT NULL DEFAULT '';
ALTER TABLE market_purchases ADD COLUMN save_id TEXT NOT NULL DEFAULT '';
ALTER TABLE market_payouts ADD COLUMN save_id TEXT NOT NULL DEFAULT '';
ALTER TABLE market_returns ADD COLUMN save_id TEXT NOT NULL DEFAULT '';
ALTER TABLE market_recycles ADD COLUMN save_id TEXT NOT NULL DEFAULT '';
ALTER TABLE market_buybacks ADD COLUMN save_id TEXT NOT NULL DEFAULT '';
ALTER TABLE market_buy_orders ADD COLUMN save_id TEXT NOT NULL DEFAULT '';
ALTER TABLE market_order_fills ADD COLUMN buyer_save_id TEXT NOT NULL DEFAULT '';
ALTER TABLE market_order_fills ADD COLUMN seller_save_id TEXT NOT NULL DEFAULT '';
ALTER TABLE market_swaps ADD COLUMN owner_save_id TEXT NOT NULL DEFAULT '';
ALTER TABLE market_swaps ADD COLUMN accepted_save_id TEXT NOT NULL DEFAULT '';
ALTER TABLE market_swap_transfers ADD COLUMN save_id TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS market_save_wallets (
  user_id INTEGER NOT NULL,
  save_id TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, save_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_listings_user_save
  ON market_listings(seller_user_id, save_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_market_trades_buyer_save
  ON market_trades(buyer_user_id, buyer_save_id, delivered_at);
CREATE INDEX IF NOT EXISTS idx_market_payouts_save
  ON market_payouts(user_id, save_id, confirmed_at);
CREATE INDEX IF NOT EXISTS idx_market_returns_save
  ON market_returns(user_id, save_id, confirmed_at);
CREATE INDEX IF NOT EXISTS idx_market_buy_orders_save
  ON market_buy_orders(buyer_user_id, save_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_swap_transfers_save
  ON market_swap_transfers(user_id, save_id, confirmed_at);
