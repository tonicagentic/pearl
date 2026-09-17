import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
// Relative imports: the unit tier runs this module with plain `node --test`,
// which resolves neither the app's path aliases nor bare ESM specifier maps.
import { db } from "../db/client.ts";
import { agentToolExecution } from "../db/schema.ts";

// Durable idempotency ledger for destructive tools. Backed by Postgres (the
// same store the app already owns) so unit tests can exercise it against the
// real database rather than a mock.
//
// The contract a destructive tool must follow:
//   1. compute the execution key from the operation's identity
//   2. `beginExecution` — a `pending` row is the half-done marker
//   3. perform the side effect
//   4. `completeExecution` or `failExecution`
// A replayed key short-circuits before the side effect re-fires; a `pending`
// row from a crash is surfaced as "incomplete", never silently re-run.

export function executionKey(toolName: string, operation: string): string {
  return createHash("sha256").update(`${toolName}\u0000${operation}`).digest("hex");
}

export type LedgerStatus = "pending" | "succeeded" | "failed";

export async function getExecution(
  key: string,
): Promise<{ status: LedgerStatus; detail: string | null } | null> {
  const [row] = await db
    .select({
      status: agentToolExecution.status,
      detail: agentToolExecution.detail,
    })
    .from(agentToolExecution)
    .where(eq(agentToolExecution.executionKey, key))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    status: row.status as LedgerStatus,
    detail: row.detail,
  };
}

/** Claims the key. Returns the prior state when the key is already claimed. */
export async function beginExecution(
  toolName: string,
  key: string,
): Promise<{ prior: null | { status: LedgerStatus; detail: string | null } }> {
  const inserted = await db
    .insert(agentToolExecution)
    .values({ executionKey: key, toolName, status: "pending" })
    .onConflictDoNothing()
    .returning({ executionKey: agentToolExecution.executionKey });

  if (inserted.length > 0) {
    return { prior: null };
  }

  const prior = await getExecution(key);

  return {
    prior:
      prior === null
        ? null
        : { status: prior.status as LedgerStatus, detail: prior.detail },
  };
}

export async function completeExecution(
  key: string,
  detail: string,
): Promise<void> {
  await db
    .update(agentToolExecution)
    .set({ status: "succeeded", detail, updatedAt: new Date() })
    .where(and(eq(agentToolExecution.executionKey, key), eq(agentToolExecution.status, "pending")));
}

export async function failExecution(
  key: string,
  detail: string,
): Promise<void> {
  await db
    .update(agentToolExecution)
    .set({ status: "failed", detail, updatedAt: new Date() })
    .where(eq(agentToolExecution.executionKey, key));
}
