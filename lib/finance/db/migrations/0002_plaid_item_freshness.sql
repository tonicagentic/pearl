-- Pearl Money: track Plaid Transactions Refresh + sync freshness on plaid_items.
ALTER TABLE finance.plaid_items
  ADD COLUMN IF NOT EXISTS last_refreshed_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamp without time zone;
