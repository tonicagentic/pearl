import { format } from "date-fns";
import {
  dismissInsight,
  listOpenInsights,
  runDailyCategorizePass,
  runWeeklyBudgetReview,
} from "@/lib/finance/agent-coach";
import { planOverlapsYear, premiumInYear } from "@/lib/finance/health-plans";
import { computeMonthLifestyle } from "@/lib/finance/lifestyle";
import { currentYearMonth, formatMoney, monthBounds } from "@/lib/finance/money";
import { computeNetWorth } from "@/lib/finance/net-worth";
import { prescriptionMonthlyEquivalent } from "@/lib/finance/prescriptions";
import { prisma } from "@/lib/finance/prisma";
import { seriesMonthlyEquivalent } from "@/lib/finance/recurring-series";
import {
  formatVehicleCardDetails,
  formatVehicleTitle,
  monthlyFromPeriodic,
} from "@/lib/finance/vehicles";
import { formatHomeLocality } from "@/lib/finance/homes";
import {
  incomeStatement,
  parseReportPeriod,
  periodBounds,
  type ReportPeriod,
} from "@/lib/finance/reports";
import {
  isUpcomingTrip,
  plannedTotal,
  TRIP_LINE_KIND_LABELS,
  TRIP_STATUS_LABELS,
} from "@/lib/finance/trips";

function iso(d: Date | null | undefined) {
  return d ? d.toISOString() : null;
}

