/**
 * Pure (DB-free) Future-planning types and math. Safe to import from client components;
 * the server-side loaders live in ./future.ts, which re-exports everything here.
 */
import { monthsForCadence } from "@/lib/finance/vehicles";

export type StrategyKey =
  | "conservative"
  | "balanced"
  | "income"
  | "growth"
  | "custom";

export type StrategyPreset = {
  key: StrategyKey;
  label: string;
  description: string;
  expectedReturnRate: number;
  withdrawalRate: number;
  inflationRate: number;
};

export const STRATEGY_PRESETS: StrategyPreset[] = [
  {
    key: "conservative",
    label: "Conservative",
    description: "Lower risk mix · ~5% return · 3.5% withdrawal",
    expectedReturnRate: 0.05,
    withdrawalRate: 0.035,
    inflationRate: 0.025,
  },
  {
    key: "balanced",
    label: "Balanced",
    description: "Index blend · ~7% return · 4% withdrawal",
    expectedReturnRate: 0.07,
    withdrawalRate: 0.04,
    inflationRate: 0.025,
  },
  {
    key: "income",
    label: "Dividend / Yield",
    description: "Income tilt · ~6% return · 4.5% withdrawal",
    expectedReturnRate: 0.06,
    withdrawalRate: 0.045,
    inflationRate: 0.025,
  },
  {
    key: "growth",
    label: "Growth",
    description: "Equity-heavy · ~8.5% return · 3.5% withdrawal",
    expectedReturnRate: 0.085,
    withdrawalRate: 0.035,
    inflationRate: 0.025,
  },
  {
    key: "custom",
    label: "Custom",
    description: "Set your own return, inflation, and withdrawal rates",
    expectedReturnRate: 0.07,
    withdrawalRate: 0.04,
    inflationRate: 0.025,
  },
];

export function getStrategyPreset(key: string): StrategyPreset {
  return (
    STRATEGY_PRESETS.find((p) => p.key === key) ??
    STRATEGY_PRESETS.find((p) => p.key === "balanced")!
  );
}

/** Gross annual lifestyle cashflow need including optional tax/safety buffer. */
export function annualLifestyleNeed(
  monthlyTarget: number,
  taxBufferPercent = 0,
): number {
  const base = Math.max(0, monthlyTarget) * 12;
  const buffer = Math.max(0, taxBufferPercent);
  return base * (1 + buffer);
}

/** Nest egg required to fund annual need at a given safe withdrawal rate. */
export function requiredPortfolioForPassiveIncome(
  annualNeed: number,
  withdrawalRate: number,
): number {
  if (!(withdrawalRate > 0) || !(annualNeed > 0)) return 0;
  return annualNeed / withdrawalRate;
}

export type CompoundingYearPoint = {
  year: number;
  yearIndex: number;
  nominalBalance: number;
  realBalance: number;
  totalContributed: number;
  totalGrowth: number;
  sustainableAnnualIncome: number;
  sustainableMonthlyIncome: number;
  coversLifestyle: boolean;
};

export type CompoundingProjection = {
  series: CompoundingYearPoint[];
  crossoverYear: number | null;
  crossoverYearReal: number | null;
  endingNominal: number;
  endingReal: number;
};

export type ProjectCompoundingInput = {
  startingPortfolio: number;
  monthlyContribution: number;
  nominalReturn: number;
  inflationRate: number;
  withdrawalRate: number;
  annualNeed: number;
  horizonYears: number;
  /** Calendar year for year 0 label (defaults to current). */
  startCalendarYear?: number;
};

/**
 * Year-by-year compounding with monthly contributions.
 * Contributions are added at month-end; return applied monthly.
 */
