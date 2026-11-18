import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { prisma } from "@/lib/finance/prisma";
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
      const { id: documentId } = await ctx.params;
      const body = (await request.json().catch(() => ({}))) as {
        year?: number | string;
      };

      await prisma.taxDocumentLine.updateMany({
        where: {
          documentId,
          status: "pending",
          committedActivityId: null,
          committedCapitalGainId: null,
        },
        data: { status: "accepted" },
      });

      revalidatePath("/taxes");
      if (body.year) revalidatePath(`/taxes?year=${body.year}`);
      return Response.json({ ok: true, documentId });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Accept failed" },
        { status: 400 },
      );
    }
  });
}
