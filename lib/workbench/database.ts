import {
  assertReadOnlySelect,
  DATABASE_QUERY_ROW_CAP,
  DATABASE_QUERY_TIMEOUT_MS,
} from "./sql-guard.ts";
import type { WorkbenchDatabaseStatus, WorkbenchDatabaseTable } from "./types.ts";

export type SqlExecutor = (args: {
  readonly sql: string;
  readonly rowCap: number;
  readonly timeoutMs: number;
}) => Promise<{
  readonly rows: readonly Record<string, unknown>[];
  readonly fields: readonly string[];
}>;

/**
 * Introspect public tables. Never returns connection strings.
 */
export async function loadDatabaseStatus(
  execute: SqlExecutor,
): Promise<WorkbenchDatabaseStatus> {
  const tablesResult = await execute({
    sql: `
      SELECT
        n.nspname AS schema,
        c.relname AS name,
        COALESCE(s.n_live_tup, c.reltuples)::bigint AS approximate_rows
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
      WHERE c.relkind = 'r'
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY n.nspname, c.relname
      LIMIT 200
    `,
    rowCap: 200,
    timeoutMs: DATABASE_QUERY_TIMEOUT_MS,
  });

  const tables: WorkbenchDatabaseTable[] = tablesResult.rows.map((row) => ({
    schema: String(row.schema ?? "public"),
    name: String(row.name ?? ""),
    approximateRows:
      row.approximate_rows == null
        ? null
        : Number(row.approximate_rows),
  }));

  return {
    branch: null,
    computeStatus: "available",
    storageBytes: null,
    tables,
  };
}

export type QueryResult =
  | {
      readonly ok: true;
      readonly fields: readonly string[];
      readonly rows: readonly Record<string, unknown>[];
      readonly truncated: boolean;
    }
  | { readonly ok: false; readonly error: string };

/**
 * Run a single read-only SELECT with a row cap. Connection string stays with
 * the executor — never included in the result.
 */
export async function runReadOnlyQuery(
  execute: SqlExecutor,
  rawSql: string,
): Promise<QueryResult> {
  const guard = assertReadOnlySelect(rawSql);
  if (!guard.ok) {
    return { ok: false, error: guard.error };
  }

  try {
    const result = await execute({
      sql: guard.sql,
      rowCap: DATABASE_QUERY_ROW_CAP,
      timeoutMs: DATABASE_QUERY_TIMEOUT_MS,
    });
    const rows = result.rows.slice(0, DATABASE_QUERY_ROW_CAP);
    return {
      ok: true,
      fields: result.fields,
      rows,
      truncated: result.rows.length > DATABASE_QUERY_ROW_CAP,
    };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Query failed.",
    };
  }
}

/** Strip any accidental connection-string-looking fields from a DTO. */
export function sanitizeDatabasePayload<T extends Record<string, unknown>>(
  payload: T,
): T {
  const blocked = new Set([
    "connectionstring",
    "connection_string",
    "databaseurl",
    "database_url",
    "password",
    "secret",
    "token",
    "value",
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (blocked.has(key.toLowerCase())) continue;
    out[key] = value;
  }
  return out as T;
}
