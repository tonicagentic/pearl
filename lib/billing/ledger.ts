import { and, eq, lt, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  getBillingAccess,
  getBillingAccount,
  getUserBillingFlags,
  resolvePeriod,
  sumReservedCents,
  sumSpentCents,
} from "@/lib/billing/accounts";
import {
  DEFAULT_TURN_RESERVATION_CENTS,
  sandboxCentsPerVcpuMinute,
  type BillingBlockReason,
} from "@/lib/billing/config";
import { ingestUsageEvents } from "@/lib/billing/metronome";
import { db } from "@/lib/db/client";
import {
  usageEvent,
  usageReservation,
  type UsageEventSource,
} from "@/lib/db/schema";

export type RecordUsageInput = {
  readonly idempotencyKey: string;
  readonly userId: string;
  readonly source: UsageEventSource;
  readonly costCents: number;
  readonly metadata?: Record<string, unknown>;
  /** Optional reservation to release after recording. */
  readonly reservationId?: string | null;
};

/**
 * Append one usage row. Idempotent on idempotencyKey. Free-pass users get
 * billable=false so Metronome never sees them. Best-effort ingest for
 * billable rows.
 */
export async function recordUsage(
  input: RecordUsageInput,
): Promise<{ readonly inserted: boolean; readonly id: string | null }> {
  const cents = Math.max(0, Math.round(input.costCents));
  if (cents === 0 && input.source !== "model") {
    // Still release any reservation.
    if (input.reservationId) {
      await releaseReservation(input.reservationId);
    }
    return { inserted: false, id: null };
  }

  const flags = await getUserBillingFlags(input.userId);
  if (!flags) {
    return { inserted: false, id: null };
  }

  const account = flags.exempt
    ? null
    : await getBillingAccount(input.userId);
  const period = resolvePeriod(account);
  const billable = !flags.exempt;

  const id = randomUUID();
  const inserted = await db
    .insert(usageEvent)
    .values({
      id,
      idempotencyKey: input.idempotencyKey,
      userId: input.userId,
      periodStart: period.start,
      source: input.source,
      costCents: cents,
      billable,
      metadata: input.metadata ?? {},
    })
    .onConflictDoNothing()
    .returning({ id: usageEvent.id });

  if (input.reservationId) {
    await releaseReservation(input.reservationId);
  }

  if (inserted.length === 0) {
    return { inserted: false, id: null };
  }

  if (billable && account?.metronomeCustomerId) {
    const ok = await ingestUsageEvents([
      {
        transaction_id: input.idempotencyKey,
        customer_id: account.metronomeCustomerId,
        event_type: "pearl_usage",
        timestamp: new Date().toISOString(),
        properties: {
          source: input.source,
          cost_cents: cents,
          ...(input.metadata ?? {}),
        },
      },
    ]);
    if (ok) {
      await db
        .update(usageEvent)
        .set({ ingestedAt: new Date() })
        .where(eq(usageEvent.id, inserted[0]!.id));
    }
  }

  return { inserted: true, id: inserted[0]!.id };
}

export async function reserveSpend(input: {
  readonly userId: string;
  readonly cents: number;
  readonly reason: string;
  readonly ttlMs?: number;
}): Promise<
  | { readonly ok: true; readonly reservationId: string }
  | { readonly ok: false; readonly reason: BillingBlockReason }
> {
  const access = await getBillingAccess(input.userId);
  if (!access.enabled || access.exempt) {
    // Billing off or free pass: no reservation needed.
    return { ok: true, reservationId: "noop" };
  }
  if (!access.allowed && access.reason) {
    return { ok: false, reason: access.reason };
  }
  if (!access.periodStart || access.usageCapCents === null) {
    return { ok: false, reason: "unpaid" };
  }

  const cents = Math.max(0, Math.round(input.cents));
  const spent = await sumSpentCents(input.userId, access.periodStart);
  const reserved = await sumReservedCents(input.userId, access.periodStart);
  if (spent + reserved + cents > access.usageCapCents) {
    return { ok: false, reason: "cap_reached" };
  }

  const id = randomUUID();
  const now = new Date();
  const ttlMs = input.ttlMs ?? 15 * 60 * 1000;
  await db.insert(usageReservation).values({
    id,
    userId: input.userId,
    periodStart: access.periodStart,
    cents,
    reason: input.reason,
    createdAt: now,
    expiresAt: new Date(now.getTime() + ttlMs),
  });

  return { ok: true, reservationId: id };
}

export async function releaseReservation(
  reservationId: string,
): Promise<void> {
  if (!reservationId || reservationId === "noop") {
    return;
  }
  await db
    .delete(usageReservation)
    .where(eq(usageReservation.id, reservationId));
}

/**
 * Atomically check access + reserve. Used by the turn gate and paid tools.
 */
export async function assertCanSpend(input: {
  readonly userId: string;
  readonly cents?: number;
  readonly reason: string;
}): Promise<
  | { readonly ok: true; readonly reservationId: string }
  | { readonly ok: false; readonly reason: BillingBlockReason }
> {
  const access = await getBillingAccess(input.userId);
  if (!access.enabled || access.exempt) {
    return { ok: true, reservationId: "noop" };
  }
  if (!access.allowed && access.reason) {
    return { ok: false, reason: access.reason };
  }
  return reserveSpend({
    userId: input.userId,
    cents: input.cents ?? DEFAULT_TURN_RESERVATION_CENTS,
    reason: input.reason,
  });
}

export function usdToCents(usd: number | null | undefined): number {
  if (typeof usd !== "number" || !Number.isFinite(usd) || usd < 0) {
    return 0;
  }
  return Math.round(usd * 100);
}

export function sandboxCostCents(input: {
  readonly vcpus: number;
  readonly durationMs: number;
}): number {
  const minutes = Math.max(0, input.durationMs) / 60_000;
  const raw = minutes * Math.max(1, input.vcpus) * sandboxCentsPerVcpuMinute();
  return Math.max(0, Math.ceil(raw));
}

export async function usageBreakdownBySource(
  userId: string,
  periodStart: Date,
): Promise<readonly { readonly source: string; readonly costCents: number }[]> {
  const rows = await db
    .select({
      source: usageEvent.source,
      costCents: sql<number>`coalesce(sum(${usageEvent.costCents}), 0)`,
    })
    .from(usageEvent)
    .where(
      and(
        eq(usageEvent.userId, userId),
        eq(usageEvent.periodStart, periodStart),
      ),
    )
    .groupBy(usageEvent.source);

  return rows.map((row) => ({
    source: row.source,
    costCents: Number(row.costCents),
  }));
}

/** Drop expired reservations (best-effort cleanup). */
export async function expireStaleReservations(): Promise<number> {
  const now = new Date();
  const deleted = await db
    .delete(usageReservation)
    .where(lt(usageReservation.expiresAt, now))
    .returning({ id: usageReservation.id });
  return deleted.length;
}
