import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { runTaxDocumentExtract } from "@/lib/finance/tax";
import { revalidatePath } from "next/cache";
import { withUserDb } from "@/lib/finance/db";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    try {
      const { id } = await ctx.params;
      const body = (await request.json().catch(() => ({}))) as {
        year?: number | string;
      };
      await runTaxDocumentExtract(id);
      if (body.year) {
        revalidatePath("/taxes");
        revalidatePath(`/taxes?year=${body.year}`);
      } else {
        revalidatePath("/taxes");
      }
      return Response.json({ ok: true, id });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Re-extract failed" },
        { status: 400 },
      );
    }
  });
}
