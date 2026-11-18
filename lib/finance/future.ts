import { format } from "date-fns";
import {
  DOCUMENT_KIND_LABELS,
  shouldShowDocumentInUpcoming,
  type DocumentKind,
} from "@/lib/finance/documents";
import { computeMonthLifestyle } from "@/lib/finance/lifestyle";
import { currentYearMonth, formatMoney, formatPercent } from "@/lib/finance/money";
import { computeNetWorth } from "@/lib/finance/net-worth";
import { prisma } from "@/lib/finance/prisma";
import { estimateDueDates, estimateTaxes } from "@/lib/finance/tax-estimator";
import { defaultTaxYear } from "@/lib/finance/tax/year";
import {
  isUpcomingTrip,
  plannedTotal,
} from "@/lib/finance/trips";
import {
  annualLifestyleNeed,
  billMonthlyEquivalent,
  projectCompounding,
  requiredPortfolioForPassiveIncome,
  type CompoundingYearPoint,
  type FuturePayload,
  type FuturePlanSettings,
  type FutureUpcomingItem,
  type StrategyKey,
  type UpsertFuturePlanInput,
  getStrategyPreset,
  STRATEGY_PRESETS,
} from "@/lib/finance/future-math";

export * from "@/lib/finance/future-math";

const DEFAULT_PLAN: FuturePlanSettings = {
  slug: "default",
  desiredMonthlyLifestyle: null,
  monthlyContribution: 0,
  strategyKey: "balanced",
  expectedReturnRate: 0.07,
  inflationRate: 0.025,
  withdrawalRate: 0.04,
  horizonYears: 25,
  includeCashInPortfolio: false,
  taxBufferPercent: 0.15,
  notes: null,
};

function clampRate(n: number, min = 0, max = 0.5) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function clampHorizon(n: number) {
  if (!Number.isFinite(n)) return 25;
  return Math.min(60, Math.max(1, Math.trunc(n)));
}

export function normalizeFuturePlanInput(
  input: UpsertFuturePlanInput,
  current?: FuturePlanSettings,
): FuturePlanSettings {
  const base = current ?? DEFAULT_PLAN;
  let strategyKey = (input.strategyKey ?? base.strategyKey) as StrategyKey;
  if (!STRATEGY_PRESETS.some((p) => p.key === strategyKey)) {
    strategyKey = "balanced";
  }

  const preset = getStrategyPreset(strategyKey);
  const usePresetRates = strategyKey !== "custom";

  const desired =
    input.desiredMonthlyLifestyle === undefined
      ? base.desiredMonthlyLifestyle
      : input.desiredMonthlyLifestyle == null ||
          !Number.isFinite(input.desiredMonthlyLifestyle)
        ? null
        : Math.max(0, input.desiredMonthlyLifestyle);

  return {
    slug: "default",
    desiredMonthlyLifestyle: desired,
    monthlyContribution: Math.max(
      0,
      input.monthlyContribution ?? base.monthlyContribution,
    ),
    strategyKey,
    expectedReturnRate: usePresetRates
      ? preset.expectedReturnRate
      : clampRate(input.expectedReturnRate ?? base.expectedReturnRate),
    inflationRate: usePresetRates
      ? preset.inflationRate
      : clampRate(input.inflationRate ?? base.inflationRate, 0, 0.2),
    withdrawalRate: usePresetRates
      ? preset.withdrawalRate
      : clampRate(input.withdrawalRate ?? base.withdrawalRate, 0.005, 0.2),
    horizonYears: clampHorizon(input.horizonYears ?? base.horizonYears),
    includeCashInPortfolio:
      input.includeCashInPortfolio ?? base.includeCashInPortfolio,
    taxBufferPercent: clampRate(
      input.taxBufferPercent ?? base.taxBufferPercent,
      0,
      1,
    ),
    notes:
      input.notes === undefined
        ? base.notes
        : input.notes?.trim() || null,
  };
}

