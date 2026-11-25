import { cacheLife, cacheTag, revalidateTag } from "next/cache";

import { getMonthSpendSummary } from "@/lib/finance/spend-summary";
import type { MonthSpendSummary } from "@/lib/finance/spend-summary";

export function financeSpendUserTag(userId: string) {
  return `finance-spend:${userId}`;
}

export function financeSpendMonthTag(
  userId: string,
  year: number,
  month: number,
) {
  return `finance-spend:${userId}:${year}-${String(month).padStart(2, "0")}`;
}

function yearMonthKey(d: Date) {
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/**
 * Cached lean month spend for Finances Sankey.
 * Keyed by userId + year + month; busted via revalidateFinanceSpend on ledger writes.
 */
export async function getMonthSpendSummaryCached(
  userId: string,
  year: number,
  month: number,
): Promise<MonthSpendSummary> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(financeSpendUserTag(userId));
  cacheTag(financeSpendMonthTag(userId, year, month));
  return getMonthSpendSummary({ userId, year, month });
}

/**
 * Invalidate Finances spend caches when ledger amounts/categories change.
 * Pass txn dates when known to also bust specific month tags.
 */
export function revalidateFinanceSpend(userId: string, dates?: Date[]) {
  if (!userId) return;
  revalidateTag(financeSpendUserTag(userId), "max");
  if (!dates?.length) return;
  const seen = new Set<string>();
  for (const d of dates) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) continue;
    const { year, month } = yearMonthKey(d);
    const key = `${year}-${month}`;
    if (seen.has(key)) continue;
    seen.add(key);
    revalidateTag(financeSpendMonthTag(userId, year, month), "max");
  }
}
