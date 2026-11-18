import { buildTaxDocumentsPayload } from "@/lib/finance/api-v1-tax";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { createTaxDocumentFromUpload } from "@/lib/finance/tax";
import { revalidatePath } from "next/cache";
import { withUserDb } from "@/lib/finance/db";

export async function GET(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    const year = new URL(request.url).searchParams.get("year");
    const payload = await buildTaxDocumentsPayload(year);
    return Response.json(payload);
  });
}

export async function POST(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    try {
      const form = await request.formData();
      const yearRaw = form.get("year");
      const year = Number(yearRaw);
      if (!Number.isFinite(year)) {
        return Response.json({ error: "year is required" }, { status: 400 });
      }
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return Response.json(
          { error: "Choose a PDF or CSV file" },
          { status: 400 },
        );
      }
      const id = await createTaxDocumentFromUpload({
        year,
        file,
        accountId: String(form.get("accountId") || "") || null,
        payerName: String(form.get("payerName") || "") || null,
        formKind: String(form.get("formKind") || "") || null,
      });
      revalidatePath("/taxes");
      revalidatePath(`/taxes?year=${year}`);
      return Response.json({ ok: true, id });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Upload failed" },
        { status: 400 },
      );
    }
  });
}
