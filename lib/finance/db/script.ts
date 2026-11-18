import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getPool, withUserDb } from "./index";

/** Load .env.local / .env into process.env without overriding existing values. */
export function loadEnvFiles() {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(process.cwd(), file);
    if (!existsSync(full)) continue;
    for (const line of readFileSync(full, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq);
      let val = trimmed.slice(eq + 1);
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

/**
 * Run a CLI script (seed, backfills, imports) as the finance owner.
 * Requires FINANCE_USER_ID (the Pearl user id that owns the rows) and a DATABASE_URL
 * for the RLS-restricted `finance_app` role — never point this at production by accident.
 */
export async function runAsFinanceUser<T>(fn: () => Promise<T>): Promise<T> {
  loadEnvFiles();
  const userId = process.env.FINANCE_USER_ID?.trim();
  if (!userId) {
    throw new Error("FINANCE_USER_ID is required (the Pearl user id that owns the finance data)");
  }
  try {
    return await withUserDb(userId, fn);
  } finally {
    await getPool().end();
  }
}
