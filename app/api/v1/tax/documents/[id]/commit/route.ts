import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { prisma } from "@/lib/finance/prisma";
import { defaultFilingEntityId } from "@/lib/finance/tax";
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
      const year = Number(body.year);
      if (!Number.isFinite(year)) {
        return Response.json({ error: "year is required" }, { status: 400 });
      }

      const fallbackEntityId = await defaultFilingEntityId();
      const lines = await prisma.taxDocumentLine.findMany({
        where: {
          documentId,
          status: { in: ["accepted", "pending"] },
        },
      });

      const toCommit = lines.filter(
        (l) =>
          l.status === "accepted" &&
          !l.committedActivityId &&
          !l.committedCapitalGainId,
      );

      for (const line of toCommit) {
        if (line.target === "capital_gain") {
          const gain = await prisma.taxCapitalGain.create({
            data: {
              year,
              description:
                line.description ||
                line.label ||
                line.sourceBox ||
                "1099-B import",
              proceeds: line.proceeds ?? 0,
              basis: line.basis ?? 0,
              term: line.term === "short" ? "short" : "long",
              date: line.date,
              notes: line.sourceBox
                ? `Imported from tax document (${line.sourceBox})`
                : "Imported from tax document",
            },
          });
          await prisma.taxDocumentLine.update({
            where: { id: line.id },
            data: {
              status: "committed",
              committedCapitalGainId: gain.id,
            },
          });
        } else {
          const taxCharacter = line.taxCharacter || "ordinary_dividends";
          const activity = await prisma.taxActivity.create({
            data: {
              entityId: line.entityId || fallbackEntityId,
              year,
              formType: characterToFormType(taxCharacter),
              taxCharacter,
              label: line.label || line.sourceBox || "1099 import",
              profit: line.amount ?? 0,
              notes: line.sourceBox
                ? `Imported from tax document (${line.sourceBox})`
                : "Imported from tax document",
            },
          });
          await prisma.taxDocumentLine.update({
            where: { id: line.id },
            data: {
              status: "committed",
              committedActivityId: activity.id,
            },
          });
        }
      }

      const remaining = await prisma.taxDocumentLine.count({
        where: {
          documentId,
          status: { in: ["pending", "accepted"] },
          committedActivityId: null,
          committedCapitalGainId: null,
        },
      });
      const committedCount = await prisma.taxDocumentLine.count({
        where: { documentId, status: "committed" },
      });

      if (committedCount > 0 && remaining === 0) {
        await prisma.taxDocument.update({
          where: { id: documentId },
          data: { status: "committed", error: null },
        });
      } else if (committedCount > 0) {
        await prisma.taxDocument.update({
          where: { id: documentId },
          data: { status: "ready", error: null },
        });
      }

      revalidatePath("/taxes");
      revalidatePath(`/taxes?year=${year}`);
      revalidatePath("/");
      return Response.json({
        ok: true,
        documentId,
        committed: toCommit.length,
      });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Commit failed" },
        { status: 400 },
      );
    }
  });
}
