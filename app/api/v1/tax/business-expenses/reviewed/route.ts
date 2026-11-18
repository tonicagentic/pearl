import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { resolveTaxYear, upsertTaxYearProfile } from "@/lib/finance/tax";
import { revalidatePath } from "next/cache";
import { withUserDb } from "@/lib/finance/db";

export async function POST(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    try {
      const body = (await request.json()) as { year?: number | string };
      const year = resolveTaxYear(body.year);
      await upsertTaxYearProfile({
        year,
        markBusinessExpensesReviewed: true,
      });
      revalidatePath("/taxes");
      revalidatePath(`/taxes?year=${year}`);
      return Response.json({ ok: true, year });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Failed" },
        { status: 400 },
      );
    }
  });
}
