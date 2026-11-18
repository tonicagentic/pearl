import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { prisma } from "@/lib/finance/prisma";
import { revalidatePath } from "next/cache";
import { withUserDb } from "@/lib/finance/db";

export async function PUT(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    try {
      const body = (await request.json()) as {
        filingStatus?: string;
        residentState?: string;
        legalName?: string | null;
        occupation?: string | null;
        addressLine1?: string | null;
        addressLine2?: string | null;
        city?: string | null;
        state?: string | null;
        zip?: string | null;
        phone?: string | null;
        spouseLegalName?: string | null;
        notes?: string | null;
        ssn?: string;
        spouseSsn?: string;
        clearSsn?: boolean;
        clearSpouseSsn?: boolean;
        year?: number | string;
      };

      const { encryptSecret } = await import("@/lib/finance/crypto");
      const existing = await prisma.taxProfile.findFirst();

      const ssnRaw = String(body.ssn ?? "").replace(/\D/g, "");
      const spouseSsnRaw = String(body.spouseSsn ?? "").replace(/\D/g, "");

      const data: {
        filingStatus: string;
        residentState: string;
        legalName: string | null;
        occupation: string | null;
        addressLine1: string | null;
        addressLine2: string | null;
        city: string | null;
        state: string | null;
        zip: string | null;
        phone: string | null;
        spouseLegalName: string | null;
        notes: string | null;
        ssnEnc?: string | null;
        spouseSsnEnc?: string | null;
      } = {
        filingStatus: body.filingStatus || "single",
        residentState: body.residentState || "CA",
        legalName: body.legalName || null,
        occupation: body.occupation || null,
        addressLine1: body.addressLine1 || null,
        addressLine2: body.addressLine2 || null,
        city: body.city || null,
        state: body.state || null,
        zip: body.zip || null,
        phone: body.phone || null,
        spouseLegalName: body.spouseLegalName || null,
        notes: body.notes || null,
      };

      if (ssnRaw.length === 9) {
        data.ssnEnc = encryptSecret(ssnRaw);
      } else if (body.clearSsn) {
        data.ssnEnc = null;
      }
      if (spouseSsnRaw.length === 9) {
        data.spouseSsnEnc = encryptSecret(spouseSsnRaw);
      } else if (body.clearSpouseSsn) {
        data.spouseSsnEnc = null;
      }

      if (existing) {
        await prisma.taxProfile.update({ where: { id: existing.id }, data });
      } else {
        await prisma.taxProfile.create({ data });
      }

      revalidatePath("/taxes");
      if (body.year) revalidatePath(`/taxes?year=${body.year}`);
      revalidatePath("/");
      return Response.json({ ok: true });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Save failed" },
        { status: 400 },
      );
    }
  });
}
