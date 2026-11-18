import { and, eq, gte, lt, sql } from "drizzle-orm";
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
import {
  MICROS_PER_CENT,
  microsToRoundedCents,
  microsToUsd,
  usdToMicros,
} from "@/lib/billing/provider-pricing";
import { db } from "@/lib/db/client";
import {
  usageEvent,
  usageReservation,
  type UsageEventSource,
} from "@/lib/db/schema";

const ACTIVE_BILLING_STATUSES = new Set(["active", "trialing"]);

export type RecordUsageInput = {
  readonly idempotencyKey: string;
  readonly userId: string;
  readonly source: UsageEventSource;
  /**
   * Exact spend. Prefer `costUsd` / `costMicros`. `costCents` remains for
   * legacy callers and is converted to micros (×10_000).
   */
  readonly costUsd?: number;
  readonly costMicros?: number;
  readonly costCents?: number;
  readonly metadata?: Record<string, unknown>;
  /** Optional reservation to release after recording. */
  readonly reservationId?: string | null;
};

function resolveCostMicros(input: RecordUsageInput): number {
  if (
    typeof input.costMicros === "number" &&
    Number.isFinite(input.costMicros) &&
    input.costMicros >= 0
  ) {
    return Math.round(input.costMicros);
  }
  if (
    typeof input.costUsd === "number" &&
    Number.isFinite(input.costUsd) &&
    input.costUsd >= 0
  ) {
    return usdToMicros(input.costUsd);
  }
  if (
    typeof input.costCents === "number" &&
    Number.isFinite(input.costCents) &&
    input.costCents >= 0
  ) {
    return Math.round(input.costCents * MICROS_PER_CENT);
  }
  return 0;
}

/**
 * Append one usage row. Idempotent on idempotencyKey. Free-pass and
 * friend-beta trial users get billable=false so Metronome never sees them.
 * Best-effort ingest for billable (subscribed) rows.
 *
 * Exact spend is stored in `costMicros`; `costCents` is a rounded mirror for
 * Metronome / legacy caps.
 */
