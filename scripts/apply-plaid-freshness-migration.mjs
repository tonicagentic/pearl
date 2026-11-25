/**
 * Apply finance.plaid_items last_refreshed_at / last_synced_at columns.
 *
 * Requires a Neon **owner** connection (not finance_app):
 *   DATABASE_URL_UNPOOLED=... node scripts/apply-plaid-freshness-migration.mjs
 *
 * Or paste lib/finance/db/migrations/0002_plaid_item_freshness.sql in the Neon SQL editor.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(
  __dirname,
  "../lib/finance/db/migrations/0002_plaid_item_freshness.sql",
);

const url =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

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
  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'finance' AND table_name = 'plaid_items'
       AND column_name IN ('last_refreshed_at', 'last_synced_at')
     ORDER BY 1`,
  );
  console.log(
    "ok:",
    cols.rows.map((r) => r.column_name).join(", ") || "(no columns found)",
  );
} finally {
  await client.end();
}
