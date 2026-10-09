-- The bazaar only narrates operations that actually write to the local MVU save.
-- Legacy narration columns from 0021 are kept for safe migration compatibility,
-- but stop maintaining their now-unused D1 indexes.
DROP INDEX IF EXISTS idx_market_trades_pending_seller_broadcast;
DROP INDEX IF EXISTS idx_market_recycles_pending_broadcast;
