import { prisma, safeFindMany } from "./prisma";
import {
  computeTaxes,
  formTypeToCharacter,
  parseTablesJson,
  statusOrSingle,
  type TaxComputation,
  type TaxCapitalLine,
  type TaxIncomeLine,
} from "./tax";

/** @deprecated Use TaxComputation — kept for gradual migration of callers */
export type TaxEstimate = TaxComputation["legacy"] & {
  year: number;
  /** Full computation when loaded via estimateTaxes */
  computation?: TaxComputation;
};

export async function estimateTaxes(
  year: number,
): Promise<(TaxEstimate & { computation: TaxComputation }) | null> {
  const computation = await computeTaxesForYear(year);
  if (!computation) return null;
  return {
    year,
    ...computation.legacy,
    healthDeductionSource: computation.legacy.healthDeductionSource,
    computation,
  };
}

function isStateJurisdiction(j: string | null | undefined, state: string) {
  if (!j) return false;
  const upper = j.toUpperCase();
  if (upper === state.toUpperCase()) return true;
  // Legacy CA payments still count when resident is CA
  if (state.toUpperCase() === "CA" && upper === "CA") return true;
  return false;
}

export async function computeTaxesForYear(
  year: number,
): Promise<TaxComputation | null> {
  const profile = await prisma.taxProfile.findFirst();
  const params = await prisma.taxYearParams.findUnique({ where: { year } });
  if (!profile || !params) return null;

  const { getOrCreateTaxYearProfile } = await import("./tax/year-profile");
  const { planOverlapsYear, premiumInYear } = await import("./health-plans");
  const [activities, events, allHealthPlans, capitalGains, yearProfile, bizExpenses] =
    await Promise.all([
      prisma.taxActivity.findMany({ where: { year } }),
      prisma.taxEvent.findMany({ where: { year } }),
      prisma.healthPlan.findMany(),
      safeFindMany<{
        id: string;
        description: string;
        proceeds: number;
        basis: number;
        term: string;
      }>("taxCapitalGain", { where: { year } }),
      getOrCreateTaxYearProfile(year),
      safeFindMany<{
        activityId: string;
        category: string;
        amount: number;
      }>("taxBusinessExpense", { where: { year } }),
    ]);

  const expenseByActivity = new Map<string, number>();
  for (const e of bizExpenses) {
    const mealsFactor = e.category === "meals" ? 0.5 : 1;
    expenseByActivity.set(
      e.activityId,
      (expenseByActivity.get(e.activityId) ?? 0) + e.amount * mealsFactor,
    );
  }

  const tables = parseTablesJson(params.tablesJson, year, params);

  const lines: TaxIncomeLine[] = activities.map((a) => {
    const fromCategories = expenseByActivity.get(a.id);
    const expenses =
      fromCategories != null && fromCategories > 0
        ? fromCategories
        : "expenses" in a
          ? ((a as { expenses?: number | null }).expenses ?? null)
          : null;
    return {
      id: a.id,
      label: a.label,
      character: formTypeToCharacter(a.formType, a.taxCharacter || null),
      amount: a.profit,
      qbiAmount: a.qbiAmount,
      ssWages: a.ssWages,
      medicareWages: a.medicareWages,
      grossReceipts:
        "grossReceipts" in a
          ? ((a as { grossReceipts?: number | null }).grossReceipts ?? null)
          : null,
      expenses,
    };
  });

  const capitalFromModel: TaxCapitalLine[] = capitalGains.map((g) => ({
    id: g.id,
    description: g.description,
    proceeds: g.proceeds,
    basis: g.basis,
    term: g.term === "short" ? "short" : "long",
  }));

  for (const e of events) {
    if (e.type !== "security_sale") continue;
    if (e.proceeds != null && e.basis != null) {
      capitalFromModel.push({
        id: e.id,
        description: e.notes || "Security sale",
        proceeds: e.proceeds,
        basis: e.basis,
        term: e.term === "short" ? "short" : "long",
      });
    } else if (e.amount !== 0) {
      capitalFromModel.push({
        id: e.id,
        description: e.notes || "Security sale",
        proceeds: e.amount,
        basis: 0,
        term: "long",
      });
    }
  }

  const healthPlans = allHealthPlans.filter((p) => planOverlapsYear(p, year));
  const planHealthTotal = healthPlans.reduce(
    (s, p) => s + premiumInYear(p, year),
    0,
  );
  const eventHealthTotal = events
    .filter((e) => e.type === "health_insurance_deduction")
    .reduce((s, e) => s + e.amount, 0);
  const healthPremiumAnnual =
    planHealthTotal > 0 ? planHealthTotal : eventHealthTotal;
  const healthSource =
    planHealthTotal > 0 ? "plans" : eventHealthTotal > 0 ? "events" : "none";

  const retirement = events
    .filter((e) => e.type === "retirement_contribution")
    .reduce((s, e) => s + e.amount, 0);

  const filingStatus = statusOrSingle(
    yearProfile.filingStatus ?? profile.filingStatus,
  );
  const residentState =
    yearProfile.residentState || profile.residentState || "CA";
  const residentLocality = yearProfile.residentLocality;

  const estimatedPaymentsFederal = events
    .filter(
      (e) =>
        e.type === "estimated_payment" &&
        (e.jurisdiction === "federal" || !e.jurisdiction),
    )
    .reduce((s, e) => s + e.amount, 0);
  const estimatedPaymentsState = events
    .filter(
      (e) =>
        e.type === "estimated_payment" &&
        isStateJurisdiction(e.jurisdiction, residentState),
    )
    .reduce((s, e) => s + e.amount, 0);
  const estimatedPaymentsLocal = events
    .filter(
      (e) =>
        e.type === "estimated_payment" &&
        e.jurisdiction?.toUpperCase() === "NYC",
    )
    .reduce((s, e) => s + e.amount, 0);

  const computation = computeTaxes({
    year,
    filingStatus,
    residentState,
    residentLocality,
    partYearResident: yearProfile.partYearResident,
    deductionMethod: yearProfile.deductionMethod,
    situations: {
      hasW2: yearProfile.hasW2,
      hasSelfEmployment: yearProfile.hasSelfEmployment,
      hasInvestments: yearProfile.hasInvestments,
      hasRental: yearProfile.hasRental,
      hasK1: yearProfile.hasK1,
      hasDependents: yearProfile.hasDependents,
    },
    businessExpensesReviewed: Boolean(yearProfile.businessExpensesReviewedAt),
    tables,
    lines,
    capitalGains: capitalFromModel,
    healthPremiumAnnual,
    retirementContributions: retirement,
    estimatedPaymentsFederal,
    estimatedPaymentsState,
    estimatedPaymentsLocal,
    withholdingFederal: yearProfile.withholdingFederalYtd,
    withholdingState: yearProfile.withholdingStateYtd,
    withholdingLocal: yearProfile.withholdingLocalYtd,
    priorYearFederalTax: yearProfile.priorYearFederalTax,
    priorYearStateTax: yearProfile.priorYearStateTax,
    priorYearLocalTax: yearProfile.priorYearLocalTax,
  });

  computation.legacy.healthDeductionSource = healthSource;
  if (healthSource === "plans") {
    const note = `SE health deduction from ${healthPlans.length} plan(s) for ${year}.`;
    if (!computation.limitations.includes(note)) {
      computation.legacy.notes = [
        note,
        ...computation.legacy.notes.filter((n) => !n.startsWith("SE health")),
      ];
    }
  }

  return computation;
}

/** Federal 1040-ES / state approximate due dates for a calendar year. */
export function estimateDueDates(year: number) {
  return [
    { quarter: 1, label: "Q1", federal: new Date(year, 3, 15), ca: new Date(year, 3, 15) },
    { quarter: 2, label: "Q2", federal: new Date(year, 5, 15), ca: new Date(year, 5, 15) },
    { quarter: 3, label: "Q3", federal: new Date(year, 8, 15), ca: new Date(year, 8, 15) },
    { quarter: 4, label: "Q4", federal: new Date(year + 1, 0, 15), ca: new Date(year + 1, 0, 15) },
  ];
}
