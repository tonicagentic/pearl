import { format } from "date-fns";
import { estimateDueDates, computeTaxesForYear } from "@/lib/finance/tax-estimator";
import { formatMoney } from "@/lib/finance/money";
import { prisma, safeFindMany } from "@/lib/finance/prisma";
import {
  getOrCreateTaxYearProfile,
  last4FromEnc,
  listBlankPresence,
  listSelectableTaxYears,
  resolveTaxYear,
  taxSeason,
  yearsWithTaxData,
} from "@/lib/finance/tax";
import {
  extensionFilingDeadline,
  originalFilingDeadline,
} from "@/lib/finance/tax/year";
import type { Money } from "@/lib/finance/agent-money";

function moneyUsd(m: Money | null | undefined): number {
  return m?.usd ?? 0;
}

function moneyLabel(m: Money | null | undefined): string {
  return formatMoney(moneyUsd(m));
}

export async function buildTaxYearsPayload() {
  const dataYears = await yearsWithTaxData();
  const years = listSelectableTaxYears({ fromData: dataYears });
  const current = resolveTaxYear(undefined);
  return {
    years,
    current,
    season: taxSeason(),
    dataYears,
  };
}

export async function buildTaxSummaryPayload(yearRaw?: string | null) {
  const year = resolveTaxYear(yearRaw);
  const season = taxSeason();
  const dataYears = await yearsWithTaxData();
  const years = listSelectableTaxYears({ fromData: dataYears });

  const [computation, profile, yearProfile, activities, events, params] =
    await Promise.all([
      computeTaxesForYear(year),
      prisma.taxProfile.findFirst(),
      getOrCreateTaxYearProfile(year),
      prisma.taxActivity.findMany({
        where: { year },
        include: { entity: { select: { id: true, name: true } } },
        orderBy: { label: "asc" },
      }),
      prisma.taxEvent.findMany({ where: { year }, orderBy: { date: "asc" } }),
      prisma.taxYearParams.findUnique({ where: { year } }),
    ]);

  const dues = estimateDueDates(year);

  let quarterly: {
    federal: number;
    state: number;
    total: number;
    federalLabel: string;
    stateLabel: string;
    totalLabel: string;
  } | null = null;

  let remaining: {
    federal: number;
    state: number;
    total: number;
    federalLabel: string;
    stateLabel: string;
    totalLabel: string;
  } | null = null;

  let liability: {
    federal: number;
    state: number;
    local: number;
    total: number;
    federalLabel: string;
    stateLabel: string;
    localLabel: string;
    totalLabel: string;
    safeHarborFederal: number;
    safeHarborFederalLabel: string;
  } | null = null;

  if (computation) {
    const fedTarget = Math.max(
      moneyUsd(computation.federal.totalTax),
      moneyUsd(computation.federal.safeHarbor),
    );
    const stateTax = moneyUsd(computation.state?.totalTax);
    const stateSafe = moneyUsd(computation.state?.safeHarbor);
    const localTax = moneyUsd(computation.local?.totalTax);
    const localSafe = moneyUsd(computation.local?.safeHarbor);
    const stateTarget = Math.max(stateTax + localTax, stateSafe + localSafe);
    quarterly = {
      federal: fedTarget / 4,
      state: stateTarget / 4,
      total: (fedTarget + stateTarget) / 4,
      federalLabel: formatMoney(fedTarget / 4),
      stateLabel: formatMoney(stateTarget / 4),
      totalLabel: formatMoney((fedTarget + stateTarget) / 4),
    };
    const remFed = moneyUsd(computation.federal.remaining);
    const remState =
      moneyUsd(computation.state?.remaining) + moneyUsd(computation.local?.remaining);
    const remTotal = moneyUsd(computation.combined.remaining);
    remaining = {
      federal: remFed,
      state: remState,
      total: remTotal,
      federalLabel: formatMoney(remFed),
      stateLabel: formatMoney(remState),
      totalLabel: formatMoney(remTotal),
    };
    liability = {
      federal: moneyUsd(computation.federal.totalTax),
      state: stateTax,
      local: localTax,
      total: moneyUsd(computation.federal.totalTax) + stateTax + localTax,
      federalLabel: moneyLabel(computation.federal.totalTax),
      stateLabel: formatMoney(stateTax),
      localLabel: formatMoney(localTax),
      totalLabel: formatMoney(
        moneyUsd(computation.federal.totalTax) + stateTax + localTax,
      ),
      safeHarborFederal: moneyUsd(computation.federal.safeHarbor),
      safeHarborFederalLabel: moneyLabel(computation.federal.safeHarbor),
    };
  }

  const fileDue = originalFilingDeadline(year);
  const extensionDue = extensionFilingDeadline(year);

  return {
    year,
    years,
    season,
    hasParams: Boolean(params),
    paramsHint: params
      ? `Rates vintage ${year}: std ded ${formatMoney(params.standardDeduction)}, SS wage base ${formatMoney(params.ssWageBase)}`
      : null,
    liability,
    quarterly,
    remaining,
    fileDue: fileDue.toISOString(),
    fileDueLabel: format(fileDue, "MMM d, yyyy"),
    extensionDue: extensionDue.toISOString(),
    extensionDueLabel: format(extensionDue, "MMM d, yyyy"),
    dues: dues.map((d) => ({
      quarter: d.quarter,
      label: d.label,
      federal: d.federal.toISOString(),
      state: d.ca.toISOString(),
      federalLabel: format(d.federal, "MMM d, yyyy"),
      stateLabel: format(d.ca, "MMM d, yyyy"),
    })),
    returnFiledAt: yearProfile.returnFiledAt
      ? format(yearProfile.returnFiledAt, "yyyy-MM-dd")
      : null,
    yearProfile: {
      year: yearProfile.year,
      filingStatus: yearProfile.filingStatus,
      residentState: yearProfile.residentState,
      residentLocality: yearProfile.residentLocality,
      partYearResident: yearProfile.partYearResident,
      hasW2: yearProfile.hasW2,
      hasSelfEmployment: yearProfile.hasSelfEmployment,
      hasInvestments: yearProfile.hasInvestments,
      hasRental: yearProfile.hasRental,
      hasK1: yearProfile.hasK1,
      hasDependents: yearProfile.hasDependents,
      deductionMethod: yearProfile.deductionMethod,
      priorYearFederalTax: yearProfile.priorYearFederalTax,
      priorYearStateTax: yearProfile.priorYearStateTax,
      priorYearLocalTax: yearProfile.priorYearLocalTax,
      withholdingFederalYtd: yearProfile.withholdingFederalYtd,
      withholdingStateYtd: yearProfile.withholdingStateYtd,
      withholdingLocalYtd: yearProfile.withholdingLocalYtd,
      businessExpensesReviewedAt:
        yearProfile.businessExpensesReviewedAt?.toISOString() ?? null,
      returnFiledAt: yearProfile.returnFiledAt
        ? format(yearProfile.returnFiledAt, "yyyy-MM-dd")
        : null,
    },
    filer: {
      filingStatus: profile?.filingStatus ?? "single",
      residentState: profile?.residentState ?? "CA",
      legalName: profile?.legalName ?? "",
      occupation: profile?.occupation ?? "",
      addressLine1: profile?.addressLine1 ?? "",
      addressLine2: profile?.addressLine2 ?? "",
      city: profile?.city ?? "",
      state: profile?.state ?? profile?.residentState ?? "CA",
      zip: profile?.zip ?? "",
      phone: profile?.phone ?? "",
      spouseLegalName: profile?.spouseLegalName ?? "",
      ssnLast4: last4FromEnc(profile?.ssnEnc ?? null),
      spouseSsnLast4: last4FromEnc(profile?.spouseSsnEnc ?? null),
      notes: profile?.notes ?? "",
    },
    activities: activities.map((a) => ({
      id: a.id,
      label: a.label,
      formType: a.formType,
      taxCharacter: a.taxCharacter,
      profit: a.profit,
      profitLabel: formatMoney(a.profit),
      entityId: a.entityId,
      entityName: a.entity?.name ?? null,
    })),
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      date: e.date?.toISOString() ?? null,
      dateLabel: e.date ? format(e.date, "MMM d, yyyy") : null,
      amount: e.amount,
      amountLabel: formatMoney(e.amount),
      notes: e.notes,
    })),
    limitations: computation?.limitations ?? [],
    notes: computation?.legacy.notes ?? [],
  };
}

