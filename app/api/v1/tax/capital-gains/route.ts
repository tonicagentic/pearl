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
        description?: string;
        proceeds?: number;
        basis?: number;
        term?: string;
        date?: string | null;
        notes?: string | null;
      };

      const year = Number(body.year);
      if (!Number.isFinite(year) || !body.description) {
        return Response.json(
          { error: "year and description are required" },
          { status: 400 },
        );
      }

      const gain = await prisma.taxCapitalGain.create({
        data: {
          year,
          description: body.description,
          proceeds: Number(body.proceeds) || 0,
          basis: Number(body.basis) || 0,
          term: body.term === "short" ? "short" : "long",
          date: body.date ? new Date(body.date) : null,
          notes: body.notes ?? null,
        },
      });

      revalidatePath("/taxes");
      revalidatePath(`/taxes?year=${year}`);
      revalidatePath("/");
      return Response.json({ ok: true, id: gain.id });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Save failed" },
        { status: 400 },
      );
    }
  });
}
