import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { prisma } from "@/lib/finance/prisma";
import { revalidatePath } from "next/cache";
import { withUserDb } from "@/lib/finance/db";

export async function POST(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    try {
      const body = (await request.json()) as {
        year?: number;
        date?: string;
        type?: string;
        jurisdiction?: string | null;
        quarter?: number | null;
        amount?: number;
        notes?: string | null;
      };

      const year = Number(body.year);
      if (!Number.isFinite(year) || !body.date || !body.type) {
        return Response.json(
          { error: "year, date, and type are required" },
          { status: 400 },
        );
      }

      const event = await prisma.taxEvent.create({
        data: {
          year,
          date: new Date(body.date),
          type: body.type,
          jurisdiction: body.jurisdiction || null,
          quarter: body.quarter ?? null,
          amount: Number(body.amount) || 0,
          notes: body.notes ?? null,
        },
      });

      revalidatePath("/taxes");
      revalidatePath("/");
      return Response.json({ ok: true, id: event.id });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Save failed" },
        { status: 400 },
      );
    }
  });
}
