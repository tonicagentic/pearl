import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { fetchTaxFormBlanks, resolveTaxYear } from "@/lib/finance/tax";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      year?: number | string;
      force?: boolean;
    };
    const year = resolveTaxYear(body.year);
    await fetchTaxFormBlanks(year, { force: Boolean(body.force) });
    revalidatePath("/taxes");
    revalidatePath(`/taxes?year=${year}`);
    return Response.json({ ok: true, year });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 400 },
    );
  }
}
