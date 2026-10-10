-- Final pre-release Bazaar cleanup. 0023 deactivated the original test
-- inventory but intentionally preserved its rows. Admin pages should no
-- longer be cluttered by those archived test fixtures.
--
-- The database is shared by staging and stable: no users, workshop works,
-- wallets, deliveries, orders, or other non-listing tables are deleted.
-- Never delete an auction referenced by a trade or a return/recycle claim.
-- Every non-system active auction, and daily F-A vouchers, is preserved.
UPDATE market_listings
SET status = 'cancelled', remaining_quantity = 0
WHERE id LIKE 'test-vendor:%' AND status = 'active';

DELETE FROM market_listings
WHERE status = 'cancelled' AND remaining_quantity = 0
  AND NOT EXISTS (SELECT 1 FROM market_trades t WHERE t.listing_id = market_listings.id)
  AND NOT EXISTS (SELECT 1 FROM market_returns r WHERE r.listing_id = market_listings.id)
  AND NOT EXISTS (SELECT 1 FROM market_recycles r WHERE r.listing_id = market_listings.id);

-- Delete empty catalog summaries from the old reset. Active catalog keys
-- are repopulated/refreshed by the normal Worker catalogue logic.
DELETE FROM market_catalog
WHERE total_stock = 0 AND listing_count = 0;
