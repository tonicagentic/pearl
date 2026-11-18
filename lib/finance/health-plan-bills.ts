import { prisma } from "@/lib/finance/prisma";

const COVERAGE_LABEL: Record<string, string> = {
  medical: "Health",
  dental: "Dental",
  vision: "Vision",
};

export async function syncHealthPlanBill(plan: {
  id: string;
  year: number;
  coverageType: string;
  carrier: string;
  planName: string;
  premiumMonthly: number;
  premiumNextDate: Date | null;
  categoryId: string;
  billId: string | null;
}): Promise<string | null> {
  const now = new Date();
  const keep =
    plan.year === now.getFullYear() &&
    Number.isFinite(plan.premiumMonthly) &&
    plan.premiumMonthly > 0;

  if (!keep) {
    if (plan.billId) {
      await prisma.healthPlan.update({
        where: { id: plan.id },
        data: { billId: null },
      });
      await prisma.transaction.updateMany({
        where: { billId: plan.billId },
        data: { billId: null },
      });
      await prisma.bill.delete({ where: { id: plan.billId } }).catch(() => undefined);
    }
    return null;
  }

  const kind = COVERAGE_LABEL[plan.coverageType] ?? plan.coverageType;
  const name = `${kind} premium · ${plan.carrier}`;
  const notes = [
    `Synced from ${plan.year} ${plan.planName}`,
    plan.coverageType,
  ].join(" · ");

  const nextDate =
    plan.premiumNextDate ??
    new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const data = {
    name,
    categoryId: plan.categoryId,
    amount: plan.premiumMonthly,
    cadence: "monthly",
    nextDate,
    notes,
    isActive: true,
  };

  if (plan.billId) {
    await prisma.bill.update({ where: { id: plan.billId }, data });
    return plan.billId;
  }

  const bill = await prisma.bill.create({ data });
  return bill.id;
}

export async function deleteHealthPlanLinkedBill(plan: {
  id: string;
  billId: string | null;
}) {
  if (!plan.billId) return;
  await prisma.healthPlan.update({
    where: { id: plan.id },
    data: { billId: null },
  });
  await prisma.transaction.updateMany({
    where: { billId: plan.billId },
    data: { billId: null },
  });
  await prisma.bill.delete({ where: { id: plan.billId } }).catch(() => undefined);
}
