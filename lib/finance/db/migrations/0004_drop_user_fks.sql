-- finance_app cannot read public.user, and Pearl auth may live on a different
-- database than FINANCE_DATABASE_URL (local Postgres vs Neon). RLS already
-- scopes rows via app.user_id; the cross-schema FKs only block inserts for
-- users that exist in auth but not yet in Neon public.user.
--
-- Apply as the Neon owner role (not finance_app), e.g.:
--   DATABASE_URL_UNPOOLED='postgresql://…' node scripts/apply-finance-drop-user-fks.mjs

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, c.conname
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE c.contype = 'f'
      AND nsp.nspname = 'finance'
      AND c.conname LIKE '%_user_id_user_id_fk'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
  END LOOP;
END $$;
