import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export * from "./schema";
export { schema };

/**
 * Finance Postgres access. Connects as the `finance_app` role, which is subject to
 * row-level security on every `finance.*` table. RLS keys off the transaction-local
 * setting `app.user_id`, so EVERY query must run inside `withUserDb`.
 */

const globalForDb = globalThis as unknown as {
  __financeDb?: { pool: Pool; db: NodePgDatabase<typeof schema> };
};

function createClient() {
  const pool = new Pool({
    connectionString: process.env.FINANCE_DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
  });
  // An idle client dropping its socket must not crash the process.
  pool.on("error", (err) => {
    console.error("[db] idle pg client error:", err.message);
  });
  return { pool, db: drizzle(pool, { schema }) };
}

/** Lazy: nothing connects (or reads FINANCE_DATABASE_URL) until the first query. */
function client() {
  globalForDb.__financeDb ??= createClient();
  return globalForDb.__financeDb;
}

export function getPool(): Pool {
  return client().pool;
}

export const db: NodePgDatabase<typeof schema> = new Proxy(
  {} as NodePgDatabase<typeof schema>,
  {
    get(_target, prop) {
      const root = client().db;
      const value = Reflect.get(root, prop, root);
      return typeof value === "function" ? value.bind(root) : value;
    },
  },
);

export type Db = NodePgDatabase<typeof schema>;
export type DbTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

type DbContext = { tx: DbTx; userId: string; queue: Promise<unknown> };

const als = new AsyncLocalStorage<DbContext>();

/** Next.js redirect()/notFound() are thrown as errors; they must not roll back the work done so far. */
function isNextControlFlowError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }
  const digest = (error as { digest?: unknown }).digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") ||
      digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") ||
      digest === "NEXT_NOT_FOUND")
  );
}

/**
 * Run `fn` in a single transaction scoped to `userId` (sets `app.user_id` for RLS).
 * Re-entrant: nesting for the same user reuses the outer transaction.
 */
export async function withUserDb<T>(
  userId: string,
  fn: (tx: DbTx) => Promise<T>,
): Promise<T> {
  if (!userId) {
    throw new Error("withUserDb requires a userId");
  }

  const existing = als.getStore();
  if (existing) {
    if (existing.userId !== userId) {
      throw new Error("withUserDb nested with a different userId");
    }
    return fn(existing.tx);
  }

  if (!process.env.FINANCE_DATABASE_URL) {
    throw new Error("FINANCE_DATABASE_URL is not configured");
  }

  // redirect()/notFound() thrown from fn: commit first, then rethrow.
  let controlFlow: unknown;
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    try {
      return await als.run({ tx, userId, queue: Promise.resolve() }, () => fn(tx));
    } catch (error) {
      if (isNextControlFlowError(error)) {
        controlFlow = error;
        return undefined as T;
      }
      throw error;
    }
  });
  if (controlFlow !== undefined) throw controlFlow;
  return result;
}

/** The current withUserDb transaction. Throws when called outside one. */
export function getDb(): DbTx {
  const store = als.getStore();
  if (!store) throw new Error("getDb() called outside withUserDb");
  return store.tx;
}

/** The user id the current withUserDb transaction is scoped to. */
export function getUserId(): string {
  const store = als.getStore();
  if (!store) throw new Error("getUserId() called outside withUserDb");
  return store.userId;
}

/**
 * Run one DB operation at a time on the current transaction's connection.
 * Callers often `Promise.all` several queries; node-postgres only supports one in-flight
 * query per client (concurrent use is deprecated and removed in pg@9), so queue them.
 * Do not nest `serial` calls (the inner one would wait on the outer forever).
 */
export function serial<T>(run: () => PromiseLike<T>): Promise<T> {
  const store = als.getStore();
  if (!store) throw new Error("serial() called outside withUserDb");
  const next = store.queue.then(run);
  store.queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export function inUserDb(): boolean {
  return als.getStore() !== undefined;
}
