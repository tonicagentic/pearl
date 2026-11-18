import { prisma } from "@/lib/finance/prisma";
import { monthlyFromPeriodic } from "@/lib/finance/vehicles";

export async function syncHomeLineBill(line: {
  id: string;
  name: string;
  provider: string | null;
  amount: number;
  cadence: string;
  nextDate: Date | null;
  categoryId: string;
  billId: string | null;
  homeName?: string | null;
}): Promise<string | null> {
  const keep = Number.isFinite(line.amount) && line.amount > 0;

  if (!keep) {
    if (line.billId) {
      await prisma.homeLine.update({
        where: { id: line.id },
        data: { billId: null },
      });
      await prisma.transaction.updateMany({
        where: { billId: line.billId },
        data: { billId: null },
      });
      await prisma.bill.delete({ where: { id: line.billId } }).catch(() => undefined);
    }
    return null;
  }

  const provider = line.provider?.trim();
  const label = line.homeName
    ? `${line.homeName} · ${line.name}`
    : line.name;
  const name = provider ? `${label} (${provider})` : label;
  const notes = [
    "Synced from home expense",
    provider ? `Provider: ${provider}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const data = {
    name,
    categoryId: line.categoryId,
    amount: line.amount,
    cadence: line.cadence || "monthly",
    nextDate: line.nextDate,
    notes,
    isActive: true,
  };

  if (line.billId) {
    await prisma.bill.update({ where: { id: line.billId }, data });
    return line.billId;
  }

  const bill = await prisma.bill.create({ data });
  return bill.id;
}

export async function deleteHomeLineLinkedBill(line: {
  id: string;
  billId: string | null;
}) {
  if (!line.billId) return;
  await prisma.homeLine.update({
    where: { id: line.id },
    data: { billId: null },
  });
  await prisma.transaction.updateMany({
    where: { billId: line.billId },
    data: { billId: null },
  });
  await prisma.bill.delete({ where: { id: line.billId } }).catch(() => undefined);
}

/** Upsert this month's cash plan from the line's periodic amount. */
export async function syncHomeLineBudget(opts: {
  year: number;
  month: number;
  categoryId: string;
  amount: number;
  cadence: string;
}) {
  const cashPlan = monthlyFromPeriodic(opts.amount, opts.cadence);
  if (cashPlan <= 0) return;

  const budget = await prisma.budget.upsert({
    where: { year_month: { year: opts.year, month: opts.month } },
    create: { year: opts.year, month: opts.month },
    update: {},
  });
  await prisma.budgetLine.upsert({
    where: {
      budgetId_categoryId: {
        budgetId: budget.id,
        categoryId: opts.categoryId,
      },
    },
    create: {
      budgetId: budget.id,
      categoryId: opts.categoryId,
      cashPlan,
      reviewed: true,
    },
    update: { cashPlan, reviewed: true },
  });
}
