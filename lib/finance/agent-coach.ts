import { getUserId } from "@/lib/finance/db";
import { prisma } from "@/lib/finance/prisma";
import { computeMonthLifestyle } from "@/lib/finance/lifestyle";
import { currentYearMonth, monthBounds } from "@/lib/finance/money";
import { money, moneyOf, moneyFields, toolPayload } from "@/lib/finance/agent-money";
import type { Money } from "@/lib/finance/agent-money";
import {
  buildMerchantHistoryIndex,
  fingerprintMemo,
  looksLikeTransferMemo,
  matchMerchantCategory,
} from "@/lib/finance/merchant-categorize";
import { revalidateFinanceSpend } from "@/lib/finance/spend-cache";

export { fingerprintMemo } from "@/lib/finance/merchant-categorize";

export const CONFIDENCE_AUTO = 0.85;

export type InsightKind =
  | "budget_gap"
  | "savings"
  | "category_suggest"
  | "run_summary";

export type InsightStatus = "proposed" | "applied" | "dismissed";

/** Safe truncated merchant for the model — not full free-text memo. */
export function redactMemoForAgent(memo: string | null | undefined): string {
  const fp = fingerprintMemo(memo);
  const alnum = (memo ?? "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
  return alnum ? `${fp} · ${alnum}` : fp;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return (
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1)
  );
}

export async function createInsight(input: {
  kind: InsightKind;
  title: string;
  body: string;
  categoryId?: string | null;
  payload?: Record<string, unknown>;
  confidence?: number;
  status?: InsightStatus;
  runId?: string | null;
}) {
  const status = input.status ?? "proposed";
  return prisma.agentInsight.create({
    data: {
      kind: input.kind,
      title: input.title,
      body: input.body,
      categoryId: input.categoryId ?? null,
      payload: JSON.stringify(input.payload ?? {}),
      confidence: input.confidence ?? 0,
      status,
      appliedAt: status === "applied" ? new Date() : null,
      runId: input.runId ?? null,
    },
  });
}

