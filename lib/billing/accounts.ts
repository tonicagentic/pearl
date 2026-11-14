import { and, eq, gt, isNull, sql } from "drizzle-orm";

import {
  DEFAULT_USAGE_CAP_CENTS,
  getTrialCapCents,
  isBillingExplicitlyOff,
  isBillingProvidersConfigured,
  isEmailOnTrialAllowlist,
  type BillingBlockReason,
} from "@/lib/billing/config";
import { db } from "@/lib/db/client";
import {
  billingAccount,
  usageEvent,
  usageReservation,
  user,
} from "@/lib/db/schema";
import { getSetupStatus } from "@/lib/setup";

export type BillingAccess = {
  readonly enabled: boolean;
  readonly exempt: boolean;
  /** Allowlisted friend-beta trial (no Stripe, soft monthly cap). */
  readonly trial: boolean;
  readonly allowed: boolean;
  readonly reason: BillingBlockReason | null;
  readonly status: string | null;
  readonly usageCapCents: number | null;
  readonly periodStart: Date | null;
  readonly periodEnd: Date | null;
  readonly stripeCustomerId: string | null;
  readonly metronomeCustomerId: string | null;
  readonly spentCents: number;
  readonly reservedCents: number;
};

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/**
 * Billing applies only in production (database) mode, and never when the
 * operator set PEARL_BILLING=off.
 */
export async function isBillingActive(): Promise<boolean> {
  if (isBillingExplicitlyOff()) {
    return false;
  }
  const setup = await getSetupStatus();
  return setup.storageMode === "database" && setup.appReady;
}

export async function getUserBillingFlags(userId: string): Promise<{
  readonly exempt: boolean;
  readonly email: string;
  readonly name: string;
} | null> {
  const [row] = await db
    .select({
      billingExempt: user.billingExempt,
      email: user.email,
      name: user.name,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    exempt: row.billingExempt,
    email: row.email,
    name: row.name,
  };
}

export async function getBillingAccount(userId: string) {
  const [row] = await db
    .select()
    .from(billingAccount)
    .where(eq(billingAccount.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function upsertBillingAccount(input: {
  readonly userId: string;
  readonly stripeCustomerId: string;
  readonly stripeSubscriptionId?: string | null;
  readonly status: string;
  readonly periodStart?: Date | null;
  readonly periodEnd?: Date | null;
  readonly metronomeCustomerId?: string | null;
  readonly usageCapCents?: number;
}): Promise<void> {
  const now = new Date();
  await db
    .insert(billingAccount)
    .values({
      userId: input.userId,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      status: input.status,
      periodStart: input.periodStart ?? null,
      periodEnd: input.periodEnd ?? null,
      metronomeCustomerId: input.metronomeCustomerId ?? null,
      usageCapCents: input.usageCapCents ?? DEFAULT_USAGE_CAP_CENTS,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: billingAccount.userId,
      set: {
        stripeCustomerId: input.stripeCustomerId,
        ...(input.stripeSubscriptionId !== undefined
          ? { stripeSubscriptionId: input.stripeSubscriptionId }
          : {}),
        status: input.status,
        ...(input.periodStart !== undefined
          ? { periodStart: input.periodStart }
          : {}),
        ...(input.periodEnd !== undefined
          ? { periodEnd: input.periodEnd }
          : {}),
        ...(input.metronomeCustomerId !== undefined
          ? { metronomeCustomerId: input.metronomeCustomerId }
          : {}),
        ...(input.usageCapCents !== undefined
          ? { usageCapCents: input.usageCapCents }
          : {}),
        updatedAt: now,
      },
    });
}

export async function setUsageCapCents(
  userId: string,
  usageCapCents: number,
): Promise<void> {
  if (!Number.isFinite(usageCapCents) || usageCapCents < 0) {
    throw new Error("Usage cap must be a non-negative number of cents.");
  }

  await db
    .update(billingAccount)
    .set({ usageCapCents: Math.floor(usageCapCents), updatedAt: new Date() })
    .where(eq(billingAccount.userId, userId));
}

export async function sumSpentCents(
  userId: string,
  periodStart: Date,
): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${usageEvent.costCents}), 0)`,
    })
    .from(usageEvent)
    .where(
      and(
        eq(usageEvent.userId, userId),
        eq(usageEvent.periodStart, periodStart),
      ),
    );

  return Number(row?.total ?? 0);
}

export async function sumReservedCents(
  userId: string,
  periodStart: Date,
): Promise<number> {
  const now = new Date();
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${usageReservation.cents}), 0)`,
    })
    .from(usageReservation)
    .where(
      and(
        eq(usageReservation.userId, userId),
        eq(usageReservation.periodStart, periodStart),
        gt(usageReservation.expiresAt, now),
      ),
    );

  return Number(row?.total ?? 0);
}

function calendarMonthPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
  return { start, end };
}

/**
 * Resolve the billing period for a user. Paying users use the Stripe
 * subscription period; free-pass / ledger-only use the UTC calendar month.
 */
export function resolvePeriod(account: {
  readonly periodStart: Date | null;
  readonly periodEnd: Date | null;
} | null): { start: Date; end: Date } {
  if (account?.periodStart && account.periodEnd) {
    return { start: account.periodStart, end: account.periodEnd };
  }
  return calendarMonthPeriod();
}

