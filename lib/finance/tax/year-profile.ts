import { prisma, safeFindMany } from "@/lib/finance/prisma";
import { defaultTablesForYear, statusOrSingle } from "./params";
import { defaultTaxYear } from "./year";
import type { DeductionMethod, FilingStatus, TaxSituationFlags } from "./types";

export type YearProfileSnapshot = {
  year: number;
  filingStatus: FilingStatus | null;
  residentState: string | null;
  residentLocality: string | null;
  partYearResident: boolean;
  hasW2: boolean | null;
  hasSelfEmployment: boolean | null;
  hasInvestments: boolean | null;
  hasRental: boolean | null;
  hasK1: boolean | null;
  hasDependents: boolean;
  deductionMethod: DeductionMethod;
  businessExpensesReviewedAt: Date | null;
  returnFiledAt: Date | null;
  priorYearFederalTax: number;
  priorYearStateTax: number;
  priorYearLocalTax: number;
  /** @deprecated alias of priorYearStateTax */
  priorYearCaTax: number;
  withholdingFederalYtd: number;
  withholdingStateYtd: number;
  withholdingLocalYtd: number;
  /** @deprecated alias of withholdingStateYtd */
  withholdingCaYtd: number;
  notes: string | null;
};

/** @deprecated Use YearProfileSnapshot */
export type YearSafeHarbor = Pick<
  YearProfileSnapshot,
  | "year"
  | "priorYearFederalTax"
  | "priorYearCaTax"
  | "withholdingFederalYtd"
  | "withholdingCaYtd"
>;

type YearProfileRow = Partial<YearProfileSnapshot> & {
  id?: string;
  year: number;
  priorYearFederalTax?: number;
  priorYearStateTax?: number;
  priorYearLocalTax?: number;
  priorYearCaTax?: number;
  withholdingFederalYtd?: number;
  withholdingStateYtd?: number;
  withholdingLocalYtd?: number;
  withholdingCaYtd?: number;
};

function yearProfileDelegate() {
  const client = prisma as unknown as Record<
    string,
    {
      findUnique?: (args: object) => Promise<YearProfileRow | null>;
      create?: (args: object) => Promise<YearProfileRow>;
      upsert?: (args: object) => Promise<YearProfileRow>;
    } | undefined
  >;
  return client.taxYearProfile;
}

function emptySnapshot(year: number): YearProfileSnapshot {
  return {
    year,
    filingStatus: null,
    residentState: null,
    residentLocality: null,
    partYearResident: false,
    hasW2: null,
    hasSelfEmployment: null,
    hasInvestments: null,
    hasRental: null,
    hasK1: null,
    hasDependents: false,
    deductionMethod: "standard",
    businessExpensesReviewedAt: null,
    returnFiledAt: null,
    priorYearFederalTax: 0,
    priorYearStateTax: 0,
    priorYearLocalTax: 0,
    priorYearCaTax: 0,
    withholdingFederalYtd: 0,
    withholdingStateYtd: 0,
    withholdingLocalYtd: 0,
    withholdingCaYtd: 0,
    notes: null,
  };
}

function normalizeRow(
  year: number,
  row: YearProfileRow,
): YearProfileSnapshot {
  const stateTax =
    row.priorYearStateTax ??
    row.priorYearCaTax ??
    0;
  const stateWh =
    row.withholdingStateYtd ??
    row.withholdingCaYtd ??
    0;
  return {
    year,
    filingStatus: row.filingStatus
      ? statusOrSingle(row.filingStatus)
      : null,
    residentState: row.residentState ?? null,
    residentLocality: row.residentLocality ?? null,
    partYearResident: Boolean(row.partYearResident),
    hasW2: row.hasW2 ?? null,
    hasSelfEmployment: row.hasSelfEmployment ?? null,
    hasInvestments: row.hasInvestments ?? null,
    hasRental: row.hasRental ?? null,
    hasK1: row.hasK1 ?? null,
    hasDependents: Boolean(row.hasDependents),
    deductionMethod:
      row.deductionMethod === "itemize" ? "itemize" : "standard",
    businessExpensesReviewedAt: row.businessExpensesReviewedAt ?? null,
    returnFiledAt: row.returnFiledAt ?? null,
    priorYearFederalTax: row.priorYearFederalTax ?? 0,
    priorYearStateTax: stateTax,
    priorYearLocalTax: row.priorYearLocalTax ?? 0,
    priorYearCaTax: stateTax,
    withholdingFederalYtd: row.withholdingFederalYtd ?? 0,
    withholdingStateYtd: stateWh,
    withholdingLocalYtd: row.withholdingLocalYtd ?? 0,
    withholdingCaYtd: stateWh,
    notes: row.notes ?? null,
  };
}