export async function recordUsage(
  input: RecordUsageInput,
): Promise<{ readonly inserted: boolean; readonly id: string | null }> {
  const micros = Math.max(0, resolveCostMicros(input));
  const cents = microsToRoundedCents(micros);
  if (micros === 0 && input.source !== "model") {
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
  const paying = Boolean(
    account && ACTIVE_BILLING_STATUSES.has(account.status),
  );
  // Trial / exempt: calendar month. Paying: Stripe period.
  const period = paying ? resolvePeriod(account) : resolvePeriod(null);
  // Only subscribed accounts are invoiced. Free-pass and trial stay local.
  const billable = paying && !flags.exempt;

  const id = randomUUID();
  const inserted = await db
    .insert(usageEvent)
    .values({
      id,
      idempotencyKey: input.idempotencyKey,
      userId: input.userId,
      periodStart: period.start,
      source: input.source,
      costMicros: micros,
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
          cost_micros: micros,
          cost_usd: microsToUsd(micros),
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
  // Guests within the free-message allowance have no spend period yet.
  if (access.guest) {
    return { ok: true, reservationId: "noop" };
  }
  if (!access.periodStart || access.usageCapCents === null) {
    return { ok: false, reason: "unpaid" };
  }
  // Trial users share the reservation path with paying users so concurrent
  // chats cannot both clear a near-cap check.

  const cents = Math.max(0, Math.round(input.cents));
  const spent = await sumSpentCents(input.userId, access.periodStart);
  const reserved = await sumReservedCents(input.userId, access.periodStart);
  if (spent + reserved + cents > access.usageCapCents) {
    return {
      ok: false,
      reason: access.trial ? "trial_cap_reached" : "cap_reached",
    };
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

export type UsagePeriodBreakdown = {
  readonly periodStart: Date;
  readonly totalCents: number;
  readonly bySource: readonly {
    readonly source: string;
    readonly costCents: number;
  }[];
};

/**
 * All recorded spend for a user, grouped by billing period and source.
 * Periods are newest-first; sources within a period are sorted by spend.
 */
export async function usageByPeriod(
  userId: string,
): Promise<{
  readonly totalCents: number;
  readonly periods: readonly UsagePeriodBreakdown[];
}> {
  const rows = await db
    .select({
      periodStart: usageEvent.periodStart,
      source: usageEvent.source,
      costCents: sql<number>`coalesce(sum(${usageEvent.costCents}), 0)`,
    })
    .from(usageEvent)
    .where(eq(usageEvent.userId, userId))
    .groupBy(usageEvent.periodStart, usageEvent.source);

  const byPeriod = new Map<
    number,
    {
      periodStart: Date;
      totalCents: number;
      bySource: { source: string; costCents: number }[];
    }
  >();

  for (const row of rows) {
    const key = row.periodStart.getTime();
    const costCents = Number(row.costCents);
    const existing = byPeriod.get(key);
    if (existing) {
      existing.totalCents += costCents;
      existing.bySource.push({ source: row.source, costCents });
    } else {
      byPeriod.set(key, {
        periodStart: row.periodStart,
        totalCents: costCents,
        bySource: [{ source: row.source, costCents }],
      });
    }
  }

  const periods = [...byPeriod.values()]
    .map((period) => ({
      periodStart: period.periodStart,
      totalCents: period.totalCents,
      bySource: [...period.bySource].sort(
        (a, b) => b.costCents - a.costCents || a.source.localeCompare(b.source),
      ),
    }))
    .sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime());

  return {
    totalCents: periods.reduce((sum, period) => sum + period.totalCents, 0),
    periods,
  };
}

export type UsageSourceSubgroup = {
  readonly label: string;
  readonly eventCount: number;
  readonly costMicros: number;
  readonly costUsd: number;
  /** Rounded mirror for older clients. */
  readonly costCents: number;
  /** Present when every event in the subgroup shares one rate (micros). */
  readonly unitMicros: number | null;
  readonly unitUsd: number | null;
};

export type UsageSourceDetail = {
  readonly source: string;
  readonly costMicros: number;
  readonly costUsd: number;
  readonly costCents: number;
  readonly eventCount: number;
  readonly unitMicros: number | null;
  readonly unitUsd: number | null;
  /** Image generations grouped by model id, when available. */
  readonly subgroups: readonly UsageSourceSubgroup[];
};

/**
 * Ledger spend in a created_at window (inclusive from, exclusive to),
 * rolled up by source. Used when the Usage screen filters by date range.
 */
export async function usageBySourceInRange(
  userId: string,
  range?: { readonly from?: Date | null; readonly to?: Date | null },
): Promise<{
  readonly totalCents: number;
  readonly totalUsd: number;
  readonly bySource: readonly {
    readonly source: string;
    readonly costCents: number;
    readonly costUsd: number;
  }[];
}> {
  const detail = await usageSourceDetailsInRange(userId, range);
  return {
    totalCents: detail.totalCents,
    totalUsd: detail.totalUsd,
    bySource: detail.bySource.map((row) => ({
      source: row.source,
      costCents: row.costCents,
      costUsd: row.costUsd,
    })),
  };
}

/**
 * Ledger spend with per-source event counts and image-model subgroups so the
 * Usage UI can show "$0.007 each" / "3 × grok-imagine" style clarity.
 * Totals sum exact microdollars; cents are derived only for display mirrors.
 */
export async function usageSourceDetailsInRange(
  userId: string,
  range?: { readonly from?: Date | null; readonly to?: Date | null },
): Promise<{
  readonly totalMicros: number;
  readonly totalUsd: number;
  readonly totalCents: number;
  readonly bySource: readonly UsageSourceDetail[];
}> {
  const window = [
    range?.from ? gte(usageEvent.createdAt, range.from) : undefined,
    range?.to ? lt(usageEvent.createdAt, range.to) : undefined,
  ].filter((clause): clause is NonNullable<typeof clause> => clause != null);

  // Prefer cost_micros; fall back to cost_cents×10k for rows written before
  // the micros column existed / was backfilled.
  const rowMicros = sql`case
    when ${usageEvent.costMicros} > 0 then ${usageEvent.costMicros}
    else ${usageEvent.costCents} * ${MICROS_PER_CENT}
  end`;
  const costMicrosExpr = sql<number>`coalesce(sum(${rowMicros}), 0)`;
  const distinctMicrosExpr = sql<number>`count(distinct ${rowMicros})::int`;
  const minMicrosExpr = sql<number>`min(${rowMicros})`;

  const [sourceRows, imageRows] = await Promise.all([
    db
      .select({
        source: usageEvent.source,
        costMicros: costMicrosExpr,
        eventCount: sql<number>`count(*)::int`,
        distinctCosts: distinctMicrosExpr,
        minCost: minMicrosExpr,
      })
      .from(usageEvent)
      .where(and(eq(usageEvent.userId, userId), ...window))
      .groupBy(usageEvent.source),
    db
      .select({
        model: sql<string | null>`${usageEvent.metadata} ->> 'model'`,
        costMicros: costMicrosExpr,
        eventCount: sql<number>`count(*)::int`,
        distinctCosts: distinctMicrosExpr,
        minCost: minMicrosExpr,
      })
      .from(usageEvent)
      .where(
        and(
          eq(usageEvent.userId, userId),
          eq(usageEvent.source, "image"),
          ...window,
        ),
      )
      .groupBy(sql`${usageEvent.metadata} ->> 'model'`),
  ]);

  const imageSubgroups: UsageSourceSubgroup[] = imageRows
    .map((row) => {
      const eventCount = Number(row.eventCount);
      const costMicros = Number(row.costMicros);
      const distinctCosts = Number(row.distinctCosts);
      const minCost = Number(row.minCost);
      const unitMicros =
        eventCount > 0 && distinctCosts === 1 && Number.isFinite(minCost)
          ? minCost
          : null;
      return {
        label: row.model?.trim() || "Unknown model",
        eventCount,
        costMicros,
        costUsd: microsToUsd(costMicros),
        costCents: microsToRoundedCents(costMicros),
        unitMicros,
        unitUsd: unitMicros == null ? null : microsToUsd(unitMicros),
      };
    })
    .sort(
      (a, b) =>
        b.costMicros - a.costMicros || a.label.localeCompare(b.label),
    );

  const bySource: UsageSourceDetail[] = sourceRows
    .map((row) => {
      const eventCount = Number(row.eventCount);
      const costMicros = Number(row.costMicros);
      const distinctCosts = Number(row.distinctCosts);
      const minCost = Number(row.minCost);
      const unitMicros =
        eventCount > 0 && distinctCosts === 1 && Number.isFinite(minCost)
          ? minCost
          : null;
      return {
        source: row.source,
        costMicros,
        costUsd: microsToUsd(costMicros),
        costCents: microsToRoundedCents(costMicros),
        eventCount,
        unitMicros,
        unitUsd: unitMicros == null ? null : microsToUsd(unitMicros),
        subgroups: row.source === "image" ? imageSubgroups : [],
      };
    })
    .sort(
      (a, b) => b.costMicros - a.costMicros || a.source.localeCompare(b.source),
    );

  const totalMicros = bySource.reduce((sum, row) => sum + row.costMicros, 0);
  return {
    totalMicros,
    totalUsd: microsToUsd(totalMicros),
    totalCents: microsToRoundedCents(totalMicros),
    bySource,
  };
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
