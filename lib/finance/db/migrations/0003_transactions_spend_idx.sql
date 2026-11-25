-- Speeds month spend aggregates: range on date + filter by type for a user.
CREATE INDEX IF NOT EXISTS transactions_user_date_type_idx
  ON finance.transactions (user_id, date, type);