export function projectCompounding(
  input: ProjectCompoundingInput,
): CompoundingProjection {
  const horizon = Math.max(0, Math.min(60, Math.trunc(input.horizonYears)));
  const startYear =
    input.startCalendarYear ?? new Date().getFullYear();
  const monthlyRate = input.nominalReturn / 12;
  const monthlyContribution = Math.max(0, input.monthlyContribution);
  const start = Math.max(0, input.startingPortfolio);
  const swr = Math.max(0, input.withdrawalRate);
  const annualNeed = Math.max(0, input.annualNeed);
  const inflation = Math.max(0, input.inflationRate);

  let balance = start;
  let totalContributed = 0;
  const series: CompoundingYearPoint[] = [];
  let crossoverYear: number | null = null;
  let crossoverYearReal: number | null = null;

  // Year 0 snapshot (today)
  {
    const sustainableAnnualIncome = balance * swr;
    const realBalance = balance;
    const covers = annualNeed <= 0 ? true : sustainableAnnualIncome >= annualNeed;
    series.push({
      year: startYear,
      yearIndex: 0,
      nominalBalance: balance,
      realBalance,
      totalContributed: 0,
      totalGrowth: 0,
      sustainableAnnualIncome,
      sustainableMonthlyIncome: sustainableAnnualIncome / 12,
      coversLifestyle: covers,
    });
    if (covers) {
      crossoverYear = startYear;
      crossoverYearReal = startYear;
    }
  }

  for (let y = 1; y <= horizon; y += 1) {
    for (let m = 0; m < 12; m += 1) {
      balance = balance * (1 + monthlyRate) + monthlyContribution;
      totalContributed += monthlyContribution;
    }
    const calendarYear = startYear + y;
    const inflationFactor = Math.pow(1 + inflation, y);
    const realBalance = inflationFactor > 0 ? balance / inflationFactor : balance;
    const totalGrowth = balance - start - totalContributed;
    const sustainableAnnualIncome = balance * swr;
    // Compare real sustainable income to today's annual need
    const realSustainable = realBalance * swr;
    const coversNominal =
      annualNeed <= 0 ? true : sustainableAnnualIncome >= annualNeed;
    const coversReal =
      annualNeed <= 0 ? true : realSustainable >= annualNeed;

    series.push({
      year: calendarYear,
      yearIndex: y,
      nominalBalance: balance,
      realBalance,
      totalContributed,
      totalGrowth,
      sustainableAnnualIncome,
      sustainableMonthlyIncome: sustainableAnnualIncome / 12,
      coversLifestyle: coversReal,
    });

    if (crossoverYear == null && coversNominal) crossoverYear = calendarYear;
    if (crossoverYearReal == null && coversReal) crossoverYearReal = calendarYear;
  }

  const last = series[series.length - 1]!;
  return {
    series,
    crossoverYear,
    crossoverYearReal,
    endingNominal: last.nominalBalance,
    endingReal: last.realBalance,
  };
}

export function billMonthlyEquivalent(amount: number, cadence: string): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (cadence === "one_time") return 0;
  if (cadence === "weekly") return (amount * 52) / 12;
  const months = monthsForCadence(cadence);
  return months > 0 ? amount / months : amount;
}

export type FuturePlanSettings = {
  slug: string;
  desiredMonthlyLifestyle: number | null;
  monthlyContribution: number;
  strategyKey: StrategyKey;
  expectedReturnRate: number;
  inflationRate: number;
  withdrawalRate: number;
  horizonYears: number;
  includeCashInPortfolio: boolean;
  taxBufferPercent: number;
  notes: string | null;
};

export type FutureUpcomingItem = {
  id: string;
  kind: "bill" | "tax" | "trip" | "rx" | "appointment" | "vision" | "document";
  title: string;
  detail: string;
  date: string | null;
  dateLabel: string | null;
  amount: number | null;
  amountLabel: string | null;
  href: string;
};

