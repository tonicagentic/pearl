import { prisma } from "./prisma";
import { monthBounds } from "./money";

export type CategoryActuals = {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  groupId: string;
  groupName: string;
  groupSlug: string;
  groupKind: string;
  cashPlan: number;
  cashActual: number;
  lifestyleActual: number;
  reviewed: boolean;
};

export type MonthLifestyle = {
  year: number;
  month: number;
  lifestyleCost: number;
  cashPaid: number;
  taxCash: number;
  incomeCash: number;
  savingsRateCash: number | null;
  savingsRateLifestyle: number | null;
  rows: CategoryActuals[];
  unreviewedGroups: string[];
};

/**
 * Lifestyle actual = cash spent in lifestyle categories this month.
 * Cash plan comes from budget lines. Bills are for due-date tracking only.
 */
export async function computeMonthLifestyle(
  year: number,
  month: number,
): Promise<MonthLifestyle> {
  const { start, end } = monthBounds(year, month);

  const groups = await prisma.categoryGroup.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      categories: {
        where: { isArchived: false },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  const budget = await prisma.budget.findUnique({
    where: { year_month: { year, month } },
    include: { lines: true },
  });
  const planByCat = new Map(budget?.lines.map((l) => [l.categoryId, l]) ?? []);

  const you = await prisma.entity.findFirst({
    where: { OR: [{ slug: "you" }, { taxClass: "individual" }] },
  });

  const transactions = await prisma.transaction.findMany({
    where: {
      date: { gte: start, lt: end },
      ...(you ? { entityId: you.id } : {}),
    },
  });

  const rows: CategoryActuals[] = [];
  let lifestyleCost = 0;
  let cashPaid = 0;
  let taxCash = 0;

  for (const g of groups) {
    if (g.kind === "inbox") continue;
    for (const c of g.categories) {
      const catTxns = transactions.filter((t) => t.categoryId === c.id);
      const expenseCash = catTxns
        .filter((t) => t.type === "expense" || t.type === "tax_payment")
        .reduce((s, t) => s + Math.abs(Math.min(t.amount, 0)), 0);

      const lifestyle = g.kind === "lifestyle" ? expenseCash : 0;
      const line = planByCat.get(c.id);
      const row: CategoryActuals = {
        categoryId: c.id,
        categoryName: c.name,
        categorySlug: c.slug,
        groupId: g.id,
        groupName: g.name,
        groupSlug: g.slug,
        groupKind: g.kind,
        cashPlan: line?.cashPlan ?? 0,
        cashActual: expenseCash,
        lifestyleActual: lifestyle,
        reviewed: line?.reviewed ?? false,
      };
      rows.push(row);

      if (g.kind === "lifestyle") {
        lifestyleCost += row.lifestyleActual;
        cashPaid += row.cashActual;
      }
      if (g.slug === "taxes") {
        taxCash += expenseCash;
      }
    }
  }

  const incomeCash = transactions
    .filter((t) => (t.type === "income" || t.type === "distribution") && t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);

  const savingsRateCash =
    incomeCash > 0 ? (incomeCash - cashPaid - taxCash) / incomeCash : null;
  const savingsRateLifestyle =
    incomeCash > 0 ? (incomeCash - lifestyleCost - taxCash) / incomeCash : null;

  const unreviewedGroups: string[] = [];
  for (const g of groups) {
    if (g.kind === "inbox") continue;
    const groupRows = rows.filter((r) => r.groupId === g.id);
    if (groupRows.length === 0) continue;
    const allZero = groupRows.every(
      (r) => r.cashActual === 0 && r.lifestyleActual === 0 && r.cashPlan === 0,
    );
    const anyReviewed = groupRows.some((r) => r.reviewed);
    if (allZero && !anyReviewed) unreviewedGroups.push(g.name);
  }

  return {
    year,
    month,
    lifestyleCost,
    cashPaid,
    taxCash,
    incomeCash,
    savingsRateCash,
    savingsRateLifestyle,
    rows,
    unreviewedGroups,
  };
}