async function legacyFromGlobal(year: number): Promise<YearProfileSnapshot> {
  const global = await prisma.taxProfile.findFirst();
  const migrateFromGlobal =
    year === defaultTaxYear() || year === new Date().getFullYear();
  const base = emptySnapshot(year);
  if (!migrateFromGlobal || !global) return base;
  const stateTax =
    global.priorYearCaTax ||
    (!global.priorYearFederalTax ? global.priorYearTotalTax * 0.3 : 0) ||
    0;
  const stateWh = global.withholdingCaYtd || 0;
  return {
    ...base,
    filingStatus: statusOrSingle(global.filingStatus),
    residentState: global.residentState || "CA",
    priorYearFederalTax:
      global.priorYearFederalTax ||
      (!global.priorYearCaTax ? global.priorYearTotalTax * 0.7 : 0) ||
      0,
    priorYearStateTax: stateTax,
    priorYearCaTax: stateTax,
    withholdingFederalYtd:
      global.withholdingFederalYtd ||
      (!global.withholdingCaYtd ? global.withholdingYtd : 0) ||
      0,
    withholdingStateYtd: stateWh,
    withholdingCaYtd: stateWh,
  };
}

export async function inferSituationsFromYear(
  year: number,
): Promise<TaxSituationFlags> {
  const [activities, gains] = await Promise.all([
    prisma.taxActivity.findMany({ where: { year } }),
    safeFindMany<{ term: string }>("taxCapitalGain", { where: { year } }),
  ]);
  const chars = activities.map(
    (a) => a.taxCharacter || a.formType,
  );
  return {
    hasW2: chars.some((c) => c === "w2" || c === "w2_wages"),
    hasSelfEmployment: chars.some(
      (c) => c === "schedule_c" || c === "schedule_c",
    ),
    hasInvestments:
      chars.some((c) =>
        [
          "investments",
          "interest",
          "ordinary_dividends",
          "qualified_dividend",
          "ltcg",
          "stcg",
        ].includes(c),
      ) || gains.length > 0,
    hasRental: chars.some((c) => c === "rental" || c === "schedule_e"),
    hasK1: chars.some((c) => c === "k1" || c.startsWith("k1_")),
  };
}

/** Load or create TaxYearProfile; migrate legacy TaxProfile amounts on first touch. */
export async function getOrCreateTaxYearProfile(
  year: number,
): Promise<YearProfileSnapshot> {
  const delegate = yearProfileDelegate();
  if (!delegate?.findUnique || !delegate.create) {
    return legacyFromGlobal(year);
  }

  const existing = await delegate.findUnique({ where: { year } });
  if (existing) {
    const snap = normalizeRow(year, existing);
    // Backfill state fields from Ca aliases if needed
    if (
      (existing.priorYearStateTax == null || existing.priorYearStateTax === 0) &&
      (existing.priorYearCaTax ?? 0) > 0 &&
      delegate.upsert
    ) {
      try {
        await delegate.upsert({
          where: { year },
          create: { year, priorYearStateTax: existing.priorYearCaTax },
          update: {
            priorYearStateTax: existing.priorYearCaTax,
            withholdingStateYtd:
              existing.withholdingCaYtd ?? existing.withholdingStateYtd ?? 0,
          },
        });
      } catch {
        /* ignore */
      }
    }
    return snap;
  }

  const seed = await legacyFromGlobal(year);
  const inferred = await inferSituationsFromYear(year);
  const global = await prisma.taxProfile.findFirst();
  try {
    const created = await delegate.create({
      data: {
        year,
        filingStatus: seed.filingStatus ?? global?.filingStatus ?? null,
        residentState: seed.residentState ?? global?.residentState ?? "CA",
        residentLocality: null,
        partYearResident: false,
        hasW2: inferred.hasW2 ?? null,
        hasSelfEmployment: inferred.hasSelfEmployment ?? null,
        hasInvestments: inferred.hasInvestments ?? null,
        hasRental: inferred.hasRental ?? null,
        hasK1: inferred.hasK1 ?? null,
        hasDependents: false,
        deductionMethod: "standard",
        priorYearFederalTax: seed.priorYearFederalTax,
        priorYearStateTax: seed.priorYearStateTax,
        priorYearLocalTax: 0,
        priorYearCaTax: seed.priorYearStateTax,
        withholdingFederalYtd: seed.withholdingFederalYtd,
        withholdingStateYtd: seed.withholdingStateYtd,
        withholdingLocalYtd: 0,
        withholdingCaYtd: seed.withholdingStateYtd,
      },
    });
    return normalizeRow(year, created);
  } catch {
    return {
      ...seed,
      hasW2: inferred.hasW2 ?? null,
      hasSelfEmployment: inferred.hasSelfEmployment ?? null,
      hasInvestments: inferred.hasInvestments ?? null,
      hasRental: inferred.hasRental ?? null,
      hasK1: inferred.hasK1 ?? null,
    };
  }
}

