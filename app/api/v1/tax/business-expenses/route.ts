import { buildTaxBusinessExpensesPayload } from "@/lib/finance/api-v1-tax";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { prisma } from "@/lib/finance/prisma";
import { BUSINESS_EXPENSE_CATEGORIES, resolveTaxYear } from "@/lib/finance/tax";
import { revalidatePath } from "next/cache";
import { withUserDb } from "@/lib/finance/db";

export async function GET(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    const year = new URL(request.url).searchParams.get("year");
    const payload = await buildTaxBusinessExpensesPayload(year);
    return Response.json({
      ...payload,
      categories: BUSINESS_EXPENSE_CATEGORIES,
    });
  });
}

export async function PUT(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    try {
      const body = (await request.json()) as {
        year?: number | string;
        activityId?: string;
        amounts?: Record<string, number>;
      };
      const year = resolveTaxYear(body.year);
      const activityId = body.activityId?.trim();
      if (!activityId) {
        return Response.json({ error: "activityId is required" }, { status: 400 });
      }

      const amounts = body.amounts ?? {};
      let total = 0;
      for (const cat of BUSINESS_EXPENSE_CATEGORIES) {
        const amount = Number(amounts[cat.id]) || 0;
        total += cat.id === "meals" ? amount * 0.5 : amount;
        await prisma.taxBusinessExpense.upsert({
          where: {
            activityId_category: { activityId, category: cat.id },
          },
          create: { year, activityId, category: cat.id, amount },
          update: { amount, year },
        });
      }

      await prisma.taxActivity.update({
        where: { id: activityId },
        data: { expenses: total },
      });

      revalidatePath("/taxes");
      revalidatePath(`/taxes?year=${year}`);
      const payload = await buildTaxBusinessExpensesPayload(String(year));
      return Response.json({
        ...payload,
        categories: BUSINESS_EXPENSE_CATEGORIES,
      });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Save failed" },
        { status: 400 },
      );
    }
  });
}
