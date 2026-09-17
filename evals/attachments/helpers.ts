import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { parsePdfAttachment } from "../../lib/attachments/pdf.ts";

// Eval-side seeding for the read_attachment flow. The eve eval driver talks
// to the harness directly (no app chat row exists), so these helpers create
// the minimal rows the read_attachment tool's ownership check resolves:
// a chat row linked to the session, and the attachment owned by the same
// user. Env comes from .env.local/.env.development.local like drizzle.config.

async function loadDatabaseUrl(): Promise<string> {
  if (process.env.DATABASE_URL?.trim()) {
    return process.env.DATABASE_URL;
  }

  for (const file of [".env.development.local", ".env.local"]) {
    const content = await readFile(file, "utf8").catch(() => "");
    const match = content.match(/^DATABASE_URL=(?!\"|^#)(.+)$/m);

    if (match) {
      return match[1].trim().replace(/^\"|\"$/g, "");
    }
  }

  throw new Error("DATABASE_URL not found for eval seeding.");
}

export async function getTestDatabase() {
  const { Pool } = await import("pg");
  return new Pool({ connectionString: await loadDatabaseUrl() });
}

export type SeededAttachment = {
  readonly attachmentId: string;
  readonly pageCount: number | null;
};

/**
 * Extracts the PDF fixture (same path as the upload route) and stores the
 * attachment + pages for the test user, then links the current eval session
 * to a chat row owned by that user so read_attachment's ownership check
 * resolves.
 */
export async function seedPdfAttachment(
  fixturePath: string,
  sessionId: string,
): Promise<SeededAttachment> {
  const { Pool } = await import("pg");
  const bytes = await readFile(fixturePath);
  const parsed = await parsePdfAttachment(bytes);

  const pool = new Pool({ connectionString: await loadDatabaseUrl() });

  try {
    const user = await pool.query('SELECT id FROM "user" ORDER BY created_at LIMIT 1');
    const userId = user.rows[0].id as string;

    // Reuse the attachment when a previous run already stored it, but ALWAYS
    // link the chat row: each eval run gets a fresh session, and the
    // read_attachment tool resolves ownership through this link.
    const attachmentId = randomUUID();
    const existing = await pool.query(
      "SELECT id FROM agent_attachment WHERE user_id=$1 AND name=$2 ORDER BY created_at DESC LIMIT 1",
      [userId, fixturePath.split("/").pop() ?? "attachment.pdf"],
    );

    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO agent_attachment (id, user_id, name, media_type, byte_length, pdf_type, page_count, pages, extraction_note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          attachmentId,
          userId,
          fixturePath.split("/").pop() ?? "attachment.pdf",
          "application/pdf",
          bytes.byteLength,
          parsed.ok ? parsed.pdfType : null,
          parsed.ok ? parsed.pageCount : null,
          // pg serializes JS arrays to Postgres array literals, which are not
          // valid json/jsonb input — stringify explicitly.
          parsed.ok ? JSON.stringify(parsed.pages) : null,
          parsed.ok ? null : parsed.message,
        ],
      );
    }

    await pool.query(
      `INSERT INTO chat (id, user_id, title, eve_session)
       VALUES ($1, $2, $3, $4)`,
      [
        randomUUID(),
        userId,
        "Attachment eval session",
        JSON.stringify({ sessionId, streamIndex: 0 }),
      ],
    );

    return {
      attachmentId: existing.rows.length > 0 ? (existing.rows[0].id as string) : attachmentId,
      pageCount: parsed.ok ? parsed.pageCount : null,
    };
  } finally {
    await pool.end();
  }
}
