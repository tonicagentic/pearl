import { prisma } from "./prisma";
import { estimateTaxes } from "./tax-estimator";
import { monthBounds } from "./money";

export type ReportPeriod =
  | { kind: "month"; year: number; month: number }
  | { kind: "quarter"; year: number; quarter: number }
  | { kind: "ytd"; year: number }
  | { kind: "custom"; from: Date; to: Date };

export function periodBounds(period: ReportPeriod): { from: Date; to: Date; label: string } {
  if (period.kind === "month") {
    const { start, end } = monthBounds(period.year, period.month);
    return {
      from: start,
      to: end,
      label: `${period.year}-${String(period.month).padStart(2, "0")}`,
    };
  }
  if (period.kind === "quarter") {
    const startMonth = (period.quarter - 1) * 3; // 0-based
    const from = new Date(period.year, startMonth, 1);
    const to = new Date(period.year, startMonth + 3, 1); // exclusive
    return { from, to, label: `${period.year} Q${period.quarter}` };
  }
  if (period.kind === "ytd") {
    const now = new Date();
    const isCurrentYear = period.year === now.getFullYear();
    return {
      from: new Date(period.year, 0, 1),
      to: new Date(period.year + 1, 0, 1),
      label: isCurrentYear ? `${period.year} · this year` : `${period.year}`,
    };
  }
  return {
    from: period.from,
    to: period.to,
    label: `${period.from.toISOString().slice(0, 10)} → ${period.to.toISOString().slice(0, 10)}`,
  };
}

export function parseReportPeriod(sp: {
  period?: string;
  year?: string;
  month?: string;
  quarter?: string;
  from?: string;
  to?: string;
}): ReportPeriod {
  const now = new Date();
  const year = Number(sp.year ?? now.getFullYear());
  const kind = sp.period ?? "month";
  if (kind === "quarter") {
    return { kind: "quarter", year, quarter: Number(sp.quarter ?? Math.floor(now.getMonth() / 3) + 1) };
  }
  if (kind === "ytd") return { kind: "ytd", year };
  if (kind === "custom" && sp.from && sp.to) {
    return { kind: "custom", from: new Date(sp.from), to: new Date(sp.to) };
  }
  return { kind: "month", year, month: Number(sp.month ?? now.getMonth() + 1) };
}

/** Income statement (cash-basis P&L from categorized bank feed). */
export async function incomeStatement(opts: {
  from: Date;
  to: Date;
  entityId?: string;
}) {
  const whereBase = {
    date: { gte: opts.from, lt: opts.to },
    ...(opts.entityId ? { entityId: opts.entityId } : {}),
  };

  const rows = await prisma.transaction.groupBy({
    by: ["categoryId", "type"],
    where: {
      ...whereBase,
      type: { in: ["income", "expense", "tax_payment", "distribution", "contribution"] },
    },
    _sum: { amount: true },
  });

  const categoryIds = [
    ...new Set(rows.map((r) => r.categoryId).filter((id): id is string => Boolean(id))),
  ];
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: {
      id: true,
      name: true,
      code: true,
      slug: true,
      group: {
        select: {
          id: true,
          name: true,
          slug: true,
          code: true,
          kind: true,
          sortOrder: true,
        },
      },
    },
  });
  const catById = new Map(categories.map((c) => [c.id, c]));

  type Line = {
    categoryId: string | null;
    name: string;
    code: string | null;
    groupName: string | null;
    amount: number;
  };

  const income: Line[] = [];
  const expenses: Line[] = [];
  const taxes: Line[] = [];
  let uncategorizedIncome = 0;
  let uncategorizedExpense = 0;

  for (const r of rows) {
    const sum = r._sum.amount ?? 0;
    const cat = r.categoryId ? catById.get(r.categoryId) : null;
    // Wallet transfers / CC payments are balance-sheet moves, not P&L.
    if (cat?.slug === "transfers" || cat?.slug === "credit-card-payments") {
      continue;
    }

    if (r.type === "income" || r.type === "distribution" || r.type === "contribution") {
      const amt = Math.abs(sum);
      // Merchant refunds (e.g. Vercel credit) land as income + lifestyle category —
      // fold them into expenses as a credit so they don't inflate income.
      if (cat && (cat.group.kind === "lifestyle" || cat.group.slug === "taxes")) {
        if (cat.group.slug === "taxes") {
          taxes.push({
            categoryId: r.categoryId,
            name: cat.name,
            code: cat.code ?? null,
            groupName: cat.group.name,
            amount: -amt,
          });
        } else {
          expenses.push({
            categoryId: r.categoryId,
            name: cat.name,
            code: cat.code ?? null,
            groupName: cat.group.name,
            amount: -amt,
          });
        }
        continue;
      }
      if (!r.categoryId) {
        uncategorizedIncome += amt;
        continue;
      }
      income.push({
        categoryId: r.categoryId,
        name: cat?.name ?? "Unknown",
        code: cat?.code ?? null,
        groupName: cat?.group.name ?? null,
        amount: amt,
      });
    } else if (
      r.type === "tax_payment" ||
      (r.type === "expense" && cat?.group.slug === "taxes")
    ) {
      const amt = Math.abs(sum);
      taxes.push({
        categoryId: r.categoryId,
        name: cat?.name ?? "Tax payments",
        code: cat?.code ?? null,
        groupName: cat?.group.name ?? "Taxes",
        amount: amt,
      });
    } else if (r.type === "expense") {
      const amt = Math.abs(sum);
      if (!r.categoryId) {
        uncategorizedExpense += amt;
        continue;
      }
      expenses.push({
        categoryId: r.categoryId,
        name: cat?.name ?? "Unknown",
        code: cat?.code ?? null,
        groupName: cat?.group.name ?? null,
        amount: amt,
      });
    }
  }

  if (uncategorizedIncome > 0) {
    income.push({
      categoryId: null,
      name: "Uncategorized income",
      code: null,
      groupName: "Inbox",
      amount: uncategorizedIncome,
    });
  }
  if (uncategorizedExpense > 0) {
    expenses.push({
      categoryId: null,
      name: "Uncategorized expense",
      code: null,
      groupName: "Inbox",
      amount: uncategorizedExpense,
    });
  }

  const mergeLines = (lines: Line[]): Line[] => {
    const byKey = new Map<string, Line>();
    for (const line of lines) {
      const key = line.categoryId ?? `name:${line.name}`;
      const prev = byKey.get(key);
      if (prev) prev.amount += line.amount;
      else byKey.set(key, { ...line });
    }
    return [...byKey.values()].filter((l) => Math.abs(l.amount) > 0.0001);
  };

  const incomeMerged = mergeLines(income);
  const expensesMerged = mergeLines(expenses);
  const taxesMerged = mergeLines(taxes);

  incomeMerged.sort((a, b) => b.amount - a.amount);
  expensesMerged.sort((a, b) => b.amount - a.amount);
  taxesMerged.sort((a, b) => b.amount - a.amount);

  const totalIncome = incomeMerged.reduce((s, l) => s + l.amount, 0);
  const totalExpenses = expensesMerged.reduce((s, l) => s + l.amount, 0);
  const totalTaxes = taxesMerged.reduce((s, l) => s + l.amount, 0);

  return {
    income: incomeMerged,
    expenses: expensesMerged,
    taxes: taxesMerged,
    totalIncome,
    totalExpenses,
    totalTaxes,
    operatingNet: totalIncome - totalExpenses,
    netAfterTax: totalIncome - totalExpenses - totalTaxes,
  };
}

