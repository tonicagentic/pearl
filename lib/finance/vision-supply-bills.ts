import { prisma } from "@/lib/finance/prisma";
import { billCadenceForVisionSupply } from "@/lib/finance/vision-supplies";

export async function syncVisionSupplyBill(item: {
  id: string;
  name: string;
  kind: string;
  amount: number;
  cadence: string;
  nextOrderDate: Date | null;
  isActive: boolean;
  categoryId: string;
  billId: string | null;
  retailer: string | null;
}): Promise<string | null> {
  const shouldKeep =
    item.isActive &&
    item.cadence !== "as_needed" &&
    Number.isFinite(item.amount) &&
    item.amount > 0;

  if (!shouldKeep) {
    if (item.billId) {
      await prisma.visionSupply.update({
        where: { id: item.id },
        data: { billId: null },
      });
      await prisma.transaction.updateMany({
        where: { billId: item.billId },
        data: { billId: null },
      });
      await prisma.bill.delete({ where: { id: item.billId } }).catch(() => undefined);
    }
    return null;
  }

  const notes = [
    "Synced from vision supply",
    item.kind,
    item.retailer ? `Retailer: ${item.retailer}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const data = {
    name: `${item.name} (vision)`,
    categoryId: item.categoryId,
    amount: item.amount,
    cadence: billCadenceForVisionSupply(item.cadence),
    nextDate: item.nextOrderDate,
    notes,
    isActive: true,
  };

  if (item.billId) {
    await prisma.bill.update({ where: { id: item.billId }, data });
    return item.billId;
  }

  const bill = await prisma.bill.create({ data });
  return bill.id;
}

export async function deleteVisionSupplyLinkedBill(item: {
  id: string;
  billId: string | null;
}) {
  if (!item.billId) return;
  await prisma.visionSupply.update({
    where: { id: item.id },
    data: { billId: null },
  });
  await prisma.transaction.updateMany({
    where: { billId: item.billId },
    data: { billId: null },
  });
  await prisma.bill.delete({ where: { id: item.billId } }).catch(() => undefined);
}