export async function buildIncomeStatementPayload(
  searchParams: URLSearchParams,
  entityId?: string | null,
) {
  const sp = Object.fromEntries(searchParams.entries());
  const period = parseReportPeriod(sp);
  const bounds = periodBounds(period);
  const pnl = await incomeStatement({
    from: bounds.from,
    to: bounds.to,
    entityId: entityId ?? sp.entityId,
  });

  const line = (
    l: (typeof pnl.income)[number],
    signed?: boolean,
  ) => ({
    categoryId: l.categoryId,
    name: l.name,
    code: l.code,
    groupName: l.groupName,
    amount: l.amount,
    amountLabel: formatMoney(l.amount, signed ? { signed: true } : undefined),
  });

  const expenseByGroup = new Map<string, number>();
  for (const e of pnl.expenses) {
    const key = e.groupName ?? "Other";
    expenseByGroup.set(key, (expenseByGroup.get(key) ?? 0) + e.amount);
  }
  const expenseGroups = [...expenseByGroup.entries()]
    .map(([name, amount]) => ({
      name,
      amount,
      amountLabel: formatMoney(amount),
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    period: {
      kind: period.kind,
      label: bounds.label,
      from: bounds.from.toISOString(),
      to: bounds.to.toISOString(),
    },
    totals: {
      totalIncome: pnl.totalIncome,
      totalExpenses: pnl.totalExpenses,
      totalTaxes: pnl.totalTaxes,
      operatingNet: pnl.operatingNet,
      netAfterTax: pnl.netAfterTax,
      totalIncomeLabel: formatMoney(pnl.totalIncome),
      totalExpensesLabel: formatMoney(pnl.totalExpenses),
      totalTaxesLabel: formatMoney(pnl.totalTaxes),
      operatingNetLabel: formatMoney(pnl.operatingNet, { signed: true }),
      netAfterTaxLabel: formatMoney(pnl.netAfterTax, { signed: true }),
    },
    income: pnl.income.map((l) => line(l)),
    expenses: pnl.expenses.map((l) => line(l)),
    taxes: pnl.taxes.map((l) => line(l)),
    expenseGroups,
  };
}

export async function buildBalanceSheetPayload(asOfYear?: number) {
  const year = asOfYear ?? new Date().getFullYear();
  const { netWorth, snapshots, composition, holdings } =
    await computeNetWorth(year);

  const [assets, liabilities] = await Promise.all([
    prisma.asset.findMany({
      include: {
        entity: { select: { id: true, name: true } },
        home: {
          select: { estimatedValueSource: true, estimatedValueAt: true },
        },
        vehicle: {
          select: { estimatedValueSource: true, estimatedValueAt: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.liability.findMany({
      include: { entity: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    asOfYear: year,
    netWorth,
    netWorthLabel: formatMoney(netWorth),
    composition: {
      cash: composition.cash,
      investments: composition.investments,
      otherAssets: composition.otherAssets,
      liabilities: composition.liabilities,
      totalAssets: composition.totalAssets,
      cashLabel: formatMoney(composition.cash),
      investmentsLabel: formatMoney(composition.investments),
      otherAssetsLabel: formatMoney(composition.otherAssets),
      liabilitiesLabel: formatMoney(composition.liabilities),
      totalAssetsLabel: formatMoney(composition.totalAssets),
    },
    snapshots: snapshots.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      taxClass: s.taxClass,
      assets: s.assets,
      liabilities: s.liabilities,
      equity: s.equity,
      lookThroughEquity: s.lookThroughEquity,
      assetsLabel: formatMoney(s.assets),
      liabilitiesLabel: formatMoney(s.liabilities),
      equityLabel: formatMoney(s.equity),
      lookThroughEquityLabel: formatMoney(s.lookThroughEquity),
    })),
    holdings: holdings.slice(0, 40).map((h) => ({
      ...h,
      balanceLabel: formatMoney(h.balance),
      lookThroughLabel: formatMoney(h.lookThrough),
    })),
    assets: assets.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      value: a.value,
      valueLabel: formatMoney(a.value),
      entityName: a.entity.name,
      valueAsOf: iso(a.valueAsOf),
    })),
    liabilities: liabilities.map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type,
      balance: l.balance,
      balanceLabel: formatMoney(l.balance),
      entityName: l.entity.name,
    })),
  };
}

export async function buildLifestylePayload(searchParams: URLSearchParams) {
  const now = currentYearMonth();
  const year = Number(searchParams.get("year") ?? now.year);
  const month = Number(searchParams.get("month") ?? now.month);

  const [lifestyle, homes, vehicles, trips] = await Promise.all([
    computeMonthLifestyle(year, month),
    prisma.home.findMany({
      include: { lines: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    }),
    prisma.vehicle.findMany({
      include: { lines: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ name: "asc" }],
    }),
    prisma.trip.findMany({
      include: { lines: true },
      orderBy: [{ startDate: "asc" }, { name: "asc" }],
      take: 8,
    }),
  ]);

  const { start } = monthBounds(year, month);

  return {
    year,
    month,
    label: format(start, "MMMM yyyy"),
    lifestyleCost: lifestyle.lifestyleCost,
    cashPaid: lifestyle.cashPaid,
    taxCash: lifestyle.taxCash,
    incomeCash: lifestyle.incomeCash,
    savingsRateCash: lifestyle.savingsRateCash,
    savingsRateLifestyle: lifestyle.savingsRateLifestyle,
    lifestyleCostLabel: formatMoney(lifestyle.lifestyleCost),
    cashPaidLabel: formatMoney(lifestyle.cashPaid),
    taxCashLabel: formatMoney(lifestyle.taxCash),
    incomeCashLabel: formatMoney(lifestyle.incomeCash),
  unreviewedGroups: lifestyle.unreviewedGroups,
    rows: lifestyle.rows.map((r) => ({
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      groupName: r.groupName,
      cashPlan: r.cashPlan,
      cashActual: r.cashActual,
      lifestyleActual: r.lifestyleActual,
      reviewed: r.reviewed,
      cashPlanLabel: formatMoney(r.cashPlan),
      cashActualLabel: formatMoney(r.cashActual),
      lifestyleActualLabel: formatMoney(r.lifestyleActual),
    })),
    homes: homes.map((h) => {
      const monthlyPlan = h.lines.reduce(
        (s, l) => s + monthlyFromPeriodic(l.amount, l.cadence),
        0,
      );
      return {
        id: h.id,
        name: h.name,
        city: h.city,
        region: h.region,
        locality: formatHomeLocality(h),
        occupancy: h.occupancy,
        isPrimary: h.isPrimary,
        lineCount: h.lines.length,
        monthlyPlan,
        monthlyPlanLabel: formatMoney(monthlyPlan),
        estimatedValueLabel:
          h.estimatedValue != null ? formatMoney(h.estimatedValue) : null,
      };
    }),
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
      const monthlyPlan = insuranceMonthly + registrationMonthly + fuelMonthly;
      return {
        id: v.id,
        name: v.name,
        title: formatVehicleTitle(v) || v.name,
        ownership: v.ownership,
        details: formatVehicleCardDetails(v),
        lineCount: v.lines.length,
        monthlyPlan,
        monthlyPlanLabel: formatMoney(monthlyPlan),
        estimatedValueLabel:
          v.estimatedValue != null ? formatMoney(v.estimatedValue) : null,
      };
    }),
    upcomingTrips: trips.filter(isUpcomingTrip).map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      destination: t.destination,
      startDate: iso(t.startDate),
      plannedTotal: plannedTotal(t.lines),
      plannedTotalLabel: formatMoney(plannedTotal(t.lines)),
    })),
  };
}