export async function upsertTaxYearProfileAmounts(input: {
  year: number;
  priorYearFederalTax: number;
  priorYearStateTax?: number;
  priorYearLocalTax?: number;
  priorYearCaTax?: number;
  withholdingFederalYtd: number;
  withholdingStateYtd?: number;
  withholdingLocalYtd?: number;
  withholdingCaYtd?: number;
}) {
  const stateTax = input.priorYearStateTax ?? input.priorYearCaTax ?? 0;
  const stateWh = input.withholdingStateYtd ?? input.withholdingCaYtd ?? 0;
  const localTax = input.priorYearLocalTax ?? 0;
  const localWh = input.withholdingLocalYtd ?? 0;

  return upsertTaxYearProfile({
    year: input.year,
    priorYearFederalTax: input.priorYearFederalTax,
    priorYearStateTax: stateTax,
    priorYearLocalTax: localTax,
    withholdingFederalYtd: input.withholdingFederalYtd,
    withholdingStateYtd: stateWh,
    withholdingLocalYtd: localWh,
  });
}

export async function upsertTaxYearProfile(input: {
  year: number;
  filingStatus?: string | null;
  residentState?: string | null;
  residentLocality?: string | null;
  partYearResident?: boolean;
  hasW2?: boolean | null;
  hasSelfEmployment?: boolean | null;
  hasInvestments?: boolean | null;
  hasRental?: boolean | null;
  hasK1?: boolean | null;
  hasDependents?: boolean;
  deductionMethod?: string;
  businessExpensesReviewedAt?: Date | null;
  returnFiledAt?: Date | null;
  priorYearFederalTax?: number;
  priorYearStateTax?: number;
  priorYearLocalTax?: number;
  withholdingFederalYtd?: number;
  withholdingStateYtd?: number;
  withholdingLocalYtd?: number;
  notes?: string | null;
  markBusinessExpensesReviewed?: boolean;
}) {
  const delegate = yearProfileDelegate();
  const stateTax = input.priorYearStateTax;
  const stateWh = input.withholdingStateYtd;

  const data: Record<string, unknown> = {};
  const assign = (key: string, value: unknown) => {
    if (value !== undefined) data[key] = value;
  };

  assign("filingStatus", input.filingStatus);
  assign("residentState", input.residentState);
  assign(
    "residentLocality",
    input.residentLocality === "" ? null : input.residentLocality,
  );
  assign("partYearResident", input.partYearResident);
  assign("hasW2", input.hasW2);
  assign("hasSelfEmployment", input.hasSelfEmployment);
  assign("hasInvestments", input.hasInvestments);
  assign("hasRental", input.hasRental);
  assign("hasK1", input.hasK1);
  assign("hasDependents", input.hasDependents);
  assign("deductionMethod", input.deductionMethod);
  assign("priorYearFederalTax", input.priorYearFederalTax);
  if (stateTax !== undefined) {
    data.priorYearStateTax = stateTax;
    data.priorYearCaTax = stateTax;
  }
  assign("priorYearLocalTax", input.priorYearLocalTax);
  assign("withholdingFederalYtd", input.withholdingFederalYtd);
  if (stateWh !== undefined) {
    data.withholdingStateYtd = stateWh;
    data.withholdingCaYtd = stateWh;
  }
  assign("withholdingLocalYtd", input.withholdingLocalYtd);
  assign("notes", input.notes);
  if (input.markBusinessExpensesReviewed) {
    data.businessExpensesReviewedAt = new Date();
  } else if (input.businessExpensesReviewedAt !== undefined) {
    data.businessExpensesReviewedAt = input.businessExpensesReviewedAt;
  }
  if (input.returnFiledAt !== undefined) {
    data.returnFiledAt = input.returnFiledAt;
  }

  if (!delegate?.upsert) {
    const existing = await prisma.taxProfile.findFirst();
    const legacy = {
      priorYearFederalTax: (input.priorYearFederalTax ?? 0) as number,
      priorYearCaTax: (stateTax ?? 0) as number,
      priorYearTotalTax:
        (input.priorYearFederalTax ?? 0) + (stateTax ?? 0),
      withholdingFederalYtd: (input.withholdingFederalYtd ?? 0) as number,
      withholdingCaYtd: (stateWh ?? 0) as number,
      withholdingYtd:
        (input.withholdingFederalYtd ?? 0) + (stateWh ?? 0),
      ...(input.filingStatus
        ? { filingStatus: input.filingStatus }
        : {}),
      ...(input.residentState
        ? { residentState: input.residentState }
        : {}),
    };
    if (existing) {
      await prisma.taxProfile.update({ where: { id: existing.id }, data: legacy });
    } else {
      await prisma.taxProfile.create({
        data: {
          filingStatus: input.filingStatus || "single",
          residentState: input.residentState || "CA",
          ...legacy,
        },
      });
    }
    return getOrCreateTaxYearProfile(input.year);
  }

  await delegate.upsert({
    where: { year: input.year },
    create: {
      year: input.year,
      deductionMethod: "standard",
      ...data,
    },
    update: data,
  });
  return getOrCreateTaxYearProfile(input.year);
}