export async function taxPaymentsLedger(year: number) {
  const [events, estimate] = await Promise.all([
    prisma.taxEvent.findMany({
      where: { year, type: "estimated_payment" },
      orderBy: { date: "asc" },
    }),
    estimateTaxes(year),
  ]);
  const taxTxns = await prisma.transaction.findMany({
    where: {
      type: "tax_payment",
      date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
    },
    select: {
      id: true,
      date: true,
      amount: true,
      memo: true,
      category: { select: { name: true, slug: true } },
    },
    orderBy: { date: "asc" },
  });
  return { events, taxTxns, estimate };
}

export async function incomeByTaxCharacter(year: number) {
  const [activities, sources] = await Promise.all([
    prisma.taxActivity.findMany({
      where: { year },
      include: { entity: { select: { name: true } } },
    }),
    prisma.incomeSource.findMany({
      where: { isActive: true },
      include: { entity: { select: { name: true } } },
    }),
  ]);
  const byForm = new Map<string, number>();
  for (const a of activities) {
    byForm.set(a.formType, (byForm.get(a.formType) ?? 0) + a.profit);
  }
  return { activities, sources, byForm: Object.fromEntries(byForm) };
}

export async function deductionWorksheet(year: number) {
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);
  const { planOverlapsYear, premiumInYear } = await import("./health-plans");

  const [healthCats, retirementCats, events, llc, allHealthPlans] = await Promise.all([
    prisma.category.findMany({
      where: { taxHint: "self_employed_health", isArchived: false },
      select: { id: true, name: true },
    }),
    prisma.category.findMany({
      where: { taxHint: "retirement", isArchived: false },
      select: { id: true, name: true },
    }),
    prisma.taxEvent.findMany({
      where: {
        year,
        type: { in: ["retirement_contribution"] },
      },
    }),
    prisma.entity.findFirst({ where: { taxClass: "disregarded" } }),
    prisma.healthPlan.findMany(),
  ]);
  const healthPlans = allHealthPlans.filter((p) => planOverlapsYear(p, year));

  const healthIds = healthCats.map((c) => c.id);
  const retirementIds = retirementCats.map((c) => c.id);

  const [healthSum, retirementSum, llcExpenses] = await Promise.all([
    healthIds.length
      ? prisma.transaction.aggregate({
          where: {
            categoryId: { in: healthIds },
            date: { gte: from, lt: to },
            type: "expense",
          },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: 0 } }),
    retirementIds.length
      ? prisma.transaction.aggregate({
          where: {
            categoryId: { in: retirementIds },
            date: { gte: from, lt: to },
          },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: 0 } }),
    llc
      ? prisma.transaction.groupBy({
          by: ["categoryId"],
          where: {
            entityId: llc.id,
            type: "expense",
            date: { gte: from, lt: to },
            NOT: { category: { slug: "uncategorized" } },
          },
          _sum: { amount: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    healthInsuranceCash: Math.abs(healthSum._sum.amount ?? 0),
    healthPlanAnnual: healthPlans.reduce((s, p) => s + premiumInYear(p, year), 0),
    healthPlans,
    retirementCash: Math.abs(retirementSum._sum.amount ?? 0),
    events,
    llcExpenseTotal: llcExpenses.reduce((s, r) => s + Math.abs(r._sum.amount ?? 0), 0),
    llcName: llc?.name ?? null,
  };
}

export async function taxableEventsLog(year: number) {
  return prisma.taxEvent.findMany({
    where: { year },
    orderBy: { date: "asc" },
  });
}

/** Month-to-date cash actuals by category for CoA page — one grouped query. */
export async function categoryMonthActuals(year: number, month: number) {
  const { start, end } = monthBounds(year, month);
  const rows = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      date: { gte: start, lt: end },
      type: { in: ["expense", "tax_payment", "income"] },
      categoryId: { not: null },
    },
    _sum: { amount: true },
  });
  return new Map(rows.map((r) => [r.categoryId!, r._sum.amount ?? 0]));
}
