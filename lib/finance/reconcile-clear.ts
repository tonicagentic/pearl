import { prisma } from "@/lib/finance/prisma";
import { isInboxCategory } from "@/lib/finance/transaction-status";

export const AUTO_CLEAR_SETTLE_DAYS = 2;
export const AUTO_CLEAR_CONFIDENCE = 0.85;

export type AutoClearEligibilityInput = {
  pending: boolean;
  reconciledAt: Date | null;
  categoryId: string | null;
  categorySlug: string | null;
  uncategorizedId: string | null;
  type: string;
  plaidTxnId: string | null;
  /** Transaction posted date */
  date: Date;
  /** Evaluation time (defaults to now) */
  now?: Date;
  settleDays?: number;
};

function calendarDay(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

/** True when txn date is on or before today − settleDays (calendar). */
export function isSettledForAutoClear(
  date: Date,
  now: Date = new Date(),
  settleDays: number = AUTO_CLEAR_SETTLE_DAYS,
): boolean {
  const cutoff = new Date(now);
  cutoff.setHours(12, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - settleDays);
  return calendarDay(date) <= calendarDay(cutoff);
}

export function hasAutoClearTrustSignal(input: {
  type: string;
  categorySlug: string | null;
  plaidTxnId: string | null;
  date: Date;
  now?: Date;
  settleDays?: number;
}): boolean {
  if (input.type === "transfer" && input.categorySlug === "transfers") {
    return true;
  }
  if ((input.plaidTxnId ?? "").startsWith("import:")) {
    return true;
  }
  return isSettledForAutoClear(input.date, input.now, input.settleDays);
}

/**
 * High-confidence auto-clear gate (mirrors Coach ≥ 0.85 policy).
 * Never clears inbox or pending.
 */
export function isAutoClearEligible(input: AutoClearEligibilityInput): boolean {
  if (input.pending) return false;
  if (input.reconciledAt) return false;
  if (
    isInboxCategory({
      categoryId: input.categoryId,
      categorySlug: input.categorySlug,
      uncategorizedId: input.uncategorizedId,
    })
  ) {
    return false;
  }
  return hasAutoClearTrustSignal({
    type: input.type,
    categorySlug: input.categorySlug,
    plaidTxnId: input.plaidTxnId,
    date: input.date,
    now: input.now,
    settleDays: input.settleDays,
  });
}

/**
 * Set reconciledAt on transactions.
 * When clearing: always skips pending. When `requireCategorized`, also skips inbox.
 */
export async function setTransactionsReconciled(
  ids: string[],
  reconciled: boolean,
  opts?: { requireCategorized?: boolean },
): Promise<{ updated: number; accountIds: string[] }> {
  if (ids.length === 0) return { updated: 0, accountIds: [] };

  const uncategorized = opts?.requireCategorized
    ? await prisma.category.findUnique({
        where: { slug: "uncategorized" },
        select: { id: true },
      })
    : null;

  let targetIds = ids;
  if (reconciled && opts?.requireCategorized) {
    const rows = await prisma.transaction.findMany({
      where: { id: { in: ids }, pending: false },
      select: {
        id: true,
        categoryId: true,
        category: { select: { slug: true } },
      },
    });
    const uncategorizedId = uncategorized?.id ?? null;
    targetIds = rows
      .filter(
        (r) =>
          !isInboxCategory({
            categoryId: r.categoryId,
            categorySlug: r.category?.slug ?? null,
            uncategorizedId,
          }),
      )
      .map((r) => r.id);
    if (targetIds.length === 0) return { updated: 0, accountIds: [] };
  }

  const sample = await prisma.transaction.findMany({
    where: {
      id: { in: targetIds },
      ...(reconciled ? { pending: false } : {}),
    },
    select: { accountId: true },
    distinct: ["accountId"],
  });

  const result = await prisma.transaction.updateMany({
    where: {
      id: { in: targetIds },
      ...(reconciled ? { pending: false } : {}),
    },
    data: { reconciledAt: reconciled ? new Date() : null },
  });

  return {
    updated: result.count,
    accountIds: sample.map((s) => s.accountId),
  };
}
