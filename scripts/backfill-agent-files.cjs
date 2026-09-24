/* One-time backfill: push existing agent_file content to Blob and stamp the
 * reference, so pre-blob-primary documents appear on /artifacts and get
 * cross-session restore without waiting to be re-edited.
 *
 * Idempotent: rows with a blob_pathname are skipped; same-basename docs
 * across chats resolve newest-wins (ordered by updated_at ascending, so the
 * newest write lands last). Non-destructive: the Postgres content column is
 * kept as a fallback cache; only blob_pathname is stamped.
 *
 * Uses `pg` over TCP: the neon-http driver's fetch path is blocked from
 * dev shells, while drizzle's migrate (TCP) reaches the same database.
 *
 * Run: pnpm exec vercel env run -e production -- node scripts/backfill-agent-files.cjs
 */
const { randomUUID, createHash } = require("node:crypto");
const { Client } = require("pg");
const { put } = require("@vercel/blob");

// Mirrors agent/lib/artifacts.ts (artifactsPrefix + slug basename); inlined
// because this one-off script runs outside the app's module resolution.
function artifactsPrefix(principalId) {
  const id = createHash("sha256").update(principalId).digest("hex");
  return `artifacts/${id}/`;
}

function slugFor(path) {
  const relative = path
    .trim()
    .replace(/^\/workspace\//, "")
    .replace(/^\/+/, "")
    .replace(/^artifacts\/[0-9a-f]{64}\//, "");

  if (!relative || /(^|\/)\.\.?(\/|$)/.test(relative)) {
    return null;
  }

  return relative;
}

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows } = await client.query(
    `SELECT f.id, f.path, f.content, c.user_id
     FROM agent_file f
     JOIN chat c ON c.id = f.chat_id
     WHERE f.blob_pathname IS NULL AND f.content IS NOT NULL
     ORDER BY f.updated_at ASC`,
  );

  console.log(`rows to backfill: ${rows.length}`);

  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    const prefix = artifactsPrefix(row.user_id);
    const slug = slugFor(row.path);

    if (!slug) {
      skipped += 1;
      continue;
    }

    const key = `${prefix}${slug}`;

    await put(key, row.content, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/markdown",
    });

    await client.query(
      `UPDATE agent_file SET blob_pathname = $1 WHERE id = $2`,
      [key, row.id],
    );

    migrated += 1;
  }

  await client.end();

  console.log(`backfilled: ${migrated}, skipped: ${skipped}`);
})().catch((error) => {
  console.error("ERR", error.message);
  process.exit(1);
});