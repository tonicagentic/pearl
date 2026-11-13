/**
 * Guard read-only SQL for the workbench database panel.
 * One SELECT (or WITH … SELECT) only; no writes, DDL, or multi-statement.
 */

export type SqlGuardResult =
  | { readonly ok: true; readonly sql: string }
  | { readonly ok: false; readonly error: string };

const MAX_SQL_CHARS = 4_000;

export function assertReadOnlySelect(raw: string): SqlGuardResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "SQL is empty." };
  }
  if (trimmed.length > MAX_SQL_CHARS) {
    return {
      ok: false,
      error: `SQL must be ${MAX_SQL_CHARS} characters or fewer.`,
    };
  }

  // Strip a single trailing semicolon for convenience.
  const withoutTrailing = trimmed.replace(/;+\s*$/, "");
  if (withoutTrailing.includes(";")) {
    return {
      ok: false,
      error: "Only one statement is allowed.",
    };
  }

  const normalized = withoutTrailing.replace(/\s+/g, " ").trim();
  const upper = normalized.toUpperCase();

  const startsOk = upper.startsWith("SELECT ") || upper.startsWith("WITH ");
  if (!startsOk) {
    return {
      ok: false,
      error: "Only SELECT (or WITH … SELECT) queries are allowed.",
    };
  }

  // Reject obvious write / DDL keywords even inside CTEs.
  const banned =
    /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY|CALL|EXECUTE|DO)\b/i;
  if (banned.test(normalized)) {
    return {
      ok: false,
      error: "Write and schema-change statements are not allowed.",
    };
  }

  return { ok: true, sql: withoutTrailing };
}

export const DATABASE_QUERY_ROW_CAP = 100;
export const DATABASE_QUERY_TIMEOUT_MS = 5_000;
