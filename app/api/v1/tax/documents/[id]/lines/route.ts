import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { prisma } from "@/lib/finance/prisma";
import { revalidatePath } from "next/cache";
import { withUserDb } from "@/lib/finance/db";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    try {
      const { id: documentId } = await ctx.params;
      const body = (await request.json()) as {
        lineId?: string;
        year?: number | string;
        status?: string;
        target?: string;
        taxCharacter?: string | null;
        label?: string | null;
        amount?: number | null;
        entityId?: string | null;
        description?: string | null;
        proceeds?: number | null;
        basis?: number | null;
        term?: string | null;
        date?: string | null;
      };

      const lineId = body.lineId?.trim();
      if (!lineId) {
        return Response.json({ error: "lineId is required" }, { status: 400 });
      }

      const line = await prisma.taxDocumentLine.findUnique({
        where: { id: lineId },
      });
      if (!line || line.documentId !== documentId) {
        return Response.json({ error: "Line not found" }, { status: 404 });
      }
      if (line.status === "committed") {
        return Response.json(
          { error: "Committed lines cannot be edited" },
          { status: 400 },
        );
      }

      const data: Record<string, unknown> = {};
      if (body.status != null) data.status = body.status;
      if (body.target != null) data.target = body.target;
      if ("taxCharacter" in body) data.taxCharacter = body.taxCharacter || null;
      if ("label" in body) data.label = body.label || null;
      if ("amount" in body) data.amount = body.amount;
      if ("entityId" in body) data.entityId = body.entityId || null;
      if ("description" in body) data.description = body.description || null;
      if ("proceeds" in body) data.proceeds = body.proceeds;
      if ("basis" in body) data.basis = body.basis;
      if (body.term) data.term = body.term;
      if ("date" in body) {
        data.date = body.date ? new Date(body.date) : null;
      }

      const updated = await prisma.taxDocumentLine.update({
        where: { id: lineId },
        data,
      });

      revalidatePath("/taxes");
      if (body.year) revalidatePath(`/taxes?year=${body.year}`);
      return Response.json({ ok: true, line: updated });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Update failed" },
        { status: 400 },
      );
    }
  });
}
