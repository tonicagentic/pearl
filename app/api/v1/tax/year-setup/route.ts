import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { prisma } from "@/lib/finance/prisma";
import { resolveTaxYear, upsertTaxYearProfile } from "@/lib/finance/tax";
import { revalidatePath } from "next/cache";
import { withUserDb } from "@/lib/finance/db";

function parseTriState(v: unknown): boolean | null {
  if (v === true || v === "yes") return true;
  if (v === false || v === "no") return false;
  return null;
}

export async function PUT(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    try {
      const body = (await request.json()) as Record<string, unknown>;
      const year = resolveTaxYear(body.year as string | number | undefined);

      // Profile (identity) fields — same as saveTaxYearSetup
      const { encryptSecret } = await import("@/lib/finance/crypto");
      const existing = await prisma.taxProfile.findFirst();
      const ssnRaw = String(body.ssn ?? "").replace(/\D/g, "");
      const spouseSsnRaw = String(body.spouseSsn ?? "").replace(/\D/g, "");

      const profileData: {
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
        filingStatus: String(body.filingStatus || "single"),
        residentState: String(body.residentState || "CA"),
        legalName: (body.legalName as string) || null,
        occupation: (body.occupation as string) || null,
        addressLine1: (body.addressLine1 as string) || null,
        addressLine2: (body.addressLine2 as string) || null,
        city: (body.city as string) || null,
        state: (body.state as string) || null,
        zip: (body.zip as string) || null,
        phone: (body.phone as string) || null,
        spouseLegalName: (body.spouseLegalName as string) || null,
        notes: (body.notes as string) || null,
      };

      if (ssnRaw.length === 9) profileData.ssnEnc = encryptSecret(ssnRaw);
      else if (body.clearSsn) profileData.ssnEnc = null;
      if (spouseSsnRaw.length === 9) {
        profileData.spouseSsnEnc = encryptSecret(spouseSsnRaw);
      } else if (body.clearSpouseSsn) {
        profileData.spouseSsnEnc = null;
      }

      if (existing) {
        await prisma.taxProfile.update({
          where: { id: existing.id },
          data: profileData,
        });
      } else {
        await prisma.taxProfile.create({ data: profileData });
      }

      const priorState =
        body.priorYearStateTax != null && body.priorYearStateTax !== ""
          ? Number(body.priorYearStateTax)
          : Number(body.priorYearCaTax ?? 0);
      const whState =
        body.withholdingStateYtd != null && body.withholdingStateYtd !== ""
          ? Number(body.withholdingStateYtd)
          : Number(body.withholdingCaYtd ?? 0);

      await upsertTaxYearProfile({
        year,
        filingStatus: String(body.filingStatus || "") || null,
        residentState: String(body.residentState || "") || null,
        residentLocality: String(body.residentLocality || "") || null,
        partYearResident: body.partYearResident === true || body.partYearResident === "yes",
        hasW2: parseTriState(body.hasW2),
        hasSelfEmployment: parseTriState(body.hasSelfEmployment),
        hasInvestments: parseTriState(body.hasInvestments),
        hasRental: parseTriState(body.hasRental),
        hasK1: parseTriState(body.hasK1),
        hasDependents: body.hasDependents === true || body.hasDependents === "yes",
        deductionMethod: String(body.deductionMethod || "standard"),
        priorYearFederalTax: Number(body.priorYearFederalTax) || 0,
        priorYearStateTax: priorState || 0,
        priorYearLocalTax: Number(body.priorYearLocalTax) || 0,
        withholdingFederalYtd: Number(body.withholdingFederalYtd) || 0,
        withholdingStateYtd: whState || 0,
        withholdingLocalYtd: Number(body.withholdingLocalYtd) || 0,
      });

      revalidatePath("/taxes");
      revalidatePath(`/taxes?year=${year}`);
      revalidatePath("/");
      return Response.json({ ok: true, year });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Save failed" },
        { status: 400 },
      );
    }
  });
}
