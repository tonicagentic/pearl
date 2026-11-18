import { prisma } from "@/lib/finance/prisma";
import { vehicleDisplayName } from "@/lib/finance/vehicles";

type BillSyncInput = {
  id: string;
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  registrationRenewsOn: Date | null;
  registrationAmount: number | null;
  registrationBillId: string | null;
  insuranceCarrier: string | null;
  insurancePolicyNumber: string | null;
  insuranceAmount: number | null;
  insuranceCadence: string;
  insuranceRenewsOn: Date | null;
  insuranceBillId: string | null;
  lines: { kind: string; categoryId: string }[];
};

async function upsertLinkedBill({
  vehicleId,
  billField,
  existingBillId,
  shouldKeep,
  name,
  categoryId,
  amount,
  cadence,
  nextDate,
  notes,
}: {
  vehicleId: string;
  billField: "registrationBillId" | "insuranceBillId";
  existingBillId: string | null;
  shouldKeep: boolean;
  name: string;
  categoryId: string | null;
  amount: number;
  cadence: string;
  nextDate: Date | null;
  notes?: string | null;
}): Promise<string | null> {
  if (!shouldKeep || !categoryId) {
    if (existingBillId) {
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: { [billField]: null },
      });
      await prisma.transaction.updateMany({
        where: { billId: existingBillId },
        data: { billId: null },
      });
      await prisma.bill.delete({ where: { id: existingBillId } }).catch(() => undefined);
    }
    return null;
  }

  if (existingBillId) {
    await prisma.bill.update({
      where: { id: existingBillId },
      data: {
        name,
        categoryId,
        amount,
        cadence,
        nextDate,
        notes: notes ?? null,
        isActive: true,
      },
    });
    return existingBillId;
  }

  const bill = await prisma.bill.create({
    data: {
      name,
      categoryId,
      amount,
      cadence,
      nextDate,
      notes: notes ?? null,
      isActive: true,
    },
  });
  return bill.id;
}

/** Upsert or clear registration/insurance bills for a vehicle; returns new FK ids. */
export async function syncVehicleBills(vehicle: BillSyncInput): Promise<{
  registrationBillId: string | null;
  insuranceBillId: string | null;
}> {
  const label = vehicleDisplayName(vehicle);
  const registrationLine = vehicle.lines.find((l) => l.kind === "registration");
  const insuranceLine = vehicle.lines.find((l) => l.kind === "insurance");

  const keepRegistration =
    vehicle.registrationRenewsOn != null ||
    (vehicle.registrationAmount != null && vehicle.registrationAmount > 0);

  const registrationBillId = await upsertLinkedBill({
    vehicleId: vehicle.id,
    billField: "registrationBillId",
    existingBillId: vehicle.registrationBillId,
    shouldKeep: keepRegistration,
    name: `${label} registration`,
    categoryId: registrationLine?.categoryId ?? null,
    amount: vehicle.registrationAmount ?? 0,
    cadence: "annual",
    nextDate: vehicle.registrationRenewsOn,
    notes: "Synced from vehicle registration",
  });

  const keepInsurance =
    vehicle.insuranceRenewsOn != null ||
    (vehicle.insuranceAmount != null && vehicle.insuranceAmount > 0) ||
    Boolean(vehicle.insuranceCarrier?.trim()) ||
    Boolean(vehicle.insurancePolicyNumber?.trim());

  const carrier = vehicle.insuranceCarrier?.trim();
  const policyNumber = vehicle.insurancePolicyNumber?.trim();
  const insuranceName = carrier
    ? `${label} insurance (${carrier})`
    : `${label} insurance`;

  const noteParts = [
    carrier ? `Carrier: ${carrier}` : null,
    policyNumber ? `Policy: ${policyNumber}` : null,
  ].filter(Boolean);

  const insuranceBillId = await upsertLinkedBill({
    vehicleId: vehicle.id,
    billField: "insuranceBillId",
    existingBillId: vehicle.insuranceBillId,
    shouldKeep: keepInsurance,
    name: insuranceName,
    categoryId: insuranceLine?.categoryId ?? null,
    amount: vehicle.insuranceAmount ?? 0,
    cadence: vehicle.insuranceCadence || "monthly",
    nextDate: vehicle.insuranceRenewsOn,
    notes: noteParts.length
      ? noteParts.join(" · ")
      : "Synced from vehicle insurance",
  });

  return { registrationBillId, insuranceBillId };
}

export async function deleteVehicleLinkedBills(vehicle: {
  id: string;
  registrationBillId: string | null;
  insuranceBillId: string | null;
}) {
  await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: { registrationBillId: null, insuranceBillId: null },
  });

  const ids = [vehicle.registrationBillId, vehicle.insuranceBillId].filter(
    (id): id is string => Boolean(id),
  );
  if (!ids.length) return;

  await prisma.transaction.updateMany({
    where: { billId: { in: ids } },
    data: { billId: null },
  });
  await prisma.bill.deleteMany({ where: { id: { in: ids } } });
}
