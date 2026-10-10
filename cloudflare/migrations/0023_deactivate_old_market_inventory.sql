-- One-time testing Bazaar stock reset. D1 is shared across staging and stable.
-- Never modify users, workshop projects, trades, owed funds, or pending deliveries.
-- Existing auctions become unbuyable; stale rows remain for safe reconciliation.
UPDATE market_listings
SET status = 'cancelled',
    remaining_quantity = 0,
    updated_at = 0,
    restock_day = CASE WHEN is_system = 1 AND id LIKE 'system:credential:%'
                       THEN '' ELSE restock_day END;
UPDATE market_catalog
SET total_stock = 0,
    listing_count = 0,
    seller_count = 0,
    lowest_price = 0,
    updated_at = 0;
