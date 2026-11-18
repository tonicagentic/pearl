import { prisma } from "@/lib/finance/prisma";
import {
  billAmountForSeries,
  billCadenceForSeries,
} from "@/lib/finance/recurring-series";

export async function syncRecurringSeriesBill(series: {
  id: string;
  name: string;
  amount: number;
  cadence: string;
  nextDate: Date | null;
  isActive: boolean;
  categoryId: string;
  billId: string | null;
  provider: string | null;
  domain: string;
}): Promise<string | null> {
  const shouldKeep =
    series.isActive &&
    Number.isFinite(series.amount) &&
    series.amount > 0;

  if (!shouldKeep) {
    if (series.billId) {
      await prisma.recurringSeries.update({
        where: { id: series.id },
        data: { billId: null },
      });
      await prisma.transaction.updateMany({
        where: { billId: series.billId },
        data: { billId: null },
      });
      await prisma.bill.delete({ where: { id: series.billId } }).catch(() => undefined);
    }
    return null;
  }

  const notes = [
    `Synced from ${series.domain === "lifestyle" ? "routine" : "care series"}`,
    series.provider ? `Provider: ${series.provider}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const data = {
    name: series.name,
    categoryId: series.categoryId,
    amount: billAmountForSeries(series.amount, series.cadence),
    cadence: billCadenceForSeries(series.cadence),
    nextDate: series.nextDate,
    notes,
    isActive: true,
  };

  if (series.billId) {
    await prisma.bill.update({ where: { id: series.billId }, data });
    return series.billId;
  }

  const bill = await prisma.bill.create({ data });
  return bill.id;
}

export async function deleteRecurringSeriesLinkedBill(series: {
  id: string;
  billId: string | null;
}) {
  if (!series.billId) return;
  await prisma.recurringSeries.update({
    where: { id: series.id },
    data: { billId: null },
  });
  await prisma.transaction.updateMany({
    where: { billId: series.billId },
    data: { billId: null },
  });
  await prisma.bill.delete({ where: { id: series.billId } }).catch(() => undefined);
}