export async function getOrCreateFuturePlan(): Promise<FuturePlanSettings> {
  const existing = await prisma.futurePlan.findUnique({
    where: { slug: "default" },
  });
  if (existing) {
    return {
      slug: existing.slug,
      desiredMonthlyLifestyle: existing.desiredMonthlyLifestyle,
      monthlyContribution: existing.monthlyContribution,
      strategyKey: (STRATEGY_PRESETS.some((p) => p.key === existing.strategyKey)
        ? existing.strategyKey
        : "balanced") as StrategyKey,
      expectedReturnRate: existing.expectedReturnRate,
      inflationRate: existing.inflationRate,
      withdrawalRate: existing.withdrawalRate,
      horizonYears: existing.horizonYears,
      includeCashInPortfolio: existing.includeCashInPortfolio,
      taxBufferPercent: existing.taxBufferPercent,
      notes: existing.notes,
    };
  }

  const created = await prisma.futurePlan.create({
    data: {
      slug: "default",
      monthlyContribution: 0,
      strategyKey: "balanced",
      expectedReturnRate: 0.07,
      inflationRate: 0.025,
      withdrawalRate: 0.04,
      horizonYears: 25,
      includeCashInPortfolio: false,
      taxBufferPercent: 0.15,
    },
  });

  return {
    slug: created.slug,
    desiredMonthlyLifestyle: created.desiredMonthlyLifestyle,
    monthlyContribution: created.monthlyContribution,
    strategyKey: "balanced",
    expectedReturnRate: created.expectedReturnRate,
    inflationRate: created.inflationRate,
    withdrawalRate: created.withdrawalRate,
    horizonYears: created.horizonYears,
    includeCashInPortfolio: created.includeCashInPortfolio,
    taxBufferPercent: created.taxBufferPercent,
    notes: created.notes,
  };
}

export async function upsertFuturePlanRecord(
  input: UpsertFuturePlanInput,
): Promise<FuturePlanSettings> {
  const current = await getOrCreateFuturePlan();
  const next = normalizeFuturePlanInput(input, current);
  const saved = await prisma.futurePlan.upsert({
    where: { slug: "default" },
    create: {
      slug: "default",
      desiredMonthlyLifestyle: next.desiredMonthlyLifestyle,
      monthlyContribution: next.monthlyContribution,
      strategyKey: next.strategyKey,
      expectedReturnRate: next.expectedReturnRate,
      inflationRate: next.inflationRate,
      withdrawalRate: next.withdrawalRate,
      horizonYears: next.horizonYears,
      includeCashInPortfolio: next.includeCashInPortfolio,
      taxBufferPercent: next.taxBufferPercent,
      notes: next.notes,
    },
    update: {
      desiredMonthlyLifestyle: next.desiredMonthlyLifestyle,
      monthlyContribution: next.monthlyContribution,
      strategyKey: next.strategyKey,
      expectedReturnRate: next.expectedReturnRate,
      inflationRate: next.inflationRate,
      withdrawalRate: next.withdrawalRate,
      horizonYears: next.horizonYears,
      includeCashInPortfolio: next.includeCashInPortfolio,
      taxBufferPercent: next.taxBufferPercent,
      notes: next.notes,
    },
  });

  return {
    slug: saved.slug,
    desiredMonthlyLifestyle: saved.desiredMonthlyLifestyle,
    monthlyContribution: saved.monthlyContribution,
    strategyKey: next.strategyKey,
    expectedReturnRate: saved.expectedReturnRate,
    inflationRate: saved.inflationRate,
    withdrawalRate: saved.withdrawalRate,
    horizonYears: saved.horizonYears,
    includeCashInPortfolio: saved.includeCashInPortfolio,
    taxBufferPercent: saved.taxBufferPercent,
    notes: saved.notes,
  };
}

function milestoneIndexes(horizon: number, crossoverYearIndex: number | null) {
  const wanted = new Set([1, 3, 5, 10, 15, 20, 25, 30, horizon]);
  if (crossoverYearIndex != null && crossoverYearIndex > 0) {
    wanted.add(crossoverYearIndex);
  }
  return [...wanted]
    .filter((i) => i > 0 && i <= horizon)
    .sort((a, b) => a - b);
}

