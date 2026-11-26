import { eq, lt } from "drizzle-orm";

import { recordUsage, sandboxCostCents } from "@/lib/billing/ledger";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { sandboxOpen } from "@/lib/db/schema";

/** Close and bill sandboxes whose stop hook never fired. */
const SANDBOX_OPEN_MAX_AGE_MS = 6 * 60 * 60 * 1000;

type OpenEntry = {
  readonly userId: string;
  readonly openedAt: number;
  readonly vcpus: number;
  readonly label: string;
};

/** Process-local cache; durable rows live in `sandbox_open`. */
const openByKey = new Map<string, OpenEntry>();

function keyFor(sandboxId: string): string {
  return sandboxId;
}

/**
 * Call when a billable sandbox becomes active. Idempotent per sandboxId.
 * Dual-writes memory + Postgres so stop works across instances.
 */
export function noteSandboxOpened(input: {
  readonly sandboxId: string;
  readonly userId: string;
  readonly vcpus?: number;
  readonly label?: string;
}): void {
  if (!input.sandboxId || !input.userId) {
    return;
  }
  const key = keyFor(input.sandboxId);
  if (openByKey.has(key)) {
    return;
  }
  const entry: OpenEntry = {
    userId: input.userId,
    openedAt: Date.now(),
    vcpus: input.vcpus ?? 2,
    label: input.label ?? "sandbox",
  };
  openByKey.set(key, entry);

  void persistOpen(key, entry).catch((error) => {
    console.error("[billing/sandbox-meter] persist open", error);
  });
}

async function persistOpen(sandboxId: string, entry: OpenEntry): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await db
    .insert(sandboxOpen)
    .values({
      sandboxId,
      userId: entry.userId,
      openedAt: new Date(entry.openedAt),
      vcpus: entry.vcpus,
      label: entry.label,
    })
    .onConflictDoNothing();
}

/**
 * Call when a sandbox stops. Records duration-based cost once.
 */
export async function noteSandboxStopped(input: {
  readonly sandboxId: string;
}): Promise<void> {
  const key = keyFor(input.sandboxId);
  let entry = openByKey.get(key) ?? null;
  openByKey.delete(key);

  if (!entry) {
    entry = await loadPersistedOpen(key);
  } else {
    await deletePersistedOpen(key);
  }

  if (!entry) {
    return;
  }

  const durationMs = Math.max(0, Date.now() - entry.openedAt);
  const costCents = sandboxCostCents({
    vcpus: entry.vcpus,
    durationMs,
  });

  if (costCents <= 0) {
    return;
  }

  try {
    await recordUsage({
      idempotencyKey: `sandbox:${input.sandboxId}:stop:${entry.openedAt}`,
      userId: entry.userId,
      source: "sandbox",
      costCents,
      metadata: {
        sandboxId: input.sandboxId,
        vcpus: entry.vcpus,
        durationMs,
        label: entry.label,
      },
    });
  } catch (error) {
    console.error("[billing/sandbox-meter] record", error);
  }
}

async function loadPersistedOpen(sandboxId: string): Promise<OpenEntry | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const rows = await db
      .select()
      .from(sandboxOpen)
      .where(eq(sandboxOpen.sandboxId, sandboxId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    await db.delete(sandboxOpen).where(eq(sandboxOpen.sandboxId, sandboxId));
    return {
      userId: row.userId,
      openedAt: row.openedAt.getTime(),
      vcpus: row.vcpus,
      label: row.label,
    };
  } catch (error) {
    console.error("[billing/sandbox-meter] load open", error);
    return null;
  }
}

async function deletePersistedOpen(sandboxId: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await db.delete(sandboxOpen).where(eq(sandboxOpen.sandboxId, sandboxId));
  } catch (error) {
    console.error("[billing/sandbox-meter] delete open", error);
  }
}

/**
 * Bill and clear `sandbox_open` rows older than maxAgeMs (default 6h).
 * Covers stop hooks that never ran across instances / crashes.
 */
export async function reconcileAgedOpenSandboxes(
  maxAgeMs: number = SANDBOX_OPEN_MAX_AGE_MS,
): Promise<{ readonly closed: number }> {
  if (!isDatabaseConfigured()) return { closed: 0 };

  const cutoff = new Date(Date.now() - maxAgeMs);
  const aged = await db
    .select({ sandboxId: sandboxOpen.sandboxId })
    .from(sandboxOpen)
    .where(lt(sandboxOpen.openedAt, cutoff));

  let closed = 0;
  for (const row of aged) {
    try {
      await noteSandboxStopped({ sandboxId: row.sandboxId });
      closed += 1;
    } catch (error) {
      console.error(
        "[billing/sandbox-meter] reconcile aged",
        row.sandboxId,
        error,
      );
    }
  }
  return { closed };
}
