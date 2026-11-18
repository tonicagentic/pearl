import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { prisma } from "@/lib/finance/prisma";
import { revalidatePath } from "next/cache";
import { withUserDb } from "@/lib/finance/db";

function characterToFormType(character: string): string {
  switch (character) {
    case "w2_wages":
      return "w2";
    case "schedule_c":
      return "schedule_c";
    case "k1_ordinary":
    case "k1_qbi":
      return "k1";
    case "rental":
      return "schedule_e";
    case "qualified_dividend":
    case "ordinary_dividends":
    case "ltcg":
    case "stcg":
    case "interest":
    case "tax_exempt":
      return "investments";
    default:
      return character || "schedule_c";
  }
}

export async function POST(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    try {
      const body = (await request.json()) as {
        id?: string;
        entityId?: string;
        year?: number;
        taxCharacter?: string;
        formType?: string;
        label?: string;
        profit?: number;
        qbiAmount?: number | null;
        ssWages?: number | null;
        medicareWages?: number | null;
        grossReceipts?: number | null;
        expenses?: number | null;
        notes?: string | null;
      };

      const taxCharacter = body.taxCharacter || body.formType || "schedule_c";
      const formType = body.formType || characterToFormType(taxCharacter);
      const data = {
        entityId: body.entityId || "",
        year: Number(body.year),
        formType,
        taxCharacter,
        label: body.label || "",
        profit: Number(body.profit) || 0,
        qbiAmount: body.qbiAmount ?? null,
        ssWages: body.ssWages ?? null,
        medicareWages: body.medicareWages ?? null,
        grossReceipts: body.grossReceipts ?? null,
        expenses: body.expenses ?? null,
        notes: body.notes ?? null,
      };

      if (!data.entityId || !Number.isFinite(data.year) || !data.label) {
        return Response.json(
          { error: "entityId, year, and label are required" },
          { status: 400 },
        );
      }

      let activity;
      if (body.id) {
        activity = await prisma.taxActivity.update({
          where: { id: body.id },
          data,
        });
      } else {
        activity = await prisma.taxActivity.create({ data });
      }

      revalidatePath("/taxes");
      revalidatePath(`/taxes?year=${data.year}`);
      revalidatePath("/");
      return Response.json({ ok: true, activity });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Save failed" },
        { status: 400 },
      );
    }
  });
}