/** Ensure TaxYearParams exist for year — copy nearest prior or seed defaults. */
export async function ensureTaxYearParams(year: number) {
  const existing = await prisma.taxYearParams.findUnique({ where: { year } });
  if (existing) return { ok: true as const, created: false, params: existing };

  const priors = await prisma.taxYearParams.findMany({
    where: { year: { lt: year } },
    orderBy: { year: "desc" },
    take: 1,
  });
  const source = priors[0];
  const tables = defaultTablesForYear(year);

  const payload = {
    year,
    standardDeduction: tables.federal.standardDeduction.single,
    ssWageBase: tables.se.ssWageBase,
    seSocialSecurityRate: tables.se.ssRate,
    seMedicareRate: tables.se.medicareRate,
    federalBracketsJson: JSON.stringify(tables.federal.brackets.single),
    caBracketsJson: JSON.stringify(tables.states.CA.brackets.single),
    caMentalHealthRate: tables.states.CA.mentalHealthRate ?? 0.01,
    caMentalHealthThreshold: tables.states.CA.mentalHealthThreshold ?? 1_000_000,
    qbiSimpleRate: tables.federal.qbi.rate,
    tablesJson: JSON.stringify(tables),
  };

  if (source) {
    const created = await prisma.taxYearParams.create({
      data: {
        ...payload,
        notes: `Copied structure from ${source.year}; tables regenerated for ${year}.`,
      },
    });
    return { ok: true as const, created: true, params: created };
  }

  const created = await prisma.taxYearParams.create({
    data: {
      ...payload,
      notes: `Seeded default tables for ${year}.`,
    },
  });
  return { ok: true as const, created: true, params: created };
}

export async function yearsWithTaxData(): Promise<number[]> {
  const [params, activities, events, plans, yearProfiles, documents] =
    await Promise.all([
      prisma.taxYearParams.findMany({ select: { year: true } }),
      prisma.taxActivity.findMany({ select: { year: true }, distinct: ["year"] }),
      prisma.taxEvent.findMany({ select: { year: true }, distinct: ["year"] }),
      prisma.healthPlan.findMany({ select: { year: true }, distinct: ["year"] }),
      safeFindMany<{ year: number }>("taxYearProfile", {
        select: { year: true },
      }),
      safeFindMany<{ year: number }>("taxDocument", {
        select: { year: true },
        distinct: ["year"],
      }),
    ]);
  return [
    ...params.map((r) => r.year),
    ...activities.map((r) => r.year),
    ...events.map((r) => r.year),
    ...plans.map((r) => r.year),
    ...yearProfiles.map((r) => r.year),
    ...documents.map((r) => r.year),
  ];
}
