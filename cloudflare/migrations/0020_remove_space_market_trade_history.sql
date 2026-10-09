-- Trade history is not a product feature. Completed transfers remain temporary
-- transaction receipts only until retry-safe cleanup; discard historical price aggregates.
DROP TABLE IF EXISTS market_price_daily;
