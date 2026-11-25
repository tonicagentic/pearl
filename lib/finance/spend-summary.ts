import { withUserDb } from "@/lib/finance/db";
import { formatMoney, monthBounds } from "@/lib/finance/money";
import { prisma } from "@/lib/finance/prisma";

export type MonthSpendCategory = {
  categoryId: string | null;
  groupId: string | null;
  name: string;
  groupName: string;
  amount: number;
};

export type MonthSpendGroup = {
  groupId: string | null;
  name: string;
  amount: number;
};

export type MonthSpendSummary = {
  year: number;
  month: number;
  label: string;
  from: string;
  to: string;
  totalSpent: number;
  totalSpentLabel: string;
  groups: MonthSpendGroup[];
  categories: MonthSpendCategory[];
};

/**
 * Lean month spend rollup for the Finances Sankey: one groupBy + one category
 * lookup. Expense + tax_payment only — no full P&L / income lines.
 */
export async function getMonthSpendSummary(input: {
  userId: string;
  year: number;
  month: number;
}): Promise<MonthSpendSummary> {
  return withUserDb(input.userId, () =>
    computeMonthSpendSummary(input.year, input.month),
  );
}

async function computeMonthSpendSummary(
  year: number,
  month: number,
): Promise<MonthSpendSummary> {
  const { start, end } = monthBounds(year, month);
  const label = `${year}-${String(month).padStart(2, "0")}`;

  const rows = await prisma.transaction.groupBy({
    by: ["categoryId", "type"],
    where: {
      date: { gte: start, lt: end },
      type: { in: ["expense", "tax_payment"] },
    },
    _sum: { amount: true },
  });

  const categoryIds = [
    ...new Set(
      rows.map((r) => r.categoryId).filter((id): id is string => Boolean(id)),
    ),
  ];

  const categories =
    categoryIds.length === 0
      ? []
      : await prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: {
            id: true,
            name: true,
            slug: true,
            group: {
              select: { id: true, name: true, slug: true, sortOrder: true },
            },
          },
        });
  const catById = new Map(categories.map((c) => [c.id, c]));

  type Acc = {
    categoryId: string | null;
    groupId: string | null;
    name: string;
    groupName: string;
    groupSort: number;
    amount: number;
  };

  const byCategory = new Map<string, Acc>();

  for (const r of rows) {
    const sum = Number(r._sum.amount ?? 0);
    const amt = Math.abs(sum);
    if (amt < 0.0001) continue;

    const cat = r.categoryId ? catById.get(r.categoryId) : null;
    if (cat?.slug === "transfers" || cat?.slug === "credit-card-payments") {
      continue;
    }

    const groupName = cat?.group.name ?? "Inbox";
    const groupId = cat?.group.id ?? null;
    const name = cat?.name ?? "Uncategorized";
    const key = r.categoryId ?? `uncategorized:${r.type}`;
    const prev = byCategory.get(key);
    if (prev) {
      prev.amount += amt;
    } else {
      byCategory.set(key, {
        categoryId: r.categoryId,
        groupId,
        name,
        groupName,
        groupSort: cat?.group.sortOrder ?? 999,
        amount: amt,
      });
    }
  }

  const categoryLines = [...byCategory.values()].filter(
    (c) => c.amount > 0.0001,
  );

  const groupMap = new Map<
    string,
    { groupId: string | null; name: string; amount: number; sort: number }
  >();
  for (const c of categoryLines) {
    const gKey = c.groupId ?? `name:${c.groupName}`;
    const prev = groupMap.get(gKey);
    if (prev) prev.amount += c.amount;
    else {
      groupMap.set(gKey, {
        groupId: c.groupId,
        name: c.groupName,
        amount: c.amount,
        sort: c.groupSort,
      });
    }
  }

  const groups = [...groupMap.values()]
    .sort((a, b) => b.amount - a.amount || a.sort - b.sort)
    .map(({ groupId, name, amount }) => ({ groupId, name, amount }));

  const categoryOut = categoryLines
    .sort((a, b) => b.amount - a.amount)
    .map(({ categoryId, groupId, name, groupName, amount }) => ({
      categoryId,
      groupId,
      name,
      groupName,
      amount,
    }));

  const totalSpent = categoryOut.reduce((s, c) => s + c.amount, 0);

  return {
    year,
    month,
    label,
    from: start.toISOString(),
    to: end.toISOString(),
    totalSpent,
    totalSpentLabel: formatMoney(totalSpent),
    groups,
    categories: categoryOut,
  };
}