export async function buildFuturePayload(): Promise<FuturePayload> {
  const now = new Date();
  const { year, month } = currentYearMonth(now);
  const taxYear = defaultTaxYear(now);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const in30 = new Date(startOfToday);
  in30.setDate(in30.getDate() + 30);

  const [
    plan,
    netWorth,
    lifestyle,
    bills,
    trips,
    prescriptions,
    appointments,
    visionSupplies,
    personalDocuments,
    incomeSources,
    tax,
  ] = await Promise.all([
    getOrCreateFuturePlan(),
    computeNetWorth(year),
    computeMonthLifestyle(year, month),
    prisma.bill.findMany({
      where: { isActive: true, amount: { gt: 0 } },
      include: { category: { select: { name: true } } },
      orderBy: [{ nextDate: "asc" }, { name: "asc" }],
    }),
    prisma.trip.findMany({
      include: { lines: true },
      orderBy: [{ startDate: "asc" }, { name: "asc" }],
      take: 20,
    }),
    prisma.prescription.findMany({
      where: { isActive: true, nextRefillDate: { not: null } },
      orderBy: { nextRefillDate: "asc" },
    }),
    prisma.appointment.findMany({
      where: {
        status: { in: ["planned", "scheduled"] },
        scheduledAt: { not: null },
      },
      include: { series: { select: { domain: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.visionSupply.findMany({
      where: { isActive: true, nextOrderDate: { not: null } },
      orderBy: { nextOrderDate: "asc" },
    }),
    prisma.personalDocument.findMany({
      where: { renewsOn: { not: null } },
      orderBy: { renewsOn: "asc" },
    }),
    prisma.incomeSource.findMany({
      where: { isActive: true },
    }),
    estimateTaxes(taxYear).catch(() => null),
  ]);

  const lifestylePlanMonthly = lifestyle.rows
    .filter((r) => r.groupKind === "lifestyle")
    .reduce((s, r) => s + r.cashPlan, 0);

  const billsMonthlyBurn = bills.reduce(
    (s, b) => s + billMonthlyEquivalent(b.amount, b.cadence),
    0,
  );

  const targetMonthly =
    plan.desiredMonthlyLifestyle != null && plan.desiredMonthlyLifestyle > 0
      ? plan.desiredMonthlyLifestyle
      : lifestylePlanMonthly > 0
        ? lifestylePlanMonthly
        : billsMonthlyBurn;

  const targetAnnual = targetMonthly * 12;
  const targetAnnualGross = annualLifestyleNeed(
    targetMonthly,
    plan.taxBufferPercent,
  );
  const requiredNestEgg = requiredPortfolioForPassiveIncome(
    targetAnnualGross,
    plan.withdrawalRate,
  );

  const investments = netWorth.composition.investments;
  const cash = netWorth.composition.cash;
  const startingPortfolio = plan.includeCashInPortfolio
    ? investments + cash
    : investments;

  const gap = Math.max(0, requiredNestEgg - startingPortfolio);
  const fundedPercent =
    requiredNestEgg > 0
      ? Math.min(1, startingPortfolio / requiredNestEgg)
      : startingPortfolio > 0
        ? 1
        : 0;
  const currentPassiveMonthly = (startingPortfolio * plan.withdrawalRate) / 12;
  const alreadyIndependent =
    requiredNestEgg <= 0 || startingPortfolio >= requiredNestEgg;

  const projection = projectCompounding({
    startingPortfolio,
    monthlyContribution: plan.monthlyContribution,
    nominalReturn: plan.expectedReturnRate,
    inflationRate: plan.inflationRate,
    withdrawalRate: plan.withdrawalRate,
    annualNeed: targetAnnualGross,
    horizonYears: plan.horizonYears,
    startCalendarYear: year,
  });

  const crossoverIndex =
    projection.crossoverYearReal != null
      ? projection.crossoverYearReal - year
      : null;
  const milestones = milestoneIndexes(plan.horizonYears, crossoverIndex)
    .map((idx) => projection.series.find((p) => p.yearIndex === idx))
    .filter((p): p is CompoundingYearPoint => Boolean(p))
    .map((p) => ({
      yearIndex: p.yearIndex,
      year: p.year,
      nominalBalanceLabel: formatMoney(p.nominalBalance),
      realBalanceLabel: formatMoney(p.realBalance),
      sustainableMonthlyLabel: formatMoney(p.sustainableMonthlyIncome),
      coversLifestyle: p.coversLifestyle,
    }));

  const upcoming: FutureUpcomingItem[] = [];
  const farFuture = Number.MAX_SAFE_INTEGER;

  for (const b of bills) {
    if (b.nextDate && b.nextDate < startOfToday) continue;
    upcoming.push({
      id: `bill-${b.id}`,
      kind: "bill",
      title: b.name,
      detail: [
        b.nextDate ? format(b.nextDate, "MMM d, yyyy") : b.cadence,
        b.category.name,
      ]
        .filter(Boolean)
        .join(" · "),
      date: b.nextDate?.toISOString() ?? null,
      dateLabel: b.nextDate ? format(b.nextDate, "MMM d, yyyy") : null,
      amount: b.amount,
      amountLabel: formatMoney(b.amount),
      href: "/bills",
    });
  }

  const dues = estimateDueDates(taxYear).filter(
    (d) => d.federal >= startOfToday,
  );
  const quartersLeft = Math.max(dues.length, 1);
  const taxAmountPer = tax != null ? tax.remaining / quartersLeft : null;
  for (const d of dues) {
    upcoming.push({
      id: `tax-${d.quarter}`,
      kind: "tax",
      title: `${d.label} estimated tax`,
      detail: `Federal ${format(d.federal, "MMM d, yyyy")} · CA ${format(d.ca, "MMM d, yyyy")}`,
      date: d.federal.toISOString(),
      dateLabel: format(d.federal, "MMM d, yyyy"),
      amount: taxAmountPer,
      amountLabel: taxAmountPer != null ? formatMoney(taxAmountPer) : null,
      href: `/taxes?year=${taxYear}`,
    });
  }

  for (const t of trips.filter(isUpcomingTrip)) {
    upcoming.push({
      id: `trip-${t.id}`,
      kind: "trip",
      title: t.name,
      detail: [
        t.destination ?? "Destination TBD",
        t.startDate ? format(t.startDate, "MMM d, yyyy") : null,
      ]
        .filter(Boolean)
        .join(" · "),
      date: t.startDate?.toISOString() ?? null,
      dateLabel: t.startDate ? format(t.startDate, "MMM d, yyyy") : null,
      amount: plannedTotal(t.lines),
      amountLabel: formatMoney(plannedTotal(t.lines)),
      href: `/trips?id=${t.id}`,
    });
  }

  for (const rx of prescriptions) {
    if (rx.nextRefillDate && rx.nextRefillDate < startOfToday) continue;
    upcoming.push({
      id: `rx-${rx.id}`,
      kind: "rx",
      title: rx.name,
      detail: [
        rx.nextRefillDate ? format(rx.nextRefillDate, "MMM d, yyyy") : null,
        rx.pharmacy,
        "Refill",
      ]
        .filter(Boolean)
        .join(" · "),
      date: rx.nextRefillDate?.toISOString() ?? null,
      dateLabel: rx.nextRefillDate
        ? format(rx.nextRefillDate, "MMM d, yyyy")
        : null,
      amount: rx.amount > 0 ? rx.amount : null,
      amountLabel: rx.amount > 0 ? formatMoney(rx.amount) : null,
      href: "/health#prescriptions",
    });
  }

  for (const item of visionSupplies) {
    if (item.nextOrderDate && item.nextOrderDate < startOfToday) continue;
    upcoming.push({
      id: `vision-${item.id}`,
      kind: "vision",
      title: item.name,
      detail: [
        item.nextOrderDate ? format(item.nextOrderDate, "MMM d, yyyy") : null,
        item.retailer,
        item.kind,
      ]
        .filter(Boolean)
        .join(" · "),
      date: item.nextOrderDate?.toISOString() ?? null,
      dateLabel: item.nextOrderDate
        ? format(item.nextOrderDate, "MMM d, yyyy")
        : null,
      amount: item.amount > 0 ? item.amount : null,
      amountLabel: item.amount > 0 ? formatMoney(item.amount) : null,
      href: "/health#vision",
    });
  }

  for (const a of appointments) {
    if (a.scheduledAt && a.scheduledAt < startOfToday) continue;
    const lifestyleRoutine = a.series?.domain === "lifestyle";
    upcoming.push({
      id: `appt-${a.id}`,
      kind: "appointment",
      title: a.name,
      detail: [
        a.scheduledAt ? format(a.scheduledAt, "MMM d, yyyy") : null,
        a.provider,
        a.kind,
      ]
        .filter(Boolean)
        .join(" · "),
      date: a.scheduledAt?.toISOString() ?? null,
      dateLabel: a.scheduledAt ? format(a.scheduledAt, "MMM d, yyyy") : null,
      amount: a.expectedCost > 0 ? a.expectedCost : null,
      amountLabel: a.expectedCost > 0 ? formatMoney(a.expectedCost) : null,
      href: lifestyleRoutine ? "/lifestyle#routines" : "/health#appointments",
    });
  }

  for (const doc of personalDocuments) {
    if (!shouldShowDocumentInUpcoming(doc.kind, doc.renewsOn, now)) continue;
    upcoming.push({
      id: `doc-${doc.id}`,
      kind: "document",
      title: doc.name,
      detail: [
        doc.renewsOn ? format(doc.renewsOn, "MMM d, yyyy") : null,
        DOCUMENT_KIND_LABELS[doc.kind as DocumentKind] ?? doc.kind,
        doc.holder,
      ]
        .filter(Boolean)
        .join(" · "),
      date: doc.renewsOn?.toISOString() ?? null,
      dateLabel: doc.renewsOn ? format(doc.renewsOn, "MMM d, yyyy") : null,
      amount: null,
      amountLabel: null,
      href: "/documents",
    });
  }

  upcoming.sort((a, b) => {
    const at = a.date ? new Date(a.date).getTime() : farFuture;
    const bt = b.date ? new Date(b.date).getTime() : farFuture;
    return at - bt;
  });

  const next30 = upcoming.filter((item) => {
    if (!item.date) return false;
    const t = new Date(item.date).getTime();
    return t >= startOfToday.getTime() && t <= in30.getTime();
  });
  const next30Total = next30.reduce((s, i) => s + (i.amount ?? 0), 0);

  const expectedMonthlyIncome = incomeSources.reduce(
    (s, src) => s + (src.expectedMonthly > 0 ? src.expectedMonthly : 0),
    0,
  );
  const suggestedContribution = Math.max(
    0,
    expectedMonthlyIncome - targetMonthly,
  );

  return {
    asOf: now.toISOString(),
    plan: {
      ...plan,
      desiredMonthlyLifestyleLabel:
        plan.desiredMonthlyLifestyle != null
          ? formatMoney(plan.desiredMonthlyLifestyle)
          : null,
      monthlyContributionLabel: formatMoney(plan.monthlyContribution),
      expectedReturnRateLabel: formatPercent(plan.expectedReturnRate),
      inflationRateLabel: formatPercent(plan.inflationRate),
      withdrawalRateLabel: formatPercent(plan.withdrawalRate),
      taxBufferPercentLabel: formatPercent(plan.taxBufferPercent),
    },
    lifestyle: {
      currentMonthlyPlan: lifestylePlanMonthly,
      currentMonthlyPlanLabel: formatMoney(lifestylePlanMonthly),
      currentLifestyleActual: lifestyle.lifestyleCost,
      currentLifestyleActualLabel: formatMoney(lifestyle.lifestyleCost),
      billsMonthlyBurn,
      billsMonthlyBurnLabel: formatMoney(billsMonthlyBurn),
      targetMonthly,
      targetMonthlyLabel: formatMoney(targetMonthly),
      targetAnnual,
      targetAnnualLabel: formatMoney(targetAnnual),
      targetAnnualGross,
      targetAnnualGrossLabel: formatMoney(targetAnnualGross),
    },
    portfolio: {
      investments,
      investmentsLabel: formatMoney(investments),
      cash,
      cashLabel: formatMoney(cash),
      startingPortfolio,
      startingPortfolioLabel: formatMoney(startingPortfolio),
      requiredNestEgg,
      requiredNestEggLabel: formatMoney(requiredNestEgg),
      gap,
      gapLabel: formatMoney(gap),
      fundedPercent,
      fundedPercentLabel: formatPercent(fundedPercent),
      currentPassiveMonthly,
      currentPassiveMonthlyLabel: formatMoney(currentPassiveMonthly),
      alreadyIndependent,
    },
    projection: {
      ...projection,
      crossoverYearLabel:
        projection.crossoverYear != null
          ? String(projection.crossoverYear)
          : null,
      crossoverYearRealLabel:
        projection.crossoverYearReal != null
          ? String(projection.crossoverYearReal)
          : null,
      endingNominalLabel: formatMoney(projection.endingNominal),
      endingRealLabel: formatMoney(projection.endingReal),
      milestones,
    },
    strategies: STRATEGY_PRESETS,
    incomeCapacity: {
      expectedMonthlyIncome,
      expectedMonthlyIncomeLabel: formatMoney(expectedMonthlyIncome),
      suggestedContribution,
      suggestedContributionLabel: formatMoney(suggestedContribution),
    },
    upcoming: upcoming.slice(0, 24),
    upcomingNext30Days: {
      count: next30.length,
      total: next30Total,
      totalLabel: formatMoney(next30Total),
    },
    bills: bills.map((b) => {
      const monthly = billMonthlyEquivalent(b.amount, b.cadence);
      return {
        id: b.id,
        name: b.name,
        amount: b.amount,
        amountLabel: formatMoney(b.amount),
        cadence: b.cadence,
        monthlyEquivalent: monthly,
        monthlyEquivalentLabel: formatMoney(monthly),
        nextDateLabel: b.nextDate ? format(b.nextDate, "MMM d, yyyy") : null,
        categoryName: b.category.name,
      };
    }),
  };
}

