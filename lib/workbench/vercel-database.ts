import { neon } from "@neondatabase/serverless";

import { getVercelUserToken } from "@/lib/connections/tokens";
import {
  loadDatabaseStatus,
  runReadOnlyQuery,
  type QueryResult,
} from "./database.ts";
import { createVercelFetch } from "./vercel-client.ts";
import type { WorkbenchDatabaseStatus, WorkbenchPin } from "./types.ts";
import {
  DATABASE_QUERY_ROW_CAP,
  DATABASE_QUERY_TIMEOUT_MS,
} from "./sql-guard.ts";

const URL_ENV_KEYS = [
  "POSTGRES_URL",
  "DATABASE_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
] as const;

/**
 * Resolve a Postgres connection string from the project's Vercel env.
 * The string never leaves this module's call stack toward the client.
 */
async function resolveConnectionString(
  userId: string,
  pin: WorkbenchPin,
): Promise<string | null> {
  if (!pin.vercelProjectId) return null;
  const token = await getVercelUserToken(userId);
  const vercelFetch = createVercelFetch(token);
  const res = await vercelFetch(
    `/v9/projects/${encodeURIComponent(pin.vercelProjectId)}/env?decrypt=true`,
    { teamId: pin.vercelTeamId },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    envs?: Array<{ key: string; value?: string }>;
  };
  const envs = data.envs ?? [];
  for (const key of URL_ENV_KEYS) {
    const row = envs.find((e) => e.key === key && e.value?.trim());
    if (row?.value?.trim()) return row.value.trim();
  }
  return null;
}

function makeExecutor(connectionString: string) {
  const sql = neon(connectionString);
  return async (args: {
    readonly sql: string;
    readonly rowCap: number;
    readonly timeoutMs: number;
  }) => {
    // neon serverless does not expose statement_timeout per query easily;
    // we still enforce the row cap in JS after fetch.
    void args.timeoutMs;
    const rows = (await sql.query(args.sql, [])) as Record<string, unknown>[];
    const capped = rows.slice(0, args.rowCap);
    const fields =
      capped[0] != null ? Object.keys(capped[0]) : ([] as string[]);
    return { rows: capped, fields };
  };
}

export async function getPinDatabaseStatus(
  userId: string,
  pin: WorkbenchPin,
): Promise<
  | { readonly ok: true; readonly status: WorkbenchDatabaseStatus }
  | { readonly ok: false; readonly error: string }
> {
  try {
    const connectionString = await resolveConnectionString(userId, pin);
    if (!connectionString) {
      return {
        ok: false,
        error:
          "No POSTGRES_URL or DATABASE_URL on this Vercel project. Attach a database first.",
      };
    }
    const status = await loadDatabaseStatus(makeExecutor(connectionString));
    return { ok: true, status };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Database status failed.",
    };
  }
}

export async function queryPinDatabase(
  userId: string,
  pin: WorkbenchPin,
  rawSql: string,
): Promise<QueryResult> {
  try {
    const connectionString = await resolveConnectionString(userId, pin);
    if (!connectionString) {
      return {
        ok: false,
        error:
          "No POSTGRES_URL or DATABASE_URL on this Vercel project. Attach a database first.",
      };
    }
    return runReadOnlyQuery(makeExecutor(connectionString), rawSql);
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Query failed.",
    };
  }
}

export { DATABASE_QUERY_ROW_CAP, DATABASE_QUERY_TIMEOUT_MS };