export async function buildTaxDocumentsPayload(yearRaw?: string | null) {
  const year = resolveTaxYear(yearRaw);
  const [documents, entities, brokerageAccounts] = await Promise.all([
    safeFindMany<{
      id: string;
      year: number;
      formKind: string;
      payerName: string | null;
      fileName: string;
      status: string;
      error: string | null;
      createdAt: Date;
      lines: {
        id: string;
        status: string;
        target: string;
        taxCharacter: string | null;
        label: string | null;
        amount: number | null;
        entityId: string | null;
        description: string | null;
        proceeds: number | null;
        basis: number | null;
        term: string | null;
        date: Date | null;
        sourceBox: string | null;
        committedActivityId: string | null;
        committedCapitalGainId: string | null;
      }[];
    }>("taxDocument", {
      where: { year },
      include: { lines: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.entity.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.account.findMany({
      where: { isActive: true, type: "brokerage" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    year,
    entities,
    brokerageAccounts,
    documents: documents.map((d) => ({
      id: d.id,
      formKind: d.formKind,
      payerName: d.payerName,
      fileName: d.fileName,
      status: d.status,
      error: d.error,
      createdAt: d.createdAt.toISOString(),
      lines: d.lines.map((l) => ({
        ...l,
        amountLabel: l.amount != null ? formatMoney(l.amount) : null,
        date: l.date?.toISOString() ?? null,
      })),
    })),
  };
}

export async function buildTaxBusinessExpensesPayload(yearRaw?: string | null) {
  const year = resolveTaxYear(yearRaw);
  const [expenses, activities, yearProfile] = await Promise.all([
    safeFindMany<{
      id: string;
      activityId: string;
      category: string;
      amount: number;
      notes: string | null;
    }>("taxBusinessExpense", { where: { year } }),
    prisma.taxActivity.findMany({
      where: { year },
      select: { id: true, label: true },
      orderBy: { label: "asc" },
    }),
    getOrCreateTaxYearProfile(year),
  ]);

  return {
    year,
    reviewedAt: yearProfile.businessExpensesReviewedAt?.toISOString() ?? null,
    activities,
    expenses: expenses.map((e) => ({
      ...e,
      amountLabel: formatMoney(e.amount),
    })),
  };
}

export async function buildTaxFormsPayload(yearRaw?: string | null) {
  const year = resolveTaxYear(yearRaw);
  const blanks = await listBlankPresence(year);
  return {
    year,
    blanks: blanks.map((b) => ({
      form: b.form,
      fileName: b.fileName,
      present: b.present,
      path: b.path ?? null,
      fetchable: b.fetchable,
    })),
  };
}