export async function buildHealthPayload(searchParams: URLSearchParams) {
  const { year: currentYear } = currentYearMonth();
  const year = Number(searchParams.get("year") ?? currentYear);

  const [allPlans, prescriptions, appointments, careSeries] =
    await Promise.all([
      prisma.healthPlan.findMany({
        include: { category: true },
        orderBy: [{ coverageType: "asc" }, { carrier: "asc" }],
      }),
      prisma.prescription.findMany({
        include: { category: true },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
      }),
      prisma.appointment.findMany({
        where: {
          OR: [{ seriesId: null }, { series: { domain: "health" } }],
        },
        include: { category: true },
        orderBy: [{ scheduledAt: "asc" }, { name: "asc" }],
      }),
      prisma.recurringSeries.findMany({
        where: { domain: "health" },
        include: { category: true },
        orderBy: [{ isActive: "desc" }, { nextDate: "asc" }, { name: "asc" }],
      }),
    ]);

  const plans = allPlans.filter((p) => planOverlapsYear(p, year));
  const annualPremiums = plans.reduce(
    (s, p) => s + premiumInYear(p, year),
    0,
  );
  const rxMonthly = prescriptions
    .filter((r) => r.isActive)
    .reduce(
      (s, r) => s + prescriptionMonthlyEquivalent(r.amount, r.cadence),
      0,
    );
  const upcomingApptCost = appointments
    .filter((a) => a.status === "planned" || a.status === "scheduled")
    .reduce((s, a) => s + a.expectedCost, 0);
  const careSeriesMonthly = careSeries
    .filter((s) => s.isActive)
    .reduce((s, row) => s + seriesMonthlyEquivalent(row.amount, row.cadence), 0);

  return {
    year,
    stats: {
      annualPremiums,
      rxMonthly,
      careSeriesMonthly,
      upcomingApptCost,
      annualPremiumsLabel: formatMoney(annualPremiums),
      rxMonthlyLabel: formatMoney(rxMonthly),
      careSeriesMonthlyLabel: formatMoney(careSeriesMonthly),
      upcomingApptCostLabel: formatMoney(upcomingApptCost),
    },
    plans: plans.map((p) => ({
      id: p.id,
      carrier: p.carrier,
      planName: p.planName,
      coverageType: p.coverageType,
      year: p.year,
      premiumMonthly: p.premiumMonthly,
      premiumMonthlyLabel: formatMoney(p.premiumMonthly),
      categoryName: p.category?.name ?? null,
    })),
    prescriptions: prescriptions.map((r) => ({
      id: r.id,
      name: r.name,
      isActive: r.isActive,
      amount: r.amount,
      cadence: r.cadence,
      amountLabel: formatMoney(r.amount),
      categoryName: r.category?.name ?? null,
    })),
    appointments: appointments.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      scheduledAt: iso(a.scheduledAt),
      scheduledAtLabel: a.scheduledAt
        ? format(a.scheduledAt, "MMM d, yyyy")
        : null,
      expectedCost: a.expectedCost,
      expectedCostLabel: formatMoney(a.expectedCost),
      categoryName: a.category?.name ?? null,
    })),
    recurringCare: careSeries.map((s) => ({
      id: s.id,
      name: s.name,
      isActive: s.isActive,
      amount: s.amount,
      cadence: s.cadence,
      nextDate: iso(s.nextDate),
      amountLabel: formatMoney(s.amount),
      categoryName: s.category?.name ?? null,
    })),
  };
}

async function tripActuals(tripIds: string[]) {
  if (tripIds.length === 0) {
    return new Map<string, number>();
  }
  const rows = await prisma.transaction.groupBy({
    by: ["tripId"],
    where: { tripId: { in: tripIds }, type: "expense" },
    _sum: { amount: true },
  });
  return new Map(
    rows
      .filter((r) => r.tripId)
      .map((r) => [r.tripId!, Math.abs(r._sum.amount ?? 0)]),
  );
}

export async function buildTripsListPayload() {
  const trips = await prisma.trip.findMany({
    include: {
      home: { select: { name: true } },
      lines: { orderBy: { sortOrder: "asc" } },
      legs: { orderBy: { sortOrder: "asc" }, take: 2 },
    },
    orderBy: [{ startDate: "asc" }, { name: "asc" }],
  });

  const actuals = await tripActuals(trips.map((t) => t.id));

  return {
    trips: trips.map((t) => {
      const planned = plannedTotal(t.lines);
      const actual = actuals.get(t.id) ?? 0;
      return {
        id: t.id,
        slug: t.slug,
        name: t.name,
        destination: t.destination,
        status: t.status,
        statusLabel: TRIP_STATUS_LABELS[t.status as keyof typeof TRIP_STATUS_LABELS] ?? t.status,
        startDate: iso(t.startDate),
        endDate: iso(t.endDate),
        startDateLabel: t.startDate ? format(t.startDate, "MMM d, yyyy") : null,
        homeName: t.home?.name ?? null,
        plannedTotal: planned,
        actualTotal: actual,
        plannedTotalLabel: formatMoney(planned),
        actualTotalLabel: formatMoney(actual),
        upcoming: isUpcomingTrip(t),
        legSummary:
          t.legs.length > 0
            ? `${t.legs[0]!.originIata} → ${t.legs[t.legs.length - 1]!.destinationIata}`
            : null,
      };
    }),
  };
}