function emptyAccess(
  partial: Partial<BillingAccess> &
    Pick<BillingAccess, "enabled" | "allowed">,
): BillingAccess {
  return {
    exempt: false,
    trial: false,
    reason: null,
    status: null,
    usageCapCents: null,
    periodStart: null,
    periodEnd: null,
    stripeCustomerId: null,
    metronomeCustomerId: null,
    spentCents: 0,
    reservedCents: 0,
    ...partial,
  };
}

export async function getBillingAccess(
  userId: string,
): Promise<BillingAccess> {
  const enabled = await isBillingActive();
  if (!enabled) {
    return emptyAccess({ enabled: false, allowed: true });
  }

  const flags = await getUserBillingFlags(userId);
  if (!flags) {
    return emptyAccess({
      enabled: true,
      allowed: false,
      reason: "unpaid",
    });
  }

  if (flags.exempt) {
    const period = calendarMonthPeriod();
    const spentCents = await sumSpentCents(userId, period.start);
    return emptyAccess({
      enabled: true,
      exempt: true,
      allowed: true,
      status: "exempt",
      periodStart: period.start,
      periodEnd: period.end,
      spentCents,
    });
  }

  const account = await getBillingAccount(userId);
  const paying = Boolean(account && ACTIVE_STATUSES.has(account.status));

  // Friend-beta trial: allowlisted, no active subscription, soft monthly cap.
  // Stripe is not required for this path.
  if (!paying && isEmailOnTrialAllowlist(flags.email)) {
    const period = calendarMonthPeriod();
    const spentCents = await sumSpentCents(userId, period.start);
    const reservedCents = await sumReservedCents(userId, period.start);
    const usageCapCents = getTrialCapCents();
    if (spentCents + reservedCents >= usageCapCents) {
      return emptyAccess({
        enabled: true,
        trial: true,
        allowed: false,
        reason: "trial_cap_reached",
        status: "trial",
        usageCapCents,
        periodStart: period.start,
        periodEnd: period.end,
        spentCents,
        reservedCents,
      });
    }
    return emptyAccess({
      enabled: true,
      trial: true,
      allowed: true,
      status: "trial",
      usageCapCents,
      periodStart: period.start,
      periodEnd: period.end,
      spentCents,
      reservedCents,
    });
  }

  if (!isBillingProvidersConfigured()) {
    return emptyAccess({
      enabled: true,
      allowed: false,
      reason: "billing_misconfigured",
    });
  }

  const period = resolvePeriod(account);
  const spentCents = account
    ? await sumSpentCents(userId, period.start)
    : 0;
  const reservedCents = account
    ? await sumReservedCents(userId, period.start)
    : 0;

  if (!account || !paying) {
    const reason: BillingBlockReason =
      account?.status === "past_due" || account?.status === "unpaid"
        ? "payment_failed"
        : "unpaid";
    return emptyAccess({
      enabled: true,
      allowed: false,
      reason,
      status: account?.status ?? null,
      usageCapCents: account?.usageCapCents ?? DEFAULT_USAGE_CAP_CENTS,
      periodStart: period.start,
      periodEnd: period.end,
      stripeCustomerId: account?.stripeCustomerId ?? null,
      metronomeCustomerId: account?.metronomeCustomerId ?? null,
      spentCents,
      reservedCents,
    });
  }

  if (spentCents + reservedCents >= account!.usageCapCents) {
    return emptyAccess({
      enabled: true,
      allowed: false,
      reason: "cap_reached",
      status: account!.status,
      usageCapCents: account!.usageCapCents,
      periodStart: period.start,
      periodEnd: period.end,
      stripeCustomerId: account!.stripeCustomerId,
      metronomeCustomerId: account!.metronomeCustomerId,
      spentCents,
      reservedCents,
    });
  }

  return emptyAccess({
    enabled: true,
    allowed: true,
    status: account!.status,
    usageCapCents: account!.usageCapCents,
    periodStart: period.start,
    periodEnd: period.end,
    stripeCustomerId: account!.stripeCustomerId,
    metronomeCustomerId: account!.metronomeCustomerId,
    spentCents,
    reservedCents,
  });
}

export async function findBillingAccountByStripeCustomer(
  stripeCustomerId: string,
) {
  const [row] = await db
    .select()
    .from(billingAccount)
    .where(eq(billingAccount.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return row ?? null;
}

export async function findBillingAccountBySubscription(
  stripeSubscriptionId: string,
) {
  const [row] = await db
    .select()
    .from(billingAccount)
    .where(eq(billingAccount.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return row ?? null;
}

export async function listPendingIngestEvents(limit = 100) {
  return db
    .select()
    .from(usageEvent)
    .where(
      and(eq(usageEvent.billable, true), isNull(usageEvent.ingestedAt)),
    )
    .limit(limit);
}

export async function markUsageEventsIngested(
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const now = new Date();
  for (const id of ids) {
    await db
      .update(usageEvent)
      .set({ ingestedAt: now })
      .where(eq(usageEvent.id, id));
  }
}