export async function listOpenInsights(limit = 20) {
  const rows = await prisma.agentInsight.findMany({
    where: { status: { in: ["proposed", "applied"] } },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
  return rows.map((r) => ({
    ...r,
    payload: safeJson(r.payload),
  }));
}

export async function dismissInsight(id: string) {
  await prisma.agentInsight.update({
    where: { id },
    data: { status: "dismissed" },
  });
}

export async function undoBudgetApply(insightId: string) {
  const insight = await prisma.agentInsight.findUnique({
    where: { id: insightId },
  });
  if (!insight || insight.status !== "applied" || insight.kind !== "budget_gap") {
    return { ok: false as const, error: "Nothing to undo" };
  }
  const payload = safeJson(insight.payload) as {
    year?: number;
    month?: number;
    categoryId?: string;
    previousCashPlan?: number;
    previousCashPlanCents?: number;
  };
  const previous =
    payload.previousCashPlanCents != null
      ? money(payload.previousCashPlanCents / 100)
      : payload.previousCashPlan != null
        ? money(payload.previousCashPlan)
        : null;
  if (
    payload.year == null ||
    payload.month == null ||
    !payload.categoryId ||
    previous == null
  ) {
    return { ok: false as const, error: "Missing previous plan in insight" };
  }

  const budget = await prisma.budget.upsert({
    where: {
      year_month: { year: payload.year, month: payload.month },
    },
    create: { year: payload.year, month: payload.month },
    update: {},
  });
  await prisma.budgetLine.upsert({
    where: {
      budgetId_categoryId: {
        budgetId: budget.id,
        categoryId: payload.categoryId,
      },
    },
    create: {
      budgetId: budget.id,
      categoryId: payload.categoryId,
      cashPlan: previous,
      reviewed: false,
    },
    update: { cashPlan: previous },
  });
  await prisma.agentInsight.update({
    where: { id: insightId },
    data: { status: "dismissed" },
  });
  return { ok: true as const };
}

export async function undoAgentCategorize(insightId: string) {
  const insight = await prisma.agentInsight.findUnique({
    where: { id: insightId },
  });
  if (
    !insight ||
    insight.status !== "applied" ||
    insight.kind !== "category_suggest"
  ) {
    return { ok: false as const, error: "Nothing to undo" };
  }
  const payload = safeJson(insight.payload) as {
    previousCategories?: { transactionId: string; previousCategoryId: string | null }[];
  };
  const previous = payload.previousCategories ?? [];
  if (previous.length === 0) {
    return { ok: false as const, error: "Missing previous categories in insight" };
  }

  for (const row of previous) {
    await prisma.transaction.update({
      where: { id: row.transactionId },
      data: { categoryId: row.previousCategoryId },
    });
  }
  await prisma.agentInsight.update({
    where: { id: insightId },
    data: { status: "dismissed" },
  });
  revalidateFinanceSpend(getUserId());
  return { ok: true as const, restored: previous.length };
}

function safeJson(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function getLifestyleMonthForAgent(year: number, month: number) {
  const lifestyle = await computeMonthLifestyle(year, month);
  return toolPayload("computeMonthLifestyle", {
    year,
    month,
    ...moneyFields({
      incomeCash: lifestyle.incomeCash,
      lifestyleCost: lifestyle.lifestyleCost,
      cashPaid: lifestyle.cashPaid,
    }),
    savingsRateLifestyle: lifestyle.savingsRateLifestyle,
    savingsRateCash: lifestyle.savingsRateCash,
    unreviewedGroups: lifestyle.unreviewedGroups,
    rows: lifestyle.rows.map((r) => ({
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      groupName: r.groupName,
      groupKind: r.groupKind,
      cashPlan: moneyOf(r.cashPlan),
      cashActual: moneyOf(r.cashActual),
      lifestyleActual: moneyOf(r.lifestyleActual),
      reviewed: r.reviewed,
    })),
  });
}

export async function listCategoriesForAgent() {
  const groups = await prisma.categoryGroup.findMany({
    where: { kind: { in: ["lifestyle", "cash_only"] } },
    orderBy: { sortOrder: "asc" },
    include: {
      categories: {
        where: { isArchived: false },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true },
      },
    },
  });
  return groups.map((g) => ({
    groupId: g.id,
    groupName: g.name,
    groupKind: g.kind,
    categories: g.categories,
  }));
}

export async function listTransactionsForAgent(opts: {
  from: string;
  to: string;
  status?: "inbox" | "all";
  categoryId?: string;
  limit?: number;
}) {
  const from = new Date(opts.from);
  const to = new Date(opts.to);
  const uncategorized = await prisma.category.findUnique({
    where: { slug: "uncategorized" },
    select: { id: true },
  });

  const rows = await prisma.transaction.findMany({
    where: {
      date: { gte: from, lt: to },
      ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
    },
    orderBy: { date: "desc" },
    take: opts.limit ?? 100,
    include: {
      category: { select: { id: true, name: true, slug: true } },
      account: { select: { name: true } },
    },
  });

  return toolPayload(
    "listTransactionsForAgent",
    {
      transactions: rows
        .map((t) => {
          const slug = t.category?.slug ?? null;
          const isInbox =
            !t.categoryId ||
            t.categoryId === uncategorized?.id ||
            slug === "uncategorized";
          return {
            id: t.id,
            date: t.date.toISOString().slice(0, 10),
            amount: moneyOf(t.amount),
            type: t.type,
            memo: redactMemoForAgent(t.memo),
            fingerprint: fingerprintMemo(t.memo),
            accountName: t.account.name,
            categoryId: t.categoryId,
            categoryName: t.category?.name ?? null,
            status: t.pending ? "pending" : isInbox ? "inbox" : "categorized",
          };
        })
        .filter((t) => (opts.status === "inbox" ? t.status === "inbox" : true)),
    },
  );
}

export async function getNetWorthForAgent(asOfYear?: number) {
  const { computeNetWorth } = await import("@/lib/finance/net-worth");
  const nw = await computeNetWorth(asOfYear);
  return toolPayload("computeNetWorth", {
    year: asOfYear ?? new Date().getFullYear(),
    netWorth: moneyOf(nw.netWorth),
    composition: {
      cash: moneyOf(nw.composition.cash),
      investments: moneyOf(nw.composition.investments),
      otherAssets: moneyOf(nw.composition.otherAssets),
      liabilities: moneyOf(nw.composition.liabilities),
      totalAssets: moneyOf(nw.composition.totalAssets),
    },
    entities: nw.snapshots.map((s) => ({
      name: s.name,
      taxClass: s.taxClass,
      stakeFromYou: s.stakeFromYou,
      equity: moneyOf(s.equity),
      lookThroughEquity: moneyOf(s.lookThroughEquity),
      assets: moneyOf(s.assets),
      liabilities: moneyOf(s.liabilities),
    })),
  });
}

export async function getUpcomingBillsForAgent() {
  const bills = await prisma.bill.findMany({
    where: { isActive: true },
    orderBy: [{ nextDate: "asc" }, { name: "asc" }],
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
  return toolPayload("prisma.Bill", {
    bills: bills.map((b) => ({
      id: b.id,
      name: b.name,
      amount: moneyOf(b.amount),
      cadence: b.cadence,
      nextDate: b.nextDate ? b.nextDate.toISOString().slice(0, 10) : null,
      categoryId: b.categoryId,
      categoryName: b.category?.name ?? null,
    })),
  });
}

export async function getHomesVehiclesForAgent() {
  const { monthlyFromPeriodic } = await import("@/lib/finance/vehicles");
  const [homes, vehicles] = await Promise.all([
    prisma.home.findMany({
      orderBy: { name: "asc" },
      include: {
        lines: {
          orderBy: { sortOrder: "asc" },
          include: { category: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.vehicle.findMany({
      orderBy: { name: "asc" },
      include: {
        lines: {
          orderBy: { sortOrder: "asc" },
          include: { category: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  return toolPayload("prisma.Home+Vehicle", {
    homes: homes.map((h) => ({
      id: h.id,
      name: h.name,
      occupancy: h.occupancy,
      isPrimary: h.isPrimary,
      estimatedValue: moneyOf(h.estimatedValue ?? 0),
      lines: h.lines.map((l) => ({
        kind: l.kind,
        name: l.name,
        categoryId: l.categoryId,
        categoryName: l.category?.name ?? null,
      })),
    })),
    vehicles: vehicles.map((v) => {
      const insuranceMonthly = monthlyFromPeriodic(
        v.insuranceAmount,
        v.insuranceCadence,
      );
      const registrationMonthly = monthlyFromPeriodic(
        v.registrationAmount,
        "annual",
      );
      const fuelMonthly = v.fuelEstimateMonthly ?? 0;
      return {
        id: v.id,
        name: v.name,
        year: v.year,
        make: v.make,
        model: v.model,
        ownership: v.ownership,
        estimatedValue: moneyOf(v.estimatedValue ?? 0),
        insuranceMonthly: moneyOf(insuranceMonthly),
        registrationMonthly: moneyOf(registrationMonthly),
        fuelMonthly: moneyOf(fuelMonthly),
        monthlyCostProxy: moneyOf(
          insuranceMonthly + registrationMonthly + fuelMonthly,
        ),
        lines: v.lines.map((l) => ({
          kind: l.kind,
          name: l.name,
          categoryId: l.categoryId,
          categoryName: l.category?.name ?? null,
        })),
      };
    }),
  });
}

export async function getTripsAndTaxesForAgent(year?: number) {
  const { defaultTaxYear } = await import("@/lib/finance/tax/year");
  const y = year ?? defaultTaxYear();
  const { estimateTaxes } = await import("@/lib/finance/tax-estimator");
  const now = new Date();
  const trips = await prisma.trip.findMany({
    where: {
      status: { notIn: ["done", "cancelled"] },
      OR: [
        { startDate: null },
        { startDate: { gte: now } },
        { endDate: { gte: now } },
      ],
    },
    orderBy: { startDate: "asc" },
    take: 20,
    include: { lines: true },
  });

  const tax = await estimateTaxes(y);
  const c = tax?.computation;

  return toolPayload("trips+estimateTaxes", {
    year: y,
    upcomingTrips: trips.map((t) => {
      const planned = t.lines.reduce((s, l) => s + l.plannedAmount, 0);
      const flightChosen = t.lines.some(
        (l) => l.kind === "flights" && l.bookingStatus === "chosen",
      );
      const lodgingChosen = t.lines.some(
        (l) =>
          l.kind === "lodging" &&
          (l.bookingStatus === "chosen" || l.bookingStatus === "not_needed"),
      );
      return {
        id: t.id,
        name: t.name,
        destination: t.destination,
        status: t.status,
        stayMode: t.stayMode,
        itineraryType: t.itineraryType,
        dateFlexDays: t.dateFlexDays,
        originIata: t.originIata,
        destinationIata: t.destinationIata,
        startDate: t.startDate
          ? t.startDate.toISOString().slice(0, 10)
          : null,
        endDate: t.endDate ? t.endDate.toISOString().slice(0, 10) : null,
        plannedTotal: moneyOf(planned),
        lineCount: t.lines.length,
        flightChosen,
        lodgingReady: lodgingChosen,
      };
    }),
    taxEstimate: tax
      ? {
          ordinaryIncome: moneyOf(tax.ordinaryIncome),
          totalTax: moneyOf(tax.totalTax),
          federalIncomeTax: moneyOf(tax.federalIncomeTax),
          californiaTax: moneyOf(tax.californiaTax),
          stateTax: moneyOf(tax.stateTax ?? tax.californiaTax),
          localTax: moneyOf(tax.localTax ?? 0),
          residentState: c?.residentState ?? null,
          residentLocality: c?.residentLocality ?? null,
          federalTotalTax: c ? c.federal.totalTax : moneyOf(tax.federalIncomeTax),
          californiaTotalTax: c
            ? c.california.totalTax
            : moneyOf(tax.californiaTax),
          stateTotalTax: c?.state?.totalTax ?? moneyOf(tax.stateTax ?? 0),
          localTotalTax: c?.local?.totalTax ?? moneyOf(tax.localTax ?? 0),
          seTax: moneyOf(tax.seTax),
          paidEstimates: moneyOf(tax.paidEstimates),
          withholding: moneyOf(tax.withholding),
          remaining: moneyOf(tax.remaining),
          nextPaymentSuggestion: moneyOf(tax.nextPaymentSuggestion),
          setAside: moneyOf(tax.setAside),
          limitations: c?.limitations.slice(0, 8) ?? tax.notes.slice(0, 5),
          formCount: c?.forms.length ?? 0,
        }
      : null,
  });
}

export async function getHealthCostsForAgent(year?: number) {
  const y = year ?? new Date().getFullYear();
  const { annualPremium } = await import("@/lib/finance/health-plans");
  const { prescriptionMonthlyEquivalent } = await import("@/lib/finance/prescriptions");
  const { visionSupplyMonthlyEquivalent } = await import("@/lib/finance/vision-supplies");

  const [plans, prescriptions, vision, appointments] = await Promise.all([
    prisma.healthPlan.findMany({ where: { year: y } }),
    prisma.prescription.findMany({ where: { isActive: true } }),
    prisma.visionSupply.findMany({ where: { isActive: true } }),
    prisma.appointment.findMany({
      where: {
        status: { in: ["planned", "scheduled"] },
        OR: [
          { scheduledAt: null },
          { scheduledAt: { gte: new Date() } },
        ],
      },
      orderBy: { scheduledAt: "asc" },
      take: 15,
    }),
  ]);

  const planRows = plans.map((p) => {
    const annual = annualPremium(p);
    return {
      name: p.planName,
      carrier: p.carrier,
      coverageType: p.coverageType,
      enrollmentKind: p.enrollmentKind,
      qualifyingEvent: p.qualifyingEvent,
      coverageStart: p.coverageStart
        ? p.coverageStart.toISOString().slice(0, 10)
        : null,
      coverageEnd: p.coverageEnd
        ? p.coverageEnd.toISOString().slice(0, 10)
        : null,
      sbcStatus: p.sbcStatus,
      deductible: p.deductible != null ? moneyOf(p.deductible) : null,
      oopMax: p.oopMax != null ? moneyOf(p.oopMax) : null,
      deductibleUsed: moneyOf(p.deductibleUsed),
      oopUsed: moneyOf(p.oopUsed),
      monthlyPremium: moneyOf(p.premiumMonthly),
      annualPremium: moneyOf(annual),
    };
  });
  const rxRows = prescriptions.map((p) => ({
    name: p.name,
    cadence: p.cadence,
    amount: moneyOf(p.amount),
    monthlyEquivalent: moneyOf(
      prescriptionMonthlyEquivalent(p.amount, p.cadence),
    ),
  }));
  const visionRows = vision.map((v) => ({
    name: v.name,
    kind: v.kind,
    cadence: v.cadence,
    amount: moneyOf(v.amount),
    monthlyEquivalent: moneyOf(
      visionSupplyMonthlyEquivalent(v.amount, v.cadence),
    ),
  }));

  return toolPayload("healthPlans+Rx+vision+appointments", {
    year: y,
    plans: planRows,
    plansAnnualTotal: moneyOf(
      planRows.reduce((s, p) => s + p.annualPremium.usd, 0),
    ),
    prescriptions: rxRows,
    prescriptionsMonthlyTotal: moneyOf(
      rxRows.reduce((s, p) => s + p.monthlyEquivalent.usd, 0),
    ),
    visionSupplies: visionRows,
    visionMonthlyTotal: moneyOf(
      visionRows.reduce((s, v) => s + v.monthlyEquivalent.usd, 0),
    ),
    upcomingAppointments: appointments.map((a) => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      status: a.status,
      scheduledAt: a.scheduledAt
        ? a.scheduledAt.toISOString().slice(0, 10)
        : null,
      expectedCost: moneyOf(a.expectedCost),
    })),
  });
}

export type FigureClaim = {
  /** e.g. net_worth | lifestyle_cost | category_cash_actual | bill_amount */
  path: string;
  cents: number;
  year?: number;
  month?: number;
  categoryId?: string;
  billId?: string;
};

export async function verifyFigures(claims: FigureClaim[]) {
  const mismatches: {
    path: string;
    claimedCents: number;
    actualCents: number;
    actualUsd: number;
  }[] = [];
  const verified: { path: string; cents: number; usd: number }[] = [];

  for (const claim of claims) {
    const actual = await resolveFigureClaim(claim);
    if (actual == null) {
      mismatches.push({
        path: claim.path,
        claimedCents: claim.cents,
        actualCents: NaN,
        actualUsd: NaN,
      });
      continue;
    }
    if (actual.cents !== claim.cents) {
      mismatches.push({
        path: claim.path,
        claimedCents: claim.cents,
        actualCents: actual.cents,
        actualUsd: actual.usd,
      });
    } else {
      verified.push({ path: claim.path, cents: actual.cents, usd: actual.usd });
    }
  }

  return toolPayload("verifyFigures", {
    ok: mismatches.length === 0,
    verified,
    mismatches,
  });
}

async function resolveFigureClaim(claim: FigureClaim): Promise<Money | null> {
  const { year: cy, month: cm } = currentYearMonth();
  const year = claim.year ?? cy;
  const month = claim.month ?? cm;

  switch (claim.path) {
    case "net_worth": {
      const nw = await getNetWorthForAgent(year);
      return nw.netWorth;
    }
    case "lifestyle_cost": {
      const ls = await getLifestyleMonthForAgent(year, month);
      return ls.lifestyleCost;
    }
    case "lifestyle_cash_paid": {
      const ls = await getLifestyleMonthForAgent(year, month);
      return ls.cashPaid;
    }
    case "lifestyle_income_cash": {
      const ls = await getLifestyleMonthForAgent(year, month);
      return ls.incomeCash;
    }
    case "category_cash_actual": {
      if (!claim.categoryId) return null;
      const ls = await getLifestyleMonthForAgent(year, month);
      const row = ls.rows.find((r) => r.categoryId === claim.categoryId);
      return row?.cashActual ?? null;
    }
    case "category_cash_plan": {
      if (!claim.categoryId) return null;
      const ls = await getLifestyleMonthForAgent(year, month);
      const row = ls.rows.find((r) => r.categoryId === claim.categoryId);
      return row?.cashPlan ?? null;
    }
    case "bill_amount": {
      if (!claim.billId) return null;
      const bill = await prisma.bill.findUnique({ where: { id: claim.billId } });
      return bill ? moneyOf(bill.amount) : null;
    }
    case "tax_remaining": {
      const t = await getTripsAndTaxesForAgent(year);
      return t.taxEstimate?.remaining ?? null;
    }
    case "tax_total": {
      const t = await getTripsAndTaxesForAgent(year);
      return t.taxEstimate?.totalTax ?? null;
    }
    case "tax_federal_total": {
      const t = await getTripsAndTaxesForAgent(year);
      return t.taxEstimate?.federalTotalTax ?? null;
    }
    case "tax_ca_total": {
      const t = await getTripsAndTaxesForAgent(year);
      return t.taxEstimate?.californiaTotalTax ?? null;
    }
    default:
      return null;
  }
}

export async function upsertBudgetPlanWithConfidence(input: {
  categoryId: string;
  year: number;
  month: number;
  cashPlan: number;
  confidence: number;
  reason: string;
  runId?: string;
}) {
  const cat = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { id: true, name: true },
  });
  if (!cat) return { ok: false as const, error: "Unknown category" };

  const cashPlan = money(input.cashPlan);

  const budget = await prisma.budget.upsert({
    where: { year_month: { year: input.year, month: input.month } },
    create: { year: input.year, month: input.month },
    update: {},
  });
  const existing = await prisma.budgetLine.findUnique({
    where: {
      budgetId_categoryId: {
        budgetId: budget.id,
        categoryId: input.categoryId,
      },
    },
  });
  const previousCashPlan = money(existing?.cashPlan ?? 0);
  const apply = input.confidence >= CONFIDENCE_AUTO;

  let persistedCashPlan = previousCashPlan;
  if (apply) {
    const line = await prisma.budgetLine.upsert({
      where: {
        budgetId_categoryId: {
          budgetId: budget.id,
          categoryId: input.categoryId,
        },
      },
      create: {
        budgetId: budget.id,
        categoryId: input.categoryId,
        cashPlan,
        reviewed: true,
      },
      update: { cashPlan, reviewed: true },
    });
    persistedCashPlan = money(line.cashPlan);
  }

  const insight = await createInsight({
    kind: "budget_gap",
    title: apply
      ? `Updated ${cat.name} plan to $${Math.round(persistedCashPlan)}`
      : `Suggested ${cat.name} plan $${Math.round(cashPlan)}`,
    body: input.reason,
    categoryId: cat.id,
    confidence: input.confidence,
    status: apply ? "applied" : "proposed",
    runId: input.runId,
    payload: {
      year: input.year,
      month: input.month,
      categoryId: cat.id,
      cashPlan,
      cashPlanCents: moneyOf(cashPlan).cents,
      previousCashPlan,
      previousCashPlanCents: moneyOf(previousCashPlan).cents,
      applied: apply,
    },
  });

  return toolPayload("upsertBudgetPlanWithConfidence", {
    ok: true as const,
    applied: apply,
    insightId: insight.id,
    previousCashPlan: moneyOf(previousCashPlan),
    cashPlan: moneyOf(apply ? persistedCashPlan : cashPlan),
  });
}

export async function categorizeWithConfidence(input: {
  updates: { transactionId: string; categoryId: string }[];
  confidence: number;
  reason: string;
  runId?: string;
}) {
  const uncategorized = await prisma.category.findUnique({
    where: { slug: "uncategorized" },
    select: { id: true },
  });
  const apply = input.confidence >= CONFIDENCE_AUTO;
  const appliedIds: string[] = [];
  const skipped: string[] = [];
  const previousCategories: {
    transactionId: string;
    previousCategoryId: string | null;
  }[] = [];
  const appliedDetails: {
    transactionId: string;
    categoryId: string;
    categoryName: string;
  }[] = [];

  for (const u of input.updates) {
    const txn = await prisma.transaction.findUnique({
      where: { id: u.transactionId },
      include: { category: { select: { slug: true } } },
    });
    if (!txn) {
      skipped.push(u.transactionId);
      continue;
    }
    const isInbox =
      !txn.categoryId ||
      txn.categoryId === uncategorized?.id ||
      txn.category?.slug === "uncategorized";
    if (!isInbox) {
      skipped.push(u.transactionId);
      continue;
    }
    if (apply) {
      previousCategories.push({
        transactionId: txn.id,
        previousCategoryId: txn.categoryId,
      });
      await prisma.transaction.update({
        where: { id: txn.id },
        data: { categoryId: u.categoryId },
      });
      const cat = await prisma.category.findUnique({
        where: { id: u.categoryId },
        select: { id: true, name: true },
      });
      appliedIds.push(txn.id);
      if (cat) {
        appliedDetails.push({
          transactionId: txn.id,
          categoryId: cat.id,
          categoryName: cat.name,
        });
      }
      const fp = fingerprintMemo(txn.memo);
      await prisma.agentCategoryMemory.upsert({
        where: { fingerprint: fp },
        create: {
          fingerprint: fp,
          categoryId: u.categoryId,
          hitCount: 1,
          lastConfidence: input.confidence,
          sampleMemo: txn.memo,
        },
        update: {
          categoryId: u.categoryId,
          hitCount: { increment: 1 },
          lastConfidence: input.confidence,
          sampleMemo: txn.memo,
        },
      });
    }
  }

  const insight = await createInsight({
    kind: "category_suggest",
    title: apply
      ? `Categorized ${appliedIds.length} inbox transaction(s)`
      : `Suggested categories for ${input.updates.length} transaction(s)`,
    body: input.reason,
    confidence: input.confidence,
    status: apply ? "applied" : "proposed",
    runId: input.runId,
    payload: {
      updates: input.updates,
      appliedIds,
      skipped,
      previousCategories,
      applied: apply,
    },
  });

  if (apply && appliedIds.length > 0) {
    revalidateFinanceSpend(getUserId());
  }

  return toolPayload("categorizeWithConfidence", {
    ok: true as const,
    applied: apply,
    appliedCount: appliedIds.length,
    skippedCount: skipped.length,
    insightId: insight.id,
    appliedDetails,
  });
}

/**
 * Rebuild AgentCategoryMemory from already-categorized register lines
 * so daily passes learn from Xero/history without waiting for manual edits.
 */
export async function rebuildCategoryMemoryFromHistory() {
  const uncategorized = await prisma.category.findUnique({
    where: { slug: "uncategorized" },
    select: { id: true },
  });
  const rows = await prisma.transaction.findMany({
    where: {
      pending: false,
      categoryId: { not: null },
      ...(uncategorized
        ? { NOT: { categoryId: uncategorized.id } }
        : {}),
    },
    select: { memo: true, categoryId: true },
  });

  let upserted = 0;
  const exactTallies = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const fp = fingerprintMemo(r.memo);
    if (!fp || fp === "unknown" || !r.categoryId) continue;
    let m = exactTallies.get(fp);
    if (!m) {
      m = new Map();
      exactTallies.set(fp, m);
    }
    m.set(r.categoryId, (m.get(r.categoryId) ?? 0) + 1);
  }

  for (const [fingerprint, votes] of exactTallies) {
    let topId: string | null = null;
    let topCount = 0;
    for (const [categoryId, count] of votes) {
      if (count > topCount) {
        topId = categoryId;
        topCount = count;
      }
    }
    if (!topId) continue;
    const sample = rows.find(
      (r) => fingerprintMemo(r.memo) === fingerprint && r.categoryId === topId,
    );
    await prisma.agentCategoryMemory.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        categoryId: topId,
        hitCount: topCount,
        lastConfidence: topCount >= 2 ? 0.95 : 0.9,
        sampleMemo: sample?.memo ?? fingerprint,
      },
      update: {
        categoryId: topId,
        hitCount: topCount,
        lastConfidence: topCount >= 2 ? 0.95 : 0.9,
        sampleMemo: sample?.memo ?? fingerprint,
      },
    });
    upserted += 1;
  }

  return { categorizedRows: rows.length, memoryEntries: upserted };
}

/** Match inbox txns via memory, Xero/history merchant keys, and rules; auto-apply ≥ 0.85. */
export async function runDailyCategorizePass(
  runId?: string,
  opts?: { limit?: number; rebuildMemory?: boolean },
) {
  if (opts?.rebuildMemory !== false) {
    await rebuildCategoryMemoryFromHistory();
  }

  const uncategorized = await prisma.category.findUnique({
    where: { slug: "uncategorized" },
    select: { id: true },
  });

  const limit = opts?.limit ?? 500;
  const inboxRows = await prisma.transaction.findMany({
    where: {
      pending: false,
      OR: [
        { categoryId: null },
        ...(uncategorized ? [{ categoryId: uncategorized.id }] : []),
      ],
    },
    select: {
      id: true,
      memo: true,
      type: true,
      categoryId: true,
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: limit,
  });

  const categories = await prisma.category.findMany({
    where: { isArchived: false },
    select: { id: true, slug: true, name: true },
  });
  const slugToId = new Map(categories.map((c) => [c.slug, c.id]));
  const idToSlug = new Map(categories.map((c) => [c.id, c.slug]));
  const transfersId = slugToId.get("transfers");
  const ccPaymentsId = slugToId.get("credit-card-payments");
  const transferCategoryIds = new Set(
    [transfersId, ccPaymentsId].filter(Boolean) as string[],
  );

  // Don't let Transfers poison merchant history (e.g. Target → Transfers).
  // Transfer matching still comes from explicit merchant rules.
  const historyExcludeIds = [
    ...(uncategorized ? [uncategorized.id] : []),
    ...transferCategoryIds,
  ];
  const historyRows = await prisma.transaction.findMany({
    where: {
      pending: false,
      categoryId:
        historyExcludeIds.length > 0
          ? { notIn: historyExcludeIds }
          : { not: null },
    },
    select: { memo: true, categoryId: true },
  });
  const history = buildMerchantHistoryIndex(
    historyRows.map((r) => ({
      memo: r.memo,
      categoryId: r.categoryId!,
    })),
  );

  const memory = await prisma.agentCategoryMemory.findMany();
  const byFp = new Map(memory.map((m) => [m.fingerprint, m]));

  const updates: { transactionId: string; categoryId: string }[] = [];
  const typeUpdates: { transactionId: string; type: string }[] = [];
  let confidence = 1;
  const reasons: string[] = [];

  const matchedIds = new Set<string>();

  for (const t of inboxRows) {
    const fp = fingerprintMemo(t.memo);
    const mem = byFp.get(fp);
    if (mem && mem.hitCount >= 1 && mem.lastConfidence >= CONFIDENCE_AUTO) {
      const memSlug = idToSlug.get(mem.categoryId);
      const transferMem =
        transferCategoryIds.has(mem.categoryId) ||
        memSlug === "transfers" ||
        memSlug === "credit-card-payments";
      if (!transferMem || looksLikeTransferMemo(t.memo)) {
        updates.push({ transactionId: t.id, categoryId: mem.categoryId });
        matchedIds.add(t.id);
        confidence = Math.min(confidence, mem.lastConfidence);
        continue;
      }
    }

    const matched = matchMerchantCategory({
      memo: t.memo,
      history,
      slugToId,
      idToSlug,
    });
    if (
      matched?.categoryId &&
      matched.confidence >= CONFIDENCE_AUTO
    ) {
      updates.push({
        transactionId: t.id,
        categoryId: matched.categoryId,
      });
      matchedIds.add(t.id);
      confidence = Math.min(confidence, matched.confidence);
      if (matched.type && matched.type !== t.type) {
        typeUpdates.push({ transactionId: t.id, type: matched.type });
      }
      if (reasons.length < 8) reasons.push(matched.reason);
    }
  }

  // Cheap LLM fallback for leftover unique merchants (one batched call).
  const leftover = inboxRows.filter((t) => !matchedIds.has(t.id));
  if (leftover.length > 0) {
    const byKey = new Map<string, { key: string; sampleMemo: string; ids: string[] }>();
    for (const t of leftover) {
      const key = fingerprintMemo(t.memo);
      const cur = byKey.get(key) ?? {
        key,
        sampleMemo: t.memo ?? key,
        ids: [],
      };
      cur.ids.push(t.id);
      byKey.set(key, cur);
    }
    const { suggestCategoriesWithLlm } = await import("@/lib/finance/merchant-llm");
    const llmCatalog = categories.filter(
      (c) => c.slug !== "transfers" && c.slug !== "credit-card-payments",
    );
    const llm = await suggestCategoriesWithLlm({
      items: [...byKey.values()].map((v) => ({
        key: v.key,
        sampleMemo: v.sampleMemo,
      })),
      categories: llmCatalog.map((c) => ({
        slug: c.slug,
        name: c.name,
      })),
    });
    if (llm.ok) {
      for (const s of llm.suggestions) {
        // Real categories need ≥0.85; miscellaneous long-tail may clear at ≥0.6
        // so obscure one-off merchants (e.g. foreign person-name charges) don't stall reconcile.
        const ok =
          s.confidence >= CONFIDENCE_AUTO ||
          (s.categorySlug === "miscellaneous" && s.confidence >= 0.6) ||
          s.confidence >= 0.8;
        if (!ok) continue;
        if (
          s.categorySlug === "transfers" ||
          s.categorySlug === "credit-card-payments"
        ) {
          continue;
        }
        const categoryId = slugToId.get(s.categorySlug);
        if (!categoryId) continue;
        const group = byKey.get(s.key);
        if (!group) continue;
        for (const id of group.ids) {
          if (matchedIds.has(id)) continue;
          updates.push({ transactionId: id, categoryId });
          matchedIds.add(id);
        }
        confidence = Math.min(
          confidence,
          Math.max(s.confidence, CONFIDENCE_AUTO),
        );
        if (reasons.length < 8) {
          reasons.push(
            `LLM mapped "${s.key}" → ${s.categorySlug} (${s.confidence}).`,
          );
        }
      }
    } else if (reasons.length < 8 && llm.skippedReason) {
      reasons.push(`LLM skipped: ${llm.skippedReason}`);
    }
  }

  if (updates.length === 0) {
    const insight = await createInsight({
      kind: "run_summary",
      title: "Daily categorize: nothing to apply",
      body: `Checked ${inboxRows.length} inbox transaction(s); no strong memory/history/rule matches.`,
      confidence: 1,
      status: "applied",
      runId,
      payload: { inboxCount: inboxRows.length },
    });
    return { inboxCount: inboxRows.length, appliedCount: 0, insightId: insight.id };
  }

  const result = await categorizeWithConfidence({
    updates,
    confidence: Math.max(confidence, CONFIDENCE_AUTO),
    reason:
      reasons.length > 0
        ? reasons.join(" ")
        : "Matched merchant keys from category memory / prior history / rules.",
    runId,
  });

  for (const u of typeUpdates) {
    if (!result.appliedDetails.some((d) => d.transactionId === u.transactionId)) {
      continue;
    }
    await prisma.transaction.update({
      where: { id: u.transactionId },
      data: { type: u.type },
    });
  }

  return {
    inboxCount: inboxRows.length,
    appliedCount: result.appliedCount,
    insightId: result.insightId,
  };
}

/** 3-month median spend → cashPlan for lifestyle categories with low variance. */
export async function runWeeklyBudgetReview(runId?: string) {
  const { year, month } = currentYearMonth();
  const months: { year: number; month: number }[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(year, month - 1 - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  const monthlyByCat = new Map<string, number[]>();
  const names = new Map<string, string>();

  for (const m of months) {
    const { start, end } = monthBounds(m.year, m.month);
    const txns = await prisma.transaction.findMany({
      where: {
        date: { gte: start, lt: end },
        type: { in: ["expense", "tax_payment"] },
        categoryId: { not: null },
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            group: { select: { kind: true } },
          },
        },
      },
    });
    const totals = new Map<string, number>();
    for (const t of txns) {
      if (!t.category || t.category.slug === "uncategorized") continue;
      if (t.category.group.kind !== "lifestyle") continue;
      const amt = Math.abs(Math.min(t.amount, 0));
      totals.set(t.categoryId!, (totals.get(t.categoryId!) ?? 0) + amt);
      names.set(t.categoryId!, t.category.name);
    }
    for (const [catId, total] of totals) {
      const list = monthlyByCat.get(catId) ?? [];
      list.push(total);
      monthlyByCat.set(catId, list);
    }
  }

  const lifestyle = await computeMonthLifestyle(year, month);
  const planByCat = new Map(lifestyle.rows.map((r) => [r.categoryId, r.cashPlan]));

  let applied = 0;
  let proposed = 0;
  const details: string[] = [];

  for (const [categoryId, amounts] of monthlyByCat) {
    if (amounts.length < 3) continue;
    const med = median(amounts);
    if (med <= 0) continue;
    const cv = Math.sqrt(variance(amounts)) / med;
    const confidence =
      cv <= 0.25 ? 0.92 : cv <= 0.4 ? 0.8 : 0.65;
    const rounded = money(Math.round(med));
    const current = money(planByCat.get(categoryId) ?? 0);
    if (Math.abs(current - rounded) < 5) continue;

    const name = names.get(categoryId) ?? categoryId;
    const reason = `3-month median spend $${rounded} (months: ${amounts
      .map((a) => `$${Math.round(a)}`)
      .join(", ")}). Coefficient of variation ${cv.toFixed(2)}.`;

    const result = await upsertBudgetPlanWithConfidence({
      categoryId,
      year,
      month,
      cashPlan: rounded,
      confidence,
      reason,
      runId,
    });
    if (result.ok && result.applied) {
      applied += 1;
      details.push(`Applied ${name}: $${current} → $${rounded}`);
    } else {
      proposed += 1;
      details.push(`Proposed ${name}: $${rounded} (was $${current})`);
    }

    if (current > 0 && med < current * 0.6 && current - med >= 40) {
      await createInsight({
        kind: "savings",
        title: `Possible cut: ${name}`,
        body: `You planned $${Math.round(current)}/mo but median spend is $${rounded}. Consider lowering the plan or reclaiming ~$${Math.round(current - rounded)}.`,
        categoryId,
        confidence: 0.7,
        status: "proposed",
        runId,
        payload: {
          current,
          currentCents: moneyOf(current).cents,
          median: rounded,
          medianCents: moneyOf(rounded).cents,
        },
      });
    }
  }

  const summary = await createInsight({
    kind: "run_summary",
    title: `Weekly budget review · ${year}-${String(month).padStart(2, "0")}`,
    body:
      details.length > 0
        ? details.join("\n")
        : "No budget changes — plans already match recent spend.",
    confidence: 1,
    status: "applied",
    runId,
    payload: { applied, proposed, months },
  });

  return { applied, proposed, insightId: summary.id };
}

/** Sync every linked Plaid item; per-item failures are collected, not thrown. */
export async function syncAllPlaidItems(opts?: {
  /** When true (default for API/manual), soft-refresh then sync. Cron passes false. */
  allowRefresh?: boolean;
  forceRefresh?: boolean;
}) {
  const { ensurePlaidItemFresh, syncPlaidItem } = await import(
    "@/lib/finance/plaid-sync"
  );
  const allowRefresh = opts?.allowRefresh !== false;
  const items = await prisma.plaidItem.findMany({
    select: { id: true, institutionName: true },
    orderBy: { createdAt: "asc" },
  });
  const results: {
    id: string;
    institutionName: string;
    ok: boolean;
    added?: number;
    modified?: number;
    removed?: number;
    refreshed?: boolean;
    refreshSkipped?: string | null;
    error?: string;
  }[] = [];

  for (const item of items) {
    try {
      const sync = allowRefresh
        ? await ensurePlaidItemFresh(item.id, {
            forceRefresh: opts?.forceRefresh,
            allowRefresh: true,
          })
        : await syncPlaidItem(item.id);
      results.push({
        id: item.id,
        institutionName: item.institutionName ?? "Unknown",
        ok: true,
        ...sync,
      });
    } catch (err) {
      // syncPlaidItem / ensure already sets plaid_items.status (login_required / error)
      results.push({
        id: item.id,
        institutionName: item.institutionName ?? "Unknown",
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    itemCount: items.length,
    okCount: results.filter((r) => r.ok).length,
    failCount: results.filter((r) => !r.ok).length,
    results,
  };
}

/**
 * Auto-clear high-confidence uncleared lines (categorized + trust signal).
 * Does not invent categories; never clears inbox/pending.
 */
export async function runDailyReconcilePass(
  runId?: string,
  opts?: { limit?: number },
) {
  const {
    isAutoClearEligible,
    setTransactionsReconciled,
    AUTO_CLEAR_CONFIDENCE,
  } = await import("@/lib/finance/reconcile-clear");

  const limit = opts?.limit ?? 500;
  const now = new Date();
  const uncategorized = await prisma.category.findUnique({
    where: { slug: "uncategorized" },
    select: { id: true },
  });
  const uncategorizedId = uncategorized?.id ?? null;

  const candidates = await prisma.transaction.findMany({
    where: {
      pending: false,
      reconciledAt: null,
      account: { isActive: true, type: { in: ["bank", "credit"] } },
    },
    select: {
      id: true,
      accountId: true,
      date: true,
      amount: true,
      type: true,
      plaidTxnId: true,
      categoryId: true,
      category: { select: { slug: true } },
      account: { select: { name: true } },
    },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    take: limit,
  });

  const eligibleIds = candidates
    .filter((t) =>
      isAutoClearEligible({
        pending: false,
        reconciledAt: null,
        categoryId: t.categoryId,
        categorySlug: t.category?.slug ?? null,
        uncategorizedId,
        type: t.type,
        plaidTxnId: t.plaidTxnId,
        date: t.date,
        now,
      }),
    )
    .map((t) => t.id);

  const { updated: clearedCount } = await setTransactionsReconciled(
    eligibleIds,
    true,
    { requireCategorized: true },
  );

  const wallets = await prisma.account.findMany({
    where: { isActive: true, type: { in: ["bank", "credit"] } },
    select: { id: true, name: true, balance: true },
  });

  const varianceInsights: {
    accountId: string;
    name: string;
    variance: number;
    unclearedCount: number;
    insightId: string;
  }[] = [];

  for (const wallet of wallets) {
    const uncleared = await prisma.transaction.findMany({
      where: {
        accountId: wallet.id,
        pending: false,
        reconciledAt: null,
      },
      select: { amount: true },
    });
    const variance = uncleared.reduce((s, t) => s + t.amount, 0);
    if (Math.abs(variance) <= 1) continue;

    const insight = await createInsight({
      kind: "category_suggest",
      title: `Reconcile review · ${wallet.name}`,
      body: `${wallet.name} still has ${uncleared.length} uncleared line(s); books variance vs statement is ${variance.toFixed(2)} (statement ${wallet.balance.toFixed(2)}). Review on the wallet Reconcile screen.`,
      confidence: AUTO_CLEAR_CONFIDENCE,
      status: "proposed",
      runId,
      payload: {
        accountId: wallet.id,
        accountName: wallet.name,
        variance,
        unclearedCount: uncleared.length,
        statementBalance: wallet.balance,
      },
    });
    varianceInsights.push({
      accountId: wallet.id,
      name: wallet.name,
      variance,
      unclearedCount: uncleared.length,
      insightId: insight.id,
    });
  }

  const summary = await createInsight({
    kind: "run_summary",
    title: "Daily reconcile: auto-clear",
    body: `Checked ${candidates.length} uncleared line(s); cleared ${clearedCount}. ${varianceInsights.length} wallet(s) still need review.`,
    confidence: 1,
    status: "applied",
    runId,
    payload: {
      checked: candidates.length,
      clearedCount,
      skipped: candidates.length - eligibleIds.length,
      varianceWallets: varianceInsights.map((v) => ({
        accountId: v.accountId,
        name: v.name,
        variance: v.variance,
        unclearedCount: v.unclearedCount,
      })),
    },
  });

  return {
    checked: candidates.length,
    clearedCount,
    skipped: candidates.length - eligibleIds.length,
    varianceInsights,
    insightId: summary.id,
  };
}

/** Sync Plaid → categorize inbox → auto-clear high-confidence lines. */
export async function runDailyBooksPass(
  runId?: string,
  opts?: { reconcileLimit?: number; skipPlaidSync?: boolean },
) {
  const id = runId ?? `books-${Date.now()}`;
  const sync = opts?.skipPlaidSync
    ? {
        itemCount: 0,
        okCount: 0,
        failCount: 0,
        results: [] as Awaited<ReturnType<typeof syncAllPlaidItems>>["results"],
        skipped: true as const,
      }
    : {
        ...(await syncAllPlaidItems({ allowRefresh: false })),
        skipped: false as const,
      };

  const categorize = await runDailyCategorizePass(id, {
    limit: opts?.reconcileLimit ?? 500,
    rebuildMemory: true,
  });
  const reconcile = await runDailyReconcilePass(id, {
    limit: opts?.reconcileLimit ?? 500,
  });

  const summary = await createInsight({
    kind: "run_summary",
    title: "Daily books pass",
    body: [
      sync.skipped
        ? "Plaid sync skipped."
        : `Plaid: ${sync.okCount}/${sync.itemCount} item(s) ok.`,
      `Categorize: applied ${categorize.appliedCount} of ${categorize.inboxCount} inbox.`,
      `Reconcile: cleared ${reconcile.clearedCount} of ${reconcile.checked} uncleared.`,
    ].join(" "),
    confidence: 1,
    status: "applied",
    runId: id,
    payload: { sync, categorize, reconcile },
  });

  return { runId: id, sync, categorize, reconcile, insightId: summary.id };
}