export async function buildTripDetailPayload(idOrSlug: string) {
  const trip = await prisma.trip.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      home: { select: { id: true, name: true, city: true, region: true } },
      legs: { orderBy: { sortOrder: "asc" } },
      lines: {
        orderBy: { sortOrder: "asc" },
        include: { category: { select: { name: true } } },
      },
      dayItems: { orderBy: [{ date: "asc" }, { sortOrder: "asc" }] },
    },
  });

  if (!trip) return null;

  const actualRows = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: { tripId: trip.id, type: "expense" },
    _sum: { amount: true },
  });
  const actualTotal = actualRows.reduce(
    (s, r) => s + Math.abs(r._sum.amount ?? 0),
    0,
  );
  const planned = plannedTotal(trip.lines);

  return {
    id: trip.id,
    slug: trip.slug,
    name: trip.name,
    destination: trip.destination,
    status: trip.status,
    statusLabel: TRIP_STATUS_LABELS[trip.status as keyof typeof TRIP_STATUS_LABELS] ?? trip.status,
    notes: trip.notes,
    startDate: iso(trip.startDate),
    endDate: iso(trip.endDate),
    startDateLabel: trip.startDate ? format(trip.startDate, "MMM d, yyyy") : null,
    endDateLabel: trip.endDate ? format(trip.endDate, "MMM d, yyyy") : null,
    home: trip.home,
    plannedTotal: planned,
    actualTotal,
    plannedTotalLabel: formatMoney(planned),
    actualTotalLabel: formatMoney(actualTotal),
    legs: trip.legs.map((l) => ({
      id: l.id,
      originIata: l.originIata,
      destinationIata: l.destinationIata,
      destination: l.destination,
      departureDate: iso(l.departureDate),
      departureDateLabel: l.departureDate
        ? format(l.departureDate, "MMM d, yyyy")
        : null,
    })),
    lines: trip.lines.map((ln) => ({
      id: ln.id,
      name: ln.name,
      kind: ln.kind,
      kindLabel:
        TRIP_LINE_KIND_LABELS[ln.kind as keyof typeof TRIP_LINE_KIND_LABELS] ??
        ln.kind,
      plannedAmount: ln.plannedAmount,
      plannedAmountLabel: formatMoney(ln.plannedAmount),
      bookingStatus: ln.bookingStatus,
      categoryName: ln.category?.name ?? null,
    })),
    dayItems: trip.dayItems.map((d) => ({
      id: d.id,
      date: iso(d.date),
      dateLabel: format(d.date, "MMM d, yyyy"),
      kind: d.kind,
      title: d.title,
      notes: d.notes,
      time: d.time,
    })),
  };
}

export async function buildCoachPayload(limit = 20) {
  const insights = await listOpenInsights(limit);
  return {
    insights: insights.map((i) => ({
      id: i.id,
      kind: i.kind,
      title: i.title,
      body: i.body,
      confidence: i.confidence,
      status: i.status,
      createdAt: i.createdAt.toISOString(),
      createdAtLabel: format(i.createdAt, "MMM d, yyyy"),
      category: i.category
        ? { id: i.category.id, name: i.category.name, slug: i.category.slug }
        : null,
      payload: i.payload,
    })),
  };
}

export async function handleCoachPost(body: {
  action: string;
  id?: string;
  message?: string;
}) {
  if (body.action === "dismiss") {
    if (!body.id) {
      return { ok: false as const, error: "Missing insight id" };
    }
    await dismissInsight(body.id);
    return { ok: true as const, action: "dismiss" };
  }

  if (body.action === "run_analysis") {
    const runId = `mobile-${Date.now()}`;
    await runDailyCategorizePass(runId);
    await runWeeklyBudgetReview(runId);
    const insights = await listOpenInsights(20);
    return {
      ok: true as const,
      action: "run_analysis",
      runId,
      insightCount: insights.length,
    };
  }

  if (body.action === "message") {
    return {
      ok: false as const,
      error:
        "Coach chat is not available on mobile yet. Use Run analysis or open Coach on the web.",
    };
  }

  return { ok: false as const, error: "Unknown action" };
}

export type { ReportPeriod };