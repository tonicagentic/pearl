import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeonHttp, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/lib/db/schema";

let database: NeonHttpDatabase<typeof schema> | null = null;

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

// Local development uses a plain Postgres server (for example Postgres.app),
// which the Neon HTTP driver cannot talk to. Route localhost URLs through
// node-postgres; anything else keeps the Neon serverless driver.
function isLocalDatabaseUrl(url: string) {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function getDb() {
  if (!database) {
    const url = process.env.DATABASE_URL?.trim();

    if (!url) {
      throw new Error("DATABASE_URL is required. Add Neon to this Vercel project first.");
    }

    database = (
      isLocalDatabaseUrl(url)
        ? drizzleNodePostgres({ client: new Pool({ connectionString: url }), schema })
        : drizzleNeonHttp({ client: neon(url), schema })
    ) as NeonHttpDatabase<typeof schema>;
  }

  return database;
}

export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export async function isDatabaseSchemaReady() {
  const url = process.env.DATABASE_URL?.trim();

  if (!url) {
    return false;
  }

  const readinessQuery = `
      select
        to_regclass('public.account') is not null as account_ready,
        to_regclass('public.chat') is not null as chat_ready,
        to_regclass('public.chat_event') is not null as chat_event_ready,
        to_regclass('public.session') is not null as session_ready,
        to_regclass('public."user"') is not null as user_ready,
        to_regclass('public.verification') is not null as verification_ready
  `;

  if (isLocalDatabaseUrl(url)) {
    const pool = new Pool({ connectionString: url });

    try {
      const result = await pool.query<{
        readonly account_ready: boolean;
        readonly chat_event_ready: boolean;
        readonly chat_ready: boolean;
        readonly session_ready: boolean;
        readonly user_ready: boolean;
        readonly verification_ready: boolean;
      }>(readinessQuery);

      return Boolean(
        result.rows[0] &&
          result.rows[0].account_ready &&
          result.rows[0].chat_ready &&
          result.rows[0].chat_event_ready &&
          result.rows[0].session_ready &&
          result.rows[0].user_ready &&
          result.rows[0].verification_ready,
      );
    } catch {
      return false;
    } finally {
      await pool.end();
    }
  }

  try {
    const sql = neon(url);
    const rows = (await sql.query(readinessQuery)) as unknown as [
      {
        readonly account_ready: boolean;
        readonly chat_event_ready: boolean;
        readonly chat_ready: boolean;
        readonly session_ready: boolean;
        readonly user_ready: boolean;
        readonly verification_ready: boolean;
      },
    ];
    const result = rows[0];
    const ready = Boolean(
      result?.account_ready &&
        result.chat_ready &&
        result.chat_event_ready &&
        result.session_ready &&
        result.user_ready &&
        result.verification_ready,
    );

    return ready;
  } catch {
    return false;
  }
}
