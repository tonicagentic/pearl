/**
 * Drop finance.* user_id → public.user foreign keys.
 *
 * Requires a Neon **owner** connection (not finance_app):
 *   DATABASE_URL_UNPOOLED=... node scripts/apply-finance-drop-user-fks.mjs
 *
 * Or paste lib/finance/db/migrations/0004_drop_user_fks.sql in the Neon SQL editor.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(
  __dirname,
  "../lib/finance/db/migrations/0004_drop_user_fks.sql",
);

const url =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.FINANCE_DATABASE_ADMIN_URL;

if (!url) {
  console.error(
    "Set DATABASE_URL_UNPOOLED (Neon owner role) before running this script.",
  );
  process.exit(1);
}

const sql = readFileSync(sqlPath, "utf8");
const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  console.log("Dropped finance user_id → public.user foreign keys.");
} finally {
  await client.end();
}
