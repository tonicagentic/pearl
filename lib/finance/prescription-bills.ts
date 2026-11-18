import { prisma } from "@/lib/finance/prisma";
import { billCadenceForPrescription } from "@/lib/finance/prescriptions";

export async function syncPrescriptionBill(rx: {
  id: string;
  name: string;
  amount: number;
  cadence: string;
  nextRefillDate: Date | null;
  isActive: boolean;
  categoryId: string;
  billId: string | null;
  pharmacy: string | null;
}): Promise<string | null> {
  const shouldKeep =
    rx.isActive &&
    rx.cadence !== "as_needed" &&
    Number.isFinite(rx.amount) &&
    rx.amount > 0;

  if (!shouldKeep) {
    if (rx.billId) {
      await prisma.prescription.update({
        where: { id: rx.id },
        data: { billId: null },
      });
      await prisma.transaction.updateMany({
        where: { billId: rx.billId },
        data: { billId: null },
      });
      await prisma.bill.delete({ where: { id: rx.billId } }).catch(() => undefined);
    }
    return null;
  }

  const notes = [
    "Synced from prescription",
    rx.pharmacy ? `Pharmacy: ${rx.pharmacy}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const data = {
    name: `${rx.name} (Rx)`,
    categoryId: rx.categoryId,
    amount: rx.amount,
    cadence: billCadenceForPrescription(rx.cadence),
    nextDate: rx.nextRefillDate,
    notes,
    isActive: true,
  };

  if (rx.billId) {
    await prisma.bill.update({ where: { id: rx.billId }, data });
    return rx.billId;
  }

  const bill = await prisma.bill.create({ data });
  return bill.id;
}

export async function deletePrescriptionLinkedBill(rx: {
  id: string;
  billId: string | null;
}) {
  if (!rx.billId) return;
  await prisma.prescription.update({
    where: { id: rx.id },
    data: { billId: null },
  });
  await prisma.transaction.updateMany({
    where: { billId: rx.billId },
    data: { billId: null },
  });
  await prisma.bill.delete({ where: { id: rx.billId } }).catch(() => undefined);
}