export type FuturePayload = {
  asOf: string;
  plan: FuturePlanSettings & {
    desiredMonthlyLifestyleLabel: string | null;
    monthlyContributionLabel: string;
    expectedReturnRateLabel: string;
    inflationRateLabel: string;
    withdrawalRateLabel: string;
    taxBufferPercentLabel: string;
  };
  lifestyle: {
    currentMonthlyPlan: number;
    currentMonthlyPlanLabel: string;
    currentLifestyleActual: number;
    currentLifestyleActualLabel: string;
    billsMonthlyBurn: number;
    billsMonthlyBurnLabel: string;
    targetMonthly: number;
    targetMonthlyLabel: string;
    targetAnnual: number;
    targetAnnualLabel: string;
    targetAnnualGross: number;
    targetAnnualGrossLabel: string;
  };
  portfolio: {
    investments: number;
    investmentsLabel: string;
    cash: number;
    cashLabel: string;
    startingPortfolio: number;
    startingPortfolioLabel: string;
    requiredNestEgg: number;
    requiredNestEggLabel: string;
    gap: number;
    gapLabel: string;
    fundedPercent: number;
    fundedPercentLabel: string;
    currentPassiveMonthly: number;
    currentPassiveMonthlyLabel: string;
    alreadyIndependent: boolean;
  };
  projection: CompoundingProjection & {
    crossoverYearLabel: string | null;
    crossoverYearRealLabel: string | null;
    endingNominalLabel: string;
    endingRealLabel: string;
    milestones: Array<{
      yearIndex: number;
      year: number;
      nominalBalanceLabel: string;
      realBalanceLabel: string;
      sustainableMonthlyLabel: string;
      coversLifestyle: boolean;
    }>;
  };
  strategies: StrategyPreset[];
  incomeCapacity: {
    expectedMonthlyIncome: number;
    expectedMonthlyIncomeLabel: string;
    suggestedContribution: number;
    suggestedContributionLabel: string;
  };
  upcoming: FutureUpcomingItem[];
  upcomingNext30Days: {
    count: number;
    total: number;
    totalLabel: string;
  };
  bills: Array<{
    id: string;
    name: string;
    amount: number;
    amountLabel: string;
    cadence: string;
    monthlyEquivalent: number;
    monthlyEquivalentLabel: string;
    nextDateLabel: string | null;
    categoryName: string;
  }>;
};

export type UpsertFuturePlanInput = {
  desiredMonthlyLifestyle?: number | null;
  monthlyContribution?: number;
  strategyKey?: string;
  expectedReturnRate?: number;
  inflationRate?: number;
  withdrawalRate?: number;
  horizonYears?: number;
  includeCashInPortfolio?: boolean;
  taxBufferPercent?: number;
  notes?: string | null;
};


/** Client-side recalculation helper (shared shape with mobile). */
export function recalculateFutureProjection(opts: {
  startingPortfolio: number;
  monthlyContribution: number;
  expectedReturnRate: number;
  inflationRate: number;
  withdrawalRate: number;
  targetMonthly: number;
  taxBufferPercent: number;
  horizonYears: number;
  startCalendarYear?: number;
}) {
  const annualNeed = annualLifestyleNeed(
    opts.targetMonthly,
    opts.taxBufferPercent,
  );
  const requiredNestEgg = requiredPortfolioForPassiveIncome(
    annualNeed,
    opts.withdrawalRate,
  );
  const projection = projectCompounding({
    startingPortfolio: opts.startingPortfolio,
    monthlyContribution: opts.monthlyContribution,
    nominalReturn: opts.expectedReturnRate,
    inflationRate: opts.inflationRate,
    withdrawalRate: opts.withdrawalRate,
    annualNeed,
    horizonYears: opts.horizonYears,
    startCalendarYear: opts.startCalendarYear,
  });
  const gap = Math.max(0, requiredNestEgg - opts.startingPortfolio);
  const fundedPercent =
    requiredNestEgg > 0
      ? Math.min(1, opts.startingPortfolio / requiredNestEgg)
      : opts.startingPortfolio > 0
        ? 1
        : 0;
  return {
    annualNeed,
    requiredNestEgg,
    gap,
    fundedPercent,
    currentPassiveMonthly: (opts.startingPortfolio * opts.withdrawalRate) / 12,
    alreadyIndependent:
      requiredNestEgg <= 0 || opts.startingPortfolio >= requiredNestEgg,
    projection,
  };
}
